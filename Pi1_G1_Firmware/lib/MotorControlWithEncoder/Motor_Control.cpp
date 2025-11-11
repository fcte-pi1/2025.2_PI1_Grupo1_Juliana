#include "Arduino.h"
#include "Motor_Control.h"
#include <pin_declaration.h>
#include <Wire.h>

#define SERIAL_DEBUG

// Variáveis para giro por tempo
static bool turnActive = false;
static unsigned long turnStartTime = 0;
static unsigned long turnDuration = 0;

uint8_t DefaultStopMode;        // used for PWM == 0 and STOP_MODE_KEEP
uint8_t RequestedSpeedPWM = 0; // Last PWM requested for motor. Stopped if RequestedSpeedPWM == 0. It is always >= CurrentCompensatedSpeedPWM

/*
    * Positive value to be subtracted from TargetPWM to get CurrentCompensatedSpeedPWM to compensate for different left and right motors
    * Currently SpeedPWMCompensation is in steps of 2 and only one motor can have a positive value, the other is set to zero.
    * Value is computed in EncoderMotor::synchronizeMotor()
    */
uint8_t CurrentCompensatedSpeedPWM; // RequestedSpeedPWM - SpeedPWMCompensation.
uint8_t CurrentDirection; // Used for speed and distance. Contains DIRECTION_FORWARD, DIRECTION_BACKWARD but NOT STOP_MODE_BRAKE, STOP_MODE_RELEASE.

/**************************************************************
 * Variables required for going a fixed distance with encoder
 **************************************************************/
/*
    * Reset() resets all members from TargetDistanceCount to (including) EncoderInterruptDeltaMillis to 0
    */
unsigned int TargetDistanceMillimeter;
unsigned int LastTargetDistanceMillimeter;
static bool MotorPWMHasChanged;
bool CheckStopConditionInUpdateMotor;

/*
    * Positive value to be subtracted from TargetPWM to get CurrentCompensatedSpeedPWM to compensate for different left and right motors
    * Currently SpeedPWMCompensation is in steps of 2 and only one motor can have a positive value, the other is set to zero.
    * Value is computed in EncoderMotor::synchronizeMotor()
    */
uint8_t SpeedPWMCompensation = 2;   // Positive value to be subtracted from TargetPWM

/*
    * Distance optocoupler impulse counter. It is reset at startGoDistanceCount if motor was stopped.
    * Both values are incremented at each encoder interrupt and reset at startGoDistanceMillimeter().
    */
volatile unsigned int EncoderCount; // 11 mm for a 220 mm Wheel and 20 encoder slots reset at startGoDistanceMillimeter
volatile unsigned int EncoderCountForSynchronize; // count used and modified by function


volatile static bool SensorValuesHaveChanged; // true if encoder data or IMU data have changed
/*
    * For ramp control
    */
uint8_t MotorRampState; // MOTOR_STATE_STOPPED, MOTOR_STATE_START, MOTOR_STATE_RAMP_UP, MOTOR_STATE_DRIVE, MOTOR_STATE_RAMP_DOWN
uint8_t RequestedDriveSpeedPWM; // DriveSpeedPWM - SpeedPWMCompensation; The DriveSpeedPWM used for current movement. Can be set for eg. turning which better performs with reduced DriveSpeedPWM

unsigned long NextRampChangeMillis;

// Do not move it!!! It must be after AverageSpeedIsValid and is required for resetSpeedValues()
volatile unsigned long EncoderInterruptDeltaMillis; // Used to get speed

// Do not move it!!! It must be the last element in structure and is required for stopMotorAndReset()
volatile unsigned long LastEncoderInterruptMillis; // used internal for debouncing and lock/timeout detection

void resetSpeedValues(); 
unsigned int getSpeed();
unsigned int getBrakingDistanceMillimeter();
unsigned int getDistanceMillimeter() ;
bool isStopped();
void stop(uint8_t aStopMode);
void setMotorDriverMode(uint8_t aMotorDriverMode);
void setDirection(uint8_t aMotorDirection);
void setSpeedPWM(uint8_t aRequestedSpeedPWM);
bool checkAndHandleDirectionChange(uint8_t aRequestedDirection);
void setSpeedPWMAndDirection(uint8_t aRequestedSpeedPWM, uint8_t aRequestedDirection);
void setSpeedPWMAndDirectionWithRamp(uint8_t aRequestedSpeedPWM, uint8_t aRequestedDirection) ;
void resetEncoderControlValues();
void setMotorDifferential(int pwm_r, int pwm_l);


//=======================================================================


void IRAM_ATTR handleEncoderInterrupt() {
    long tMillis = millis();
    unsigned long tDeltaMillis = tMillis - LastEncoderInterruptMillis;
    if (tDeltaMillis <= ENCODER_SENSOR_RING_MILLIS) {
        // assume signal is ringing and do nothing
    } else {
        LastEncoderInterruptMillis = tMillis;
        if (tDeltaMillis < ENCODER_SENSOR_TIMEOUT_MILLIS) {
            EncoderInterruptDeltaMillis = tDeltaMillis;
        } else {
            // timeout
            EncoderInterruptDeltaMillis = 0;
        }

        EncoderCount++;
        EncoderCountForSynchronize++;
        SensorValuesHaveChanged = true;
    }
}

void encoderInit (){
  pinMode(ENC1_R, INPUT);
  attachInterrupt(digitalPinToInterrupt(ENC1_R), handleEncoderInterrupt, RISING);
}
/*
 * If motor is already running, adjust TargetDistanceMillimeter to go to aRequestedDistanceMillimeter
 */
void startGoDistanceMillimeterWithSpeed(uint8_t aRequestedSpeedPWM, unsigned int aRequestedDistanceMillimeter,
        uint8_t aRequestedDirection) {
    if (aRequestedDistanceMillimeter == 0) {
        stop(DefaultStopMode); // In case motor was running
        return;
    }
    resetEncoderControlValues();
    if (RequestedSpeedPWM == 0) {
        TargetDistanceMillimeter = aRequestedDistanceMillimeter;
        setSpeedPWMAndDirectionWithRamp(aRequestedSpeedPWM, aRequestedDirection);
    } else {
        /*
         * Already moving
         */
        TargetDistanceMillimeter = getDistanceMillimeter() + aRequestedDistanceMillimeter;
        setSpeedPWMAndDirection(aRequestedSpeedPWM, aRequestedDirection);
    }
    LastTargetDistanceMillimeter = TargetDistanceMillimeter;
    CheckStopConditionInUpdateMotor = true;
}

void resetEncoderControlValues() {
  EncoderCount = 0;
  EncoderCountForSynchronize = 0;
  LastEncoderInterruptMillis = millis() - ENCODER_SENSOR_RING_MILLIS - 1; // Set to a sensible value to avoid initial timeout
}

/*
 * If motor was stooped or changed direction, starts ramp if enabled
 * Else call setSpeedPWMAndDirection() directly, which sets CurrentCompensatedSpeedPWM
 */
void setSpeedPWMAndDirectionWithRamp(uint8_t aRequestedSpeedPWM, uint8_t aRequestedDirection) {
  if (aRequestedSpeedPWM <= RAMP_UP_VALUE_OFFSET_SPEED_PWM) {
    // Here ramp makes no sense, since requested PWM does not lead to spinning wheels
    setSpeedPWMAndDirection(aRequestedSpeedPWM, aRequestedDirection);
  } else {
    if (MotorRampState == MOTOR_STATE_DRIVE && CurrentDirection == aRequestedDirection) {
      /*
      * motor is driving -> just change drive speed
      */
      setSpeedPWMAndDirection(aRequestedSpeedPWM, aRequestedDirection);
    } else {
      checkAndHandleDirectionChange(aRequestedDirection);
      /*
      * Stopped here, now set target speed for ramp up
      */
      MotorRampState = MOTOR_STATE_START;
      RequestedDriveSpeedPWM = aRequestedSpeedPWM;  //TODO: Que valores interessam para velocidades
    }
  }
}

/**
 *  @brief  Control the DC Motor speed/throttle. Subtracts SpeedPWMCompensation from aRequestedSpeedPWM before applying
 *
 *  @param  aRequestedSpeedPWM The 8-bit PWM value, 0 is off, 255 is on forward
 *  @param  aRequestedDirection is DIRECTION_FORWARD or DIRECTION_BACKWARD
 *  First set driver mode, then set PWM
 *  PWM period is 600 us for Adafruit Motor Shield V2 using PCA9685.
 *  PWM period is 1030 us for using AnalogWrite on pin 5 + 6.
 */
void setSpeedPWMAndDirection(uint8_t aRequestedSpeedPWM, uint8_t aRequestedDirection) {
    if (aRequestedSpeedPWM == 0) {
        stop(STOP_MODE_KEEP);
    } else {
        checkAndHandleDirectionChange(aRequestedDirection);
        setSpeedPWM(aRequestedSpeedPWM);
    }
}

/*
 * @return true if direction has changed AND motor was stopped
 */
bool checkAndHandleDirectionChange(uint8_t aRequestedDirection) {
    /*
     * Reduce to STOP, FORWARD or BACKWARD
     */
    uint8_t tRequestedDirection = aRequestedDirection & DIRECTION_FORWARD_BACKWARD_MASK;
    bool tReturnValue = false;
    if (CurrentDirection != tRequestedDirection) {
        if (!isStopped()) {
            /*
             * Direction change requested but motor still running-> first stop motor
             */
            stop(STOP_MODE_BRAKE);
            tReturnValue = true;
        }
        setDirection(tRequestedDirection); // this in turn sets CurrentDirection
    }
    return tReturnValue;
}

/*
 * Sets active PWM and handles speed compensation and stop of motor
 *  @param  aRequestedSpeedPWM The 8-bit PWM value, 0 is off, 255 is on forward
 */
void setSpeedPWM(uint8_t aRequestedSpeedPWM) {
    RequestedSpeedPWM = aRequestedSpeedPWM;
    if (aRequestedSpeedPWM == 0) {
        stop(STOP_MODE_KEEP);
        return;
    }
    /*
     * Handle speed compensation
     */
    uint8_t tCompensatedSpeedPWM;
    if (aRequestedSpeedPWM > SpeedPWMCompensation) {
        tCompensatedSpeedPWM = aRequestedSpeedPWM - SpeedPWMCompensation; // The only statement which sets CurrentCompensatedSpeedPWM to a value != 0
    } else {
        tCompensatedSpeedPWM = 0; // no stop mode here
    }
    if (CurrentCompensatedSpeedPWM != tCompensatedSpeedPWM) {
        CurrentCompensatedSpeedPWM = tCompensatedSpeedPWM;
        MotorPWMHasChanged = true;
        /*
         * Write to hardware
         */
#if defined(SERIAL_DEBUG)        
        Serial.printf("PWM setado: %d\n", aRequestedSpeedPWM);
        Serial.printf("PWM compensado: %d\n", tCompensatedSpeedPWM);
#endif
        ledcWrite(MOTOR_PWMA_CHANNEL, aRequestedSpeedPWM);
        ledcWrite(MOTOR_PWMB_CHANNEL, tCompensatedSpeedPWM);
    }
}

/*
 *  @brief  Control the DC motor driver direction and stop mode
 *  @param  aMotorDriverMode The mode can be FORWARD, BACKWARD (BRAKE motor connection are shortened) or RELEASE ( motor connections are high impedance)
 */
void setDirection(uint8_t aMotorDirection) {
    setMotorDriverMode(aMotorDirection);
}

void setMotorDriverMode(uint8_t aMotorDriverMode) {
  CurrentDirection = aMotorDriverMode;
  if (aMotorDriverMode == STOP_MODE_RELEASE) {
      // We want to store only directions, no brake mode
      CurrentDirection = DIRECTION_STOP;
  }
    switch (aMotorDriverMode) {
    case DIRECTION_FORWARD:
        digitalWrite(AIN2_R, LOW); // take low first to avoid 'break'
        digitalWrite(AIN1_R, HIGH);
        digitalWrite(BIN2_L, LOW); // take low first to avoid 'break'
        digitalWrite(BIN1_L, HIGH);
        break;
    case DIRECTION_BACKWARD:
        digitalWrite(AIN1_R, LOW); // take low first to avoid 'break'
        digitalWrite(AIN2_R, HIGH);
        digitalWrite(BIN1_L, LOW); // take low first to avoid 'break'
        digitalWrite(BIN2_L, HIGH);
        break;
    case STOP_MODE_BRAKE:
        digitalWrite(AIN1_R, HIGH);
        digitalWrite(AIN2_R, HIGH);
        digitalWrite(BIN1_L, HIGH);
        digitalWrite(BIN2_L, HIGH);
        break;
    case STOP_MODE_RELEASE:
        digitalWrite(AIN1_R, LOW);
        digitalWrite(AIN2_R, LOW);
        digitalWrite(BIN1_L, LOW);
        digitalWrite(BIN2_L, LOW);
        break;
    }
}

/*
 * First set PWM to 0 then set driver to stop mode
 * @param aStopMode STOP_MODE_KEEP (take previously defined DefaultStopMode) or STOP_MODE_BRAKE or STOP_MODE_RELEASE
 */
void stop(uint8_t aStopMode) {
  RequestedSpeedPWM = 0;
  CurrentCompensatedSpeedPWM = 0;
  MotorPWMHasChanged = true;
  CheckStopConditionInUpdateMotor = false;


    ledcWrite(MOTOR_PWMA_CHANNEL, 0);
    ledcWrite(MOTOR_PWMB_CHANNEL, 0);

  if (aStopMode == STOP_MODE_KEEP) {
    aStopMode = DefaultStopMode;
  }
  setMotorDriverMode(aStopMode);
}

/*
 *  RequestedSpeedPWM == 0, should be equivalent to MotorRampState == MOTOR_STATE_STOPPED
 */
bool isStopped() {
    return (RequestedSpeedPWM == 0);
}

/*
 * @return true if not stopped (motor expects another update)
 */
bool updateMotor() {
  unsigned long tMillis = millis();
  uint8_t tNewSpeedPWM = RequestedSpeedPWM;

  /*
  * Check if target distance is reached or encoder tick has timeout
  */
  if (tNewSpeedPWM > 0) {
    if (CheckStopConditionInUpdateMotor
            && (getDistanceMillimeter() >= TargetDistanceMillimeter
                    || tMillis > (LastEncoderInterruptMillis + ENCODER_SENSOR_TIMEOUT_MILLIS))) {
      /*
      * Stop now
      */
      stop(STOP_MODE_BRAKE); // this sets MOTOR_STATE_STOPPED;
      return false; // need no more calls to updateMotor()
    }
  }
  if (MotorRampState == MOTOR_STATE_START) {
    NextRampChangeMillis = tMillis + RAMP_INTERVAL_MILLIS;
    /*
    * Start motor
    */
    if (RequestedDriveSpeedPWM > RAMP_UP_VALUE_OFFSET_SPEED_PWM) {
      // start with ramp to avoid spinning wheels
      tNewSpeedPWM = RAMP_UP_VALUE_OFFSET_SPEED_PWM; // start immediately with speed offset (2.3 volt)
      //  --> RAMP_UP
#if defined(SERIAL_DEBUG)        
        Serial.printf("Ramp Up started at: %d\n", (EncoderCount * FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT));
#endif
      MotorRampState = MOTOR_STATE_RAMP_UP;
    } else {
      // Motor ramp not required, go direct to drive speed.
      tNewSpeedPWM = RequestedDriveSpeedPWM;
      //  --> DRIVE
      MotorRampState = MOTOR_STATE_DRIVE;
    }


  } else if (MotorRampState == MOTOR_STATE_RAMP_UP) {
    if (tMillis >= NextRampChangeMillis) {
      NextRampChangeMillis += RAMP_INTERVAL_MILLIS;
      /*
      * Increase motor speed by RAMP_VALUE_DELTA every RAMP_UPDATE_INTERVAL_MILLIS milliseconds
      * Transition criteria to next state is:
      * Drive speed reached or target distance - braking distance reached
      */
      if (tNewSpeedPWM == RequestedDriveSpeedPWM
              || (CheckStopConditionInUpdateMotor
                      && getDistanceMillimeter() + getBrakingDistanceMillimeter() >= TargetDistanceMillimeter)) {
        //  RequestedDriveSpeedPWM reached switch to --> DRIVE_SPEED_PWM and check immediately for next transition to RAMP_DOWN
#if defined(SERIAL_DEBUG)        
        Serial.printf("Drive started at: %d\n", (EncoderCount * FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT));
#endif
        MotorRampState = MOTOR_STATE_DRIVE;
      } else {
        tNewSpeedPWM = tNewSpeedPWM + RAMP_UP_VALUE_DELTA;
        // Clip value and check for 8 bit overflow
        if (tNewSpeedPWM > RequestedDriveSpeedPWM || tNewSpeedPWM <= RAMP_UP_VALUE_DELTA) {
          // do not change state here to let motor run at RequestedDriveSpeedPWM for one interval
          tNewSpeedPWM = RequestedDriveSpeedPWM;
        }
      }
    }
  }

  // do not use "else if" since we must immediately check for next transition to RAMP_DOWN
  if (MotorRampState == MOTOR_STATE_DRIVE) {
      /*
        * Wait until target distance - braking distance reached
        */
      if (CheckStopConditionInUpdateMotor && (getDistanceMillimeter() + getBrakingDistanceMillimeter() >= TargetDistanceMillimeter)) {
          if (RequestedSpeedPWM > RAMP_DOWN_VALUE_OFFSET_SPEED_PWM) {
              tNewSpeedPWM -= (RAMP_DOWN_VALUE_OFFSET_SPEED_PWM - RAMP_DOWN_VALUE_DELTA); // RAMP_VALUE_DELTA is immediately subtracted below
          } else {
              tNewSpeedPWM = RAMP_VALUE_MIN_SPEED_PWM;
          }
          //  --> RAMP_DOWN
#if defined(SERIAL_DEBUG)        
        Serial.printf("Ramp Down started at: %d\n", (EncoderCount * FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT));
#endif
          MotorRampState = MOTOR_STATE_RAMP_DOWN;
      }
  }

  // do not use "else if" since we must immediately check for next transition to STOPPED
  if (MotorRampState == MOTOR_STATE_RAMP_DOWN) {
      if (tMillis >= NextRampChangeMillis) {
          NextRampChangeMillis = tMillis + RAMP_INTERVAL_MILLIS;
          /*
            * Decrease motor speed RAMP_UPDATE_INTERVAL_STEPS times every RAMP_UPDATE_INTERVAL_MILLIS milliseconds
            * until RAMP_VALUE_MIN_SPEED_PWM is reached
            */
          if (tNewSpeedPWM == RAMP_VALUE_MIN_SPEED_PWM) {
              /*
                * Ramp ended, last value was RAMP_VALUE_MIN_SPEED_PWM
                */
              if(!CheckStopConditionInUpdateMotor){
                  // can stop now
                  tNewSpeedPWM = 0;
              } else {
                  // continue to check distance a slow speed
                  MotorRampState = MOTOR_STATE_CHECK_DISTANCE;
              }
          } else {
              tNewSpeedPWM -= RAMP_DOWN_VALUE_DELTA;
                  if (tNewSpeedPWM < RAMP_VALUE_MIN_SPEED_PWM) {
                  // Clip at RAMP_VALUE_MIN_SPEED_PWM
                  tNewSpeedPWM = RAMP_VALUE_MIN_SPEED_PWM;
              }
          }
      }
  }

  /*
    * End of motor state machine, now set speed if changed
    */
  if (tNewSpeedPWM != RequestedSpeedPWM) {
    setSpeedPWM(tNewSpeedPWM);
  }
  return (RequestedSpeedPWM > 0); // current speed == 0
}

unsigned int getDistanceMillimeter() {
    return EncoderCount * FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT; // * 11
}

/*
 * Use physical formula of accelerated mass s = (v * v) / 2 * a
 */
unsigned int getBrakingDistanceMillimeter() {
    unsigned int tSpeedCmPerSecond = getSpeed();
//    return (tSpeedCmPerSecond * tSpeedCmPerSecond * 100) / RAMP_DECELERATION_TIMES_2; // overflow!
    // RAMP_DECELERATION_TIMES_2 / 100 instead of tSpeedCmPerSecond * 100 to avoid overflow
    return (tSpeedCmPerSecond * tSpeedCmPerSecond) / (RAMP_DECELERATION_TIMES_2 / 100);
}

/*
 * Speed is in cm/s for a 20 slot encoder disc
 * Reset speed values after 1 second
 */
unsigned int getSpeed() {
    if (millis() - LastEncoderInterruptMillis > SPEED_TIMEOUT_MILLIS) {
        resetSpeedValues(); // Reset speed values after 1 second
    }
    unsigned long tEncoderInterruptDeltaMillis = EncoderInterruptDeltaMillis;
    if (tEncoderInterruptDeltaMillis == 0) {
        return 0;
    }
    return (SPEED_SCALE_VALUE / tEncoderInterruptDeltaMillis);
}

/*
 * Reset EncoderInterruptDeltaMillis, EncoderInterruptMillisArray, EncoderInterruptMillisArrayIndex and AverageSpeedIsValid
 */
void resetSpeedValues() {
    EncoderInterruptDeltaMillis = 0;
}



// Funções de giro ==================================================================================




// Função para giro por tempo
void startTurn(unsigned long duration_ms, int direction) {
    turnDuration = duration_ms;
    turnActive = true;
    turnStartTime = millis();

    int pwm = 150; // Velocidade de giro (PWM)

    if (direction > 0) {
        setMotorDifferential(-pwm, pwm); // Direita
    } else {
        setMotorDifferential(pwm, -pwm); // Esquerda
    }
}

bool updateTurn() {
    if (!turnActive) {
        return false;
    }

    if (millis() - turnStartTime >= turnDuration) {
        setMotorDifferential(0, 0);
        turnActive = false;
        Serial.println("Giro por tempo finalizado.");
        return false;
    }

    return true;
}

// Função para controle diferencial dos motores
void setMotorDifferential(int pwm_r, int pwm_l) {
    // Motor Direito
    if (pwm_r > 0) {
        digitalWrite(AIN2_R, LOW);
        digitalWrite(AIN1_R, HIGH);
        ledcWrite(MOTOR_PWMA_CHANNEL, pwm_r);
    } else if (pwm_r < 0) {
        digitalWrite(AIN1_R, LOW);
        digitalWrite(AIN2_R, HIGH);
        ledcWrite(MOTOR_PWMA_CHANNEL, -pwm_r);
    } else {
        digitalWrite(AIN1_R, LOW);
        digitalWrite(AIN2_R, LOW);
        ledcWrite(MOTOR_PWMA_CHANNEL, 0);
    }

    // Motor Esquerdo
    if (pwm_l > 0) {
        digitalWrite(BIN2_L, LOW);
        digitalWrite(BIN1_L, HIGH);
        ledcWrite(MOTOR_PWMB_CHANNEL, pwm_l);
    } else if (pwm_l < 0) {
        digitalWrite(BIN1_L, LOW);
        digitalWrite(BIN2_L, HIGH);
        ledcWrite(MOTOR_PWMB_CHANNEL, -pwm_l);
    } else {
        digitalWrite(BIN1_L, LOW);
        digitalWrite(BIN2_L, LOW);
        ledcWrite(MOTOR_PWMB_CHANNEL, 0);
    }
}


// Funções auxiliares ===============================================================================

// Faz o robô andar X metros (valores positivos = frente, negativos = ré)
void moveMeters(float meters) {
    if (meters == 0) {
        stop(DEFAULT_STOP_MODE);
        return;
    }
    
    unsigned int mm = abs(meters * 1000);
    uint8_t direction = (meters > 0) ? DIRECTION_FORWARD : DIRECTION_BACKWARD;
    uint8_t speed = 200; // Velocidade (ajustável)
    
    startGoDistanceMillimeterWithSpeed(speed, mm, direction);
    
    Serial.printf("Iniciando movimento: %.2f metros (%d mm) na direção %s\n", 
                  abs(meters), mm, (direction == DIRECTION_FORWARD) ? "FRENTE" : "RÉ");
}

// Faz o robô girar X graus (valores positivos = direita, negativos = esquerda)
void turnDegrees(int degrees) {
    if (degrees == 0) {
        return;
    }
    
    // Tempo para girar 90 graus
    const unsigned long TIME_90_DEGREES = 1000; // ms (ajustável)

    // Calcula tempo proporcional ao ângulo
    unsigned long time_ms = (abs(degrees) * TIME_90_DEGREES) / 90;
    
    // Direção: positivo = direita, negativo = esquerda
    int direction = (degrees > 0) ? 1 : -1;
    
    startTurn(time_ms, direction);
    
    Serial.printf("Iniciando giro: %d graus para %s (%lu ms)\n", 
                  abs(degrees), (direction > 0) ? "DIREITA" : "ESQUERDA", time_ms);
}

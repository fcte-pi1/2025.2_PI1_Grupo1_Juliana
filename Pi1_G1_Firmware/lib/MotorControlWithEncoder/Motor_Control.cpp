#include "Arduino.h"
#include "Motor_Control.h"
#include <pin_declaration.h>
#include <Wire.h>
#include "parser.h"
#include <mqtt.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <main.h>

#define DIREITA false
#define ESQUERDA true


extern Adafruit_MPU6050 mpu;
extern pos carrinho;
extern int graphBehaviour;

// ZUPT
const int janelaZupt = 20;
float janelaZ[janelaZupt];
int idxZ = 0;
int contadorEstavelZ = 0;
const float limiteZ = 0.015;  // limite ideal para "robô parado"

const float alfaZ = 0.1;     // Peso do filtro exponencial (quanto menor, mais suave)

float gyroBiasZ = 0.0;       // Bias dinâmico (vai sendo recalibrado)
float gyroEmaZ = 0.0;        // Filtro EMA
bool emaInit = false;
float previousDistance = 0.0;

// Variáveis para giro por tempo (fallback)
static bool turnActive = false;
static unsigned long turnStartTime = 0;
static unsigned long turnDuration = 0;

// Variáveis para giro por encoder
static bool turnWithEncoderActive = false;
static unsigned int turnTargetEncoderCount = 0;
static unsigned int turnStartEncoderCount = 0;
static unsigned int turnStartEncoderCountL = 0;
static int turnDirectionEncoder = 0;

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
int32_t SpeedPWMCompensation = 0;          // correção atual
const int16_t PWM_CORRECTION_MAX = 40;   // limite de correção (ajuste fino)
bool directionCompensationFlag = ESQUERDA; // indica qual motor recebe a compensação

const int8_t rightCompensation = 0;
const int8_t leftCompensation = 13;

// ===== Controle de direção (PID baseado no MPU6050) =====
float yawAngle = 0.0f;        // anguloAtual do MPU
float yawTarget = 0.0f;       // manter trajetória
float yawLastError = 0.0f;

static float yawIntegral = 0.0f;
static float yawDerivative = 0.0f;

unsigned long lastYawPidMillis = 0;

// Ganhos para PID com gyro/angulo
float Kp_yaw = 4.0f;
float Ki_yaw = 0.2;
float Kd_yaw = 0.7f;

// Limites
const float YAW_INTEGRAL_MAX = 500;

/*
    * Distance optocoupler impulse counter. It is reset at startGoDistanceCount if motor was stopped.
    * Both values are incremented at each encoder interrupt and reset at startGoDistanceMillimeter().
    */
volatile unsigned int EncoderCount; // 11 mm for a 220 mm Wheel and 20 encoder slots reset at startGoDistanceMillimeter
volatile unsigned int EncoderCountForSynchronize; // count used and modified by function
volatile unsigned int EncoderCountL; // 11 mm for a 220 mm Wheel and 20 encoder slots reset at startGoDistanceMillimeter
volatile unsigned int EncoderCountForSynchronizeL; // count used and modified by function


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
volatile unsigned long EncoderInterruptDeltaMillisL; // Used to get speed

// Do not move it!!! It must be the last element in structure and is required for stopMotorAndReset()
volatile unsigned long LastEncoderInterruptMillisL; // used internal for debouncing and lock/timeout detection

int32_t SpeedPWMTurnCompensation = 5;          // correção atual
int pwm_r = 80; // vel de giro (PWM)
int pwm_l = 80; // vel de giro (PWM)
bool stoped_r = false;
bool stoped_l = false;

void resetSpeedValues(); 
unsigned int getBrakingDistanceMillimeter();
// unsigned int getDistanceMillimeter() ;
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
void atualizarAnguloMPU();
int32_t updateYawSynchronization();
// int32_t updatePWMSynchronization();


//=======================================================================
void AtualizaPosicao (float dist){
  if(graphBehaviour == SOMA_X){
    carrinho.x += (int)roundf(dist/10.0);
  }else if (graphBehaviour == SUBTRAI_Y){
    carrinho.y -= (int)roundf(dist/10.0);
  }else if (graphBehaviour == SUBTRAI_X){
    carrinho.x -= (int)roundf(dist/10.0);
  }else if (graphBehaviour == SOMA_Y){
    carrinho.y += (int)roundf(dist/10.0);
  }
}

void IRAM_ATTR handleEncoderInterrupt() {
    static uint32_t lastMicrosR = 0;
    uint32_t now = micros();
    if (now - lastMicrosR < 5000) return;   // ignore pulsos dentro de 500u
    lastMicrosR = now;  
    LastEncoderInterruptMillis = millis();
    EncoderCount++;
    EncoderCountForSynchronize++;
}
void IRAM_ATTR handleEncoderInterruptL() {
    static uint32_t lastMicrosL = 0;
    uint32_t now = micros();
    if (now - lastMicrosL < 5000) return;   // ignore pulsos dentro de 500u
    lastMicrosL = now;  
    EncoderCountL++;
    EncoderCountForSynchronizeL++;
}

void resetErrorsPID() {
    yawIntegral = 0;
    yawLastError = 0;
    yawDerivative = 0;
}

void atualizarAnguloMPU() {

    static unsigned long ultimoTempo = millis();
    unsigned long agora = millis();
    float dt = (agora - ultimoTempo) / 1000.0;
    ultimoTempo = agora;

    sensors_event_t a, g, temp;

    mpu.getEvent(&a, &g, &temp);

    float gyroZ = g.gyro.z - gyroBiasZ;

    if (!emaInit) {
        gyroEmaZ = gyroZ;
        emaInit = true;
    } else {
        gyroEmaZ = alfaZ * gyroZ + (1 - alfaZ) * gyroEmaZ;
    }

    yawAngle += gyroEmaZ * dt * 180.0 / PI;

    if (yawAngle > 180) yawAngle -= 360;
    if (yawAngle < -180) yawAngle += 360;

    // ZUPT
    janelaZ[idxZ] = gyroEmaZ;
    idxZ = (idxZ + 1) % janelaZupt;

    float soma = 0;
    for (int i = 0; i < janelaZupt; i++) soma += fabs(janelaZ[i]);
    float mediaZ = soma / janelaZupt;

    if (mediaZ < limiteZ) {
        contadorEstavelZ++;
        if (contadorEstavelZ > 20) {
            gyroBiasZ += gyroEmaZ * 0.05;
            contadorEstavelZ = 0;
        }
    }
}

float angularError(float target, float current) {
    float e = target - current;
    while (e > 180) e -= 360;
    while (e < -180) e += 360;
    return e;
}

int32_t updateYawSynchronization() {
    atualizarAnguloMPU();

    unsigned long now = millis();
    float dt = (now - lastYawPidMillis) / 1000.0f;
    if (dt <= 0) return 0;
    lastYawPidMillis = now;

    // erro: diferença entre angulo atual e angulo alvo
    float error = angularError(yawTarget, yawAngle);
    float absError = fabs(error);

    // direção da correção
    if (error > 0) {
        directionCompensationFlag = ESQUERDA;
    } else if (error < 0) {
        directionCompensationFlag = DIREITA; // puxa para esquerda → reduz esquerda
    } else {
        directionCompensationFlag = 0;
    }

    // ====== PID ======
    float P = Kp_yaw * error;

    yawIntegral += error * dt;
    if (yawIntegral > YAW_INTEGRAL_MAX) yawIntegral = YAW_INTEGRAL_MAX;
    if (yawIntegral < -YAW_INTEGRAL_MAX) yawIntegral = -YAW_INTEGRAL_MAX;

    float I = Ki_yaw * yawIntegral;

    yawDerivative = (error - yawLastError) / dt;
    yawLastError = error;

    float D = Kd_yaw * yawDerivative;

    float pidOut = P + I + D;

    SpeedPWMCompensation = (int32_t)fabs(pidOut);
    if (SpeedPWMCompensation > PWM_CORRECTION_MAX)
        SpeedPWMCompensation = PWM_CORRECTION_MAX;

    // // debug
    // mqtt_send_telemetry_kv_num("esp/debug", "yaw", yawAngle);
    // mqtt_send_telemetry_kv_num("esp/debug", "yawError", error);
    // mqtt_send_telemetry_kv_num("esp/debug", "yawPID", pidOut);
    // mqtt_send_telemetry_kv_num("esp/debug", "yawIntegral", yawIntegral);

    return absError;
}

void MotorInit(){
  pinMode(PWMA_R, OUTPUT);
  pinMode(AIN2_R, OUTPUT);
  pinMode(AIN1_R, OUTPUT);
  pinMode(STBY, OUTPUT);
  pinMode(BIN2_L, OUTPUT);
  pinMode(BIN1_L, OUTPUT);
  pinMode(PWMB_L, OUTPUT);

  ledcSetup(MOTOR_PWMA_CHANNEL, MOTOR_PWM_FREQUENCY, MOTOR_PWM_RESOLUTION);
  ledcSetup(MOTOR_PWMB_CHANNEL, MOTOR_PWM_FREQUENCY, MOTOR_PWM_RESOLUTION);

  ledcAttachPin(PWMA_R, MOTOR_PWMA_CHANNEL);
  ledcAttachPin(PWMB_L, MOTOR_PWMB_CHANNEL);
}

void encoderInit (){
  pinMode(ENC1_R, INPUT);
  attachInterrupt(digitalPinToInterrupt(ENC1_R), handleEncoderInterrupt, RISING);
  pinMode(ENC2_L, INPUT);
  attachInterrupt(digitalPinToInterrupt(ENC2_L), handleEncoderInterruptL, RISING);
}
/*
 * If motor is already running, adjust TargetDistanceMillimeter to go to aRequestedDistanceMillimeter
 */
void startGoDistanceMillimeterWithSpeed(uint8_t aRequestedSpeedPWM, unsigned int aRequestedDistanceMillimeter,
        uint8_t aRequestedDirection) {
#if defined(SERIAL_DEBUG)        
        Serial.printf("Distance ratio: %f\n", FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT);
#endif
    if (aRequestedDistanceMillimeter == 0) {
        stop(DefaultStopMode); // In case motor was running
        return;
    }
    atualizarAnguloMPU();
    yawTarget = yawAngle;
    resetEncoderControlValues();
    if (RequestedSpeedPWM == 0) {
        TargetDistanceMillimeter = aRequestedDistanceMillimeter;
        setSpeedPWMAndDirectionWithRamp(aRequestedSpeedPWM, aRequestedDirection);
    } else {
        /*
         * Already moving
         */
        TargetDistanceMillimeter = getDistanceMillimeter(true) + aRequestedDistanceMillimeter;
        setSpeedPWMAndDirection(aRequestedSpeedPWM, aRequestedDirection);
    }
    LastTargetDistanceMillimeter = TargetDistanceMillimeter;
    CheckStopConditionInUpdateMotor = true;
}

void resetEncoderControlValues() {
  EncoderCount = 0;
  EncoderCountL = 0;
  EncoderCountForSynchronize = 0;
  previousDistance = 0.0;
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

    uint8_t rightPwm = RequestedSpeedPWM;
    uint8_t leftPwm  = RequestedSpeedPWM;

    /*
     * Handle PID compensation
     */
    if (directionCompensationFlag == DIREITA) {
        // direita mais rápida → reduz direita
        // if (SpeedPWMCompensation > rightPwm) SpeedPWMCompensation = rightPwm;
            rightPwm -= (SpeedPWMCompensation + rightCompensation);
        CurrentCompensatedSpeedPWM = rightPwm;
    } else {
        // esquerda mais rápida → reduz esquerda
        // if (SpeedPWMCompensation > leftPwm) SpeedPWMCompensation = leftPwm;
        leftPwm -= (SpeedPWMCompensation + leftCompensation);
        CurrentCompensatedSpeedPWM = leftPwm;
    }

#if defined(SERIAL_DEBUG)
    // Serial.printf("PWM direita: %d\n", rightPwm);
    // Serial.printf("PWM esquerda: %d\n", leftPwm);
#endif

    // mqtt_send_telemetry_kv_num("esp/debug", "integral", yawIntegral); 
    // mqtt_send_telemetry_kv_num("esp/debug", "derivative", yawDerivative); 
    // mqtt_send_telemetry_kv_num("esp/debug", "error", angularError(yawTarget, yawAngle)); 
    // mqtt_send_telemetry_kv_num("esp/debug", "rightPwm", rightPwm); 
    // mqtt_send_telemetry_kv_num("esp/debug", "leftPwm", leftPwm); 

    ledcWrite(MOTOR_PWMA_CHANNEL, rightPwm);
    ledcWrite(MOTOR_PWMB_CHANNEL, leftPwm);
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

  int32_t error = updateYawSynchronization();

  /*
  * Check if target distance is reached or encoder tick has timeout
  */
  if (tNewSpeedPWM > 0) {
    if (CheckStopConditionInUpdateMotor
            && (getDistanceMillimeter(true) >= TargetDistanceMillimeter
                    || tMillis > (LastEncoderInterruptMillis + ENCODER_SENSOR_TIMEOUT_MILLIS))) {
      /*
      * Stop now
      */
      stop(STOP_MODE_BRAKE); // this sets MOTOR_STATE_STOPPED;
        mqtt_send_telemetry_kv_num("esp/debug", "pulse_R", EncoderCount);
        mqtt_send_telemetry_kv_num("esp/debug", "pulse_L", EncoderCountL);  
        // mqtt_send_telemetry_kv_num("esp/debug", "distancia_mm", getDistanceMillimeter(false));  
#if defined(SERIAL_DEBUG)      
        Serial.printf("Brake at: %f, %d/%d pulses\n", (EncoderCount * FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT), EncoderCountL, EncoderCount);
#endif
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
        Serial.printf("Ramp Up started at: %f\n", (EncoderCount * FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT));
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
                      && getDistanceMillimeter(true) + getBrakingDistanceMillimeter() >= TargetDistanceMillimeter)) {
        //  RequestedDriveSpeedPWM reached switch to --> DRIVE_SPEED_PWM and check immediately for next transition to RAMP_DOWN
#if defined(SERIAL_DEBUG)        
        Serial.printf("Drive started at: %f\n", (EncoderCount * FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT));
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
        if (CheckStopConditionInUpdateMotor && (getDistanceMillimeter(true) + getBrakingDistanceMillimeter() >= TargetDistanceMillimeter)) {
          if (RequestedSpeedPWM > RAMP_DOWN_VALUE_OFFSET_SPEED_PWM) {
              tNewSpeedPWM -= (RAMP_DOWN_VALUE_OFFSET_SPEED_PWM - RAMP_DOWN_VALUE_DELTA); // RAMP_VALUE_DELTA is immediately subtracted below
          } else {
              tNewSpeedPWM = RAMP_VALUE_MIN_SPEED_PWM;
          }
          //  --> RAMP_DOWN
#if defined(SERIAL_DEBUG)        
        Serial.printf("Ramp Down started at: %f\n", (EncoderCount * FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT));
#endif
          MotorRampState = MOTOR_STATE_RAMP_DOWN;
        }
        if(error > 0){
            setSpeedPWM(tNewSpeedPWM); // update speed to apply synchronization correction
            return true;
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

float getDistanceMillimeter(bool update) {
    float distance = ((EncoderCount + EncoderCountL) / 2)* FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT;
    if(update){
        AtualizaPosicao((distance - previousDistance));
        previousDistance = distance;
    }
    mqtt_send_pos("telemetry", "pos_x", "pos_y", carrinho.x, carrinho.y);
    return distance; // * 11
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




// ===== GIRAR USANDO O PID E A MPU =====

void startTurn(int degrees) {
    if (degrees == 0) return;

    atualizarAnguloMPU(); // garante yawAngle atualizado

    // define alvo absoluto e normaliza para -180..180
    yawTarget = yawAngle + (float)degrees;
    if (yawTarget > 180.0f) yawTarget -= 360.0f;
    if (yawTarget <= -180.0f) yawTarget += 360.0f;

    // reset do PID de yaw para evitar "herança" de erro
    yawIntegral = 0.0f;
    yawLastError = 0.0f; // evita derivadas enormes no primeiro passo

    int pwm = 100; // ajuste conforme necessário

    // calcula erro menor caminho e decide sentido
    float err = angularError(yawTarget, yawAngle); // target - current normalizado
    if (err > 0.0f) {
        // err positivo = faltam graus POSITIVOS -> girar para esquerda (CCW)
        setMotorDifferential(pwm, -pwm);
    } else {
        // err negativo -> girar para direita (CW)
        setMotorDifferential(-pwm, pwm);
    }

    turnActive = true;
}

bool updateTurn() {
    if (!turnActive) return false;

    atualizarAnguloMPU();

    // erro pelo menor caminho (target - current)
    float err = angularError(yawTarget, yawAngle);
    float absErr = fabs(err);

    const float TURN_THRESHOLD_DEG = 0.5f; // ajuste fino: 1..3 graus

    // se dentro do limiar, parar e marcar fim do giro
    if (absErr <= TURN_THRESHOLD_DEG) {
        setMotorDifferential(0, 0);
        turnActive = false;

        // limpar integrador / derivador para não estragar próximo comando
        yawIntegral = 0.0f;
        yawLastError = 0.0f;
        return false;
    }

    // Opcional: controle PID para o giro (substitui velocidade fixa)
    // Exemplo simples: usa pidOut para reduzir pwm conforme aproxima
    float dt = (millis() - lastYawPidMillis) / 1000.0f;
    if (dt <= 0) dt = 0.01f;
    lastYawPidMillis = millis();

    float P = Kp_yaw * err;
    yawIntegral += err * dt;
    // anti-windup
    if (yawIntegral > YAW_INTEGRAL_MAX) yawIntegral = YAW_INTEGRAL_MAX;
    if (yawIntegral < -YAW_INTEGRAL_MAX) yawIntegral = -YAW_INTEGRAL_MAX;
    float I = Ki_yaw * yawIntegral;
    float D = Kd_yaw * ((err - yawLastError) / dt);
    yawLastError = err;
    float pidOut = P + I + D;

    // pidOut pode ser grande; limite-o a uma faixa de pwm desejada
    float pwmMaxTurn = 130.0f; // ajuste: valor máximo de PWM para giro
    float pwmCmd = fabs(pidOut);
    if (pwmCmd > pwmMaxTurn) pwmCmd = pwmMaxTurn;
    if (pwmCmd < 90.0f) pwmCmd = 90.0f; // evita perder torque (deadzone)

    // escolhe direção com base no sinal do erro (err > 0 -> left)
    if (err > 0.0f) {
        setMotorDifferential((int)pwmCmd, -(int)pwmCmd); // left turn
    } else {
        setMotorDifferential(-(int)pwmCmd, (int)pwmCmd); // right turn
    }

    return true;
}


// Função para giro por encoder
void startTurnWithEncoder(int degrees) {
    if (degrees == 0) {
        return;
    }
    resetEncoderControlValues();
    stoped_r = false;
    stoped_l = false;
    
    // calcula qtd pulsos p girar
    unsigned int encoder_counts_needed = (abs(degrees) * ENCODER_COUNTS_PER_90_DEGREES) / 90; // ajustavel
    
    turnTargetEncoderCount = encoder_counts_needed;
    turnStartEncoderCount = EncoderCount;
    turnStartEncoderCountL = EncoderCountL;
    turnDirectionEncoder = (degrees > 0) ? 1 : -1;
    turnWithEncoderActive = true;
    
    pwm_r = 120; // vel de giro (PWM)
    pwm_l = 120; // vel de giro (PWM)
    
    if (turnDirectionEncoder > 0) {
        pwm_r = -pwm_r;
        setMotorDifferential(pwm_r, pwm_l); // Direita
    } else {
        pwm_l = -pwm_l;
        setMotorDifferential(pwm_r, pwm_l); // Esquerda
    }
    
    #ifdef SERIAL_DEBUG
    Serial.printf("Iniciando giro: %d graus (%d pulsos)\n", 
                  abs(degrees), encoder_counts_needed);
    #endif
}

bool updateTurnWithEncoder() {
    if (!turnWithEncoderActive) {
        return false;
    }
    
    // quantos pulsos já foram percorridos
    unsigned int encoder_counts_traveled_r = EncoderCount - turnStartEncoderCount;
    unsigned int encoder_counts_traveled_l = EncoderCountL - turnStartEncoderCountL;
    unsigned int encoder_counts_remaining = turnTargetEncoderCount - encoder_counts_traveled_r;
    
    // Debug a cada 100ms
    #ifdef SERIAL_DEBUG
    static unsigned long lastDebugPrint = 0;
    if (millis() - lastDebugPrint > 100) {
        Serial.printf("Pulsos: %d/%d (faltam %d)\n", 
                      encoder_counts_traveled, turnTargetEncoderCount, encoder_counts_remaining);
        lastDebugPrint = millis();
    }
    #endif
    
    // verifica se atingiu o alvo
    if (encoder_counts_traveled_l >= turnTargetEncoderCount) {
        pwm_l = 0;
        setMotorDifferential(pwm_r, pwm_l);
        stoped_l = true;
    }
    if (encoder_counts_traveled_r >= turnTargetEncoderCount) {
        pwm_r = 0;
        setMotorDifferential(pwm_r, pwm_l);
        stoped_r = true;
    }
    if (stoped_r && stoped_l) {
        turnWithEncoderActive = false;
        // mqtt_send_telemetry_kv_num("esp/debug", "trn_pulse_R", EncoderCount);
        // mqtt_send_telemetry_kv_num("esp/debug", "trn_pulse_L", EncoderCountL); 
        return false;
    }
    // // reduz vel próximo ao alvo p evitar ultrapassar
    // if (encoder_counts_remaining <= 2) {
    //      pwm = 80;
    //     if (turnDirectionEncoder > 0) {
    //         setMotorDifferential(-pwm, pwm);
    //     } else {
    //         setMotorDifferential(pwm, -pwm);
    //     }
    // }

    // // timeout de 5 segundos
    // static unsigned long turnStartTimeEncoder = 0;
    // if (encoder_counts_traveled == 0 && turnStartTimeEncoder == 0) {
    //     turnStartTimeEncoder = millis();
    // }
    // if (millis() - turnStartTimeEncoder > 5000) {
    //     setMotorDifferential(0, 0);  
    //     turnWithEncoderActive = false;
    //     turnStartTimeEncoder = 0;
    //     Serial.println("TIMEOUT: Giro por encoder excedeu 5 segundos!");
    //     return false;
    // }
    // if (encoder_counts_traveled > 0) {
    //     turnStartTimeEncoder = 0; // reset timeout se já está girando
    // }
    
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
        digitalWrite(AIN1_R, HIGH);
        digitalWrite(AIN2_R, HIGH);
        ledcWrite(MOTOR_PWMA_CHANNEL, 0);
    }

    // Motor Esquerdo
    if (pwm_l > 0) {
        digitalWrite(BIN2_L, LOW);
        digitalWrite(BIN1_L, HIGH);
        ledcWrite(MOTOR_PWMB_CHANNEL, (pwm_l - SpeedPWMTurnCompensation));
    } else if (pwm_l < 0) {
        digitalWrite(BIN1_L, LOW);
        digitalWrite(BIN2_L, HIGH);
        ledcWrite(MOTOR_PWMB_CHANNEL, ((-pwm_l) - SpeedPWMTurnCompensation));
    } else {
        digitalWrite(BIN1_L, HIGH);
        digitalWrite(BIN2_L, HIGH);
        ledcWrite(MOTOR_PWMB_CHANNEL, 0);
    }
}


// Funções auxiliares ===============================================================================

// Faz o robô andar X metros (valores positivos = frente, negativos = ré)
void moveMillimeters(float millimeters) {
    if (millimeters == 0) {
        stop(DEFAULT_STOP_MODE);
        return;
    }
    
    unsigned int mm = abs(millimeters);
    uint8_t direction = (millimeters > 0) ? DIRECTION_FORWARD : DIRECTION_BACKWARD;
    uint8_t speed = 200; // Velocidade (ajustável)
    
    startGoDistanceMillimeterWithSpeed(speed, mm, direction);
    
    Serial.printf("Iniciando movimento: %.2f milímetros (%d mm) na direção %s\n", 
                  abs(millimeters), mm, (direction == DIRECTION_FORWARD) ? "FRENTE" : "RÉ");
}

// Faz o robô girar X graus (valores positivos = direita, negativos = esquerda)
void turnDegrees(int degrees) {
    if (degrees == 0) {
        return;
    }
    
    // startTurnWithEncoder(degrees);
    startTurn(degrees);
    Serial.printf("Iniciando giro,: %d graus para %s\n", 
                  abs(degrees), (degrees > 0) ? "DIREITA" : "ESQUERDA");
    
    /* antigo, para caso de fallback
    const unsigned long TIME_90_DEGREES = 530; // ms (ajustável)
    unsigned long time_ms = (abs(degrees) * TIME_90_DEGREES) / 90;
    int direction = (degrees > 0) ? 1 : -1;
    startTurn(time_ms, direction);
    Serial.printf("Iniciando giro POR TEMPO: %d graus para %s (%lu ms)\n", 
                  abs(degrees), (direction > 0) ? "DIREITA" : "ESQUERDA", time_ms);
    */
}

#include "Arduino.h"

#define FULL_BRIDGE_LOSS_MILLIVOLT             0
#define FULL_BRIDGE_INPUT_MILLIVOLT 6000// Default. For 4 x AA batteries (6 volt).

/*
 * Ramp control
 */
#define MOTOR_STATE_STOPPED     0
#define MOTOR_STATE_START       1
#define MOTOR_STATE_RAMP_UP     2
#define MOTOR_STATE_DRIVE       3
#define MOTOR_STATE_RAMP_DOWN   4
#define MOTOR_STATE_CHECK_DISTANCE 5


#define DEFAULT_STOP_MILLIVOLT_MOSFET       700 // Voltage where spinning motors start to stop
#define DEFAULT_START_MILLIVOLT_MOSFET      3000 // Voltage where motors start to turn
#define DEFAULT_DRIVE_MILLIVOLT             4500 // Drive voltage -motors default speed- is 2.0 volt

// Motor directions and stop modes. Are used for parameter aMotorDriverMode and sequence is determined by the Adafruit library API.
#define DIRECTION_STOP                  0x00 // 0 is also turn in place
#define DIRECTION_FORWARD               0x01
#define DIRECTION_BACKWARD              0x02
#define DIRECTION_FORWARD_BACKWARD_MASK (DIRECTION_FORWARD | DIRECTION_BACKWARD)
#define oppositeDIRECTION(aDirection)   (aDirection ^ DIRECTION_FORWARD_BACKWARD_MASK) // invert every bit
/*
 * Stop mode definitions
 */
#define STOP_MODE_BRAKE                 0x00
#define STOP_MODE_RELEASE               0x03
#define DEFAULT_STOP_MODE               STOP_MODE_BRAKE
#define STOP_MODE_KEEP                  1 // Take DefaultStopMode - used only as parameter for stop()

#define MILLIS_IN_ONE_SECOND            1000L
#define MILLIMETER_IN_ONE_CENTIMETER    10L

// Effective voltage available for the motor
#define FULL_BRIDGE_OUTPUT_MILLIVOLT        (FULL_BRIDGE_INPUT_MILLIVOLT - FULL_BRIDGE_LOSS_MILLIVOLT)

/*
 * 20 slot Encoder generates 4 to 5 Hz at min speed and 110 Hz at max speed => 200 to 8 ms per period
 */
#define ENCODER_COUNTS_PER_FULL_ROTATION    20
#define ENCODER_SENSOR_RING_MILLIS          4
#define ENCODER_SENSOR_TIMEOUT_MILLIS       400L // Timeout for encoder ticks if motor is running
#define SPEED_TIMEOUT_MILLIS                1000 // After this timeout for encoder interrupts speed values are reset

#define MAX_SPEED_PWM                        255L // Long constant, otherwise we get "integer overflow in expression"


#define DEFAULT_CIRCUMFERENCE_MILLIMETER     204
#define FACTOR_COUNT_TO_MILLIMETER_INTEGER_DEFAULT  ((DEFAULT_CIRCUMFERENCE_MILLIMETER + (ENCODER_COUNTS_PER_FULL_ROTATION / 2)) / ENCODER_COUNTS_PER_FULL_ROTATION) // = 11

/*
 * The millis per tick have the unit [ms]/ (circumference[cm]/countsPerCircumference) -> ms/cm
 * To get cm/s, use (circumference[cm]/countsPerCircumference) * 1000 / millis per tick
 */
#define SPEED_SCALE_VALUE ((100L * DEFAULT_CIRCUMFERENCE_MILLIMETER) / ENCODER_COUNTS_PER_FULL_ROTATION) // 1100


// Corresponds to 2 volt. At 2 volt I measured around 32 cm/s. PWM=127 for 4 volt VCC, 68 for 7.4 volt VCC
#define DEFAULT_DRIVE_SPEED_PWM             (((DEFAULT_DRIVE_MILLIVOLT * MAX_SPEED_PWM) + (FULL_BRIDGE_OUTPUT_MILLIVOLT / 2)) / FULL_BRIDGE_OUTPUT_MILLIVOLT)


/*******************************************************
 * RAMP values for an offset of 2.3V and a ramp of 10V/s
 *******************************************************/
#define SPEED_PWM_FOR_1_VOLT             ((1000 * MAX_SPEED_PWM) / FULL_BRIDGE_OUTPUT_MILLIVOLT)
#define RAMP_UP_VOLTAGE_PER_SECOND       12 // 12 * 130 mm/s = 1560 mm/s ^2
#define RAMP_DOWN_VOLTAGE_PER_SECOND     14 // 14 * 130 mm/s = 1820 mm/s ^2

#define RAMP_INTERVAL_MILLIS             20
/*
 * Start positive or negative acceleration with this voltage offset in order to get a reasonable acceleration for ramps
 * The value must be low enough to avoid spinning wheels
 * I measured maximum brake acceleration with blocking wheels as 320 to 350 cm/s^2 on varnished wood. 6 to 7 cm/s every 20 ms.
 * I measured maximum positive acceleration with spinning wheels as 2000 to 2500 mm/s^2 on varnished wood. 4 to 5 cm/s every 20 ms.
 * Measured values up:   1V -> 1600mm/s^2, 2.5V -> 2000mm/s^2, the optimum. 3000 leads to spinning wheels.
 * Measured values down: 2.5V -> 2500mm/s^2
 */
#define RAMP_UP_VALUE_OFFSET_MILLIVOLT   3000 // Above DEFAULT_DRIVE_MILLIVOLT to avoid ramps for turns
#define RAMP_UP_VALUE_OFFSET_SPEED_PWM   ((RAMP_UP_VALUE_OFFSET_MILLIVOLT * (long)MAX_SPEED_PWM) / FULL_BRIDGE_OUTPUT_MILLIVOLT)
#define RAMP_DOWN_VALUE_OFFSET_MILLIVOLT 3000 // Experimental value. 3000 may be optimum.
#define RAMP_DOWN_VALUE_OFFSET_SPEED_PWM ((RAMP_UP_VALUE_OFFSET_MILLIVOLT * (long)MAX_SPEED_PWM) / FULL_BRIDGE_OUTPUT_MILLIVOLT)
#define RAMP_VALUE_MIN_SPEED_PWM         DEFAULT_DRIVE_SPEED_PWM // Maximal speed, where motor can be stopped immediately
#define RAMP_UP_VALUE_DELTA              ((SPEED_PWM_FOR_1_VOLT * RAMP_UP_VOLTAGE_PER_SECOND) / (MILLIS_IN_ONE_SECOND / RAMP_INTERVAL_MILLIS))
#define RAMP_DOWN_VALUE_DELTA            ((SPEED_PWM_FOR_1_VOLT * RAMP_DOWN_VOLTAGE_PER_SECOND) / (MILLIS_IN_ONE_SECOND / RAMP_INTERVAL_MILLIS))
#if (RAMP_DOWN_VALUE_DELTA > RAMP_VALUE_MIN_SPEED_PWM)
#error RAMP_DOWN_VALUE_DELTA must be smaller than RAMP_VALUE_MIN_SPEED_PWM !
#endif
#define RAMP_DECELERATION_TIMES_2        (2000 * 2) // 2000 was measured by IMU for 14V/s and 2500 mV offset.



//-------------------Function prototypes

void encoderInit ();

void startGoDistanceMillimeterWithSpeed(uint8_t aRequestedSpeedPWM, unsigned int aRequestedDistanceMillimeter,
        uint8_t aRequestedDirection);

bool updateMotor();
unsigned int getDistanceMillimeter();

// Funções para giro por tempo
void startTurn(unsigned long duration_ms, int direction);
bool updateTurn();

// Funções auxiliares pra andar e girar
void moveMeters(float meters);
void turnDegrees(int degrees);

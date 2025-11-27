#include <Arduino.h>

//----------------------------------------Pins declarations---------------------------------
//Encoders
static const uint8_t ENC1_R = 17;
static const uint8_t ENC2_L = 16;
//Ponte H / Motores
static const uint8_t PWMA_R = 32;
static const uint8_t AIN2_R = 33;
static const uint8_t AIN1_R = 25;
static const uint8_t STBY = 26;
static const uint8_t BIN2_L = 27;
static const uint8_t BIN1_L = 14;
static const uint8_t PWMB_L = 13;
//Servo
static const uint8_t PWM_SERVO = 18;
//I2C
// static const uint8_t SDA = 21;
// static const uint8_t SCL = 22;

//Motors PWMs
static const int MOTOR_PWM_FREQUENCY = 1000;
static const uint8_t MOTOR_PWM_RESOLUTION = 8;
static const uint8_t MOTOR_PWMA_CHANNEL = 1;
static const uint8_t MOTOR_PWMB_CHANNEL = 2;


// #define SERIAL_DEBUG
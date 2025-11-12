#include "Arduino.h"
#include "Sg90.h"


//Sg90 PWM
static const int SG90_PWM_FREQUENCY = 50;
static const uint8_t SG90_PWM_RESOLUTION = 8;
static const uint8_t SG90_PWM_CHANNEL = 0;

void Sg90::attach(int pin){
	pinMode(pin, OUTPUT);
	ledcSetup(SG90_PWM_CHANNEL, SG90_PWM_FREQUENCY, SG90_PWM_RESOLUTION);
	ledcAttachPin(pin, 0);
}

void Sg90::write(int value){
  int duty = (value / (6.92)) + 7;
  ledcWrite(SG90_PWM_CHANNEL, duty);
  delay(500);
}
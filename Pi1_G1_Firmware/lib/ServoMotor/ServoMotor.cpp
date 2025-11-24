#include "ServoMotor.h"

Sg90 servoMotor;

namespace {
  int servoAnguloInicial = 0;         // posição inicial do servo
  int servoAnguloDestino = 0;         // posição final temporária
  unsigned long servoTempoInicio = 0; // momento em que o movimento começou
  unsigned long servoTempoDuracao = 0;// tempo de espera antes de voltar
  bool servoEmMovimento = false;      // indica se o servo está em movimento
}

//Inicializa o servo e define o ângulo inicial
void ServoSetup(int pin, int anguloInicial) {
  servoAnguloInicial = anguloInicial;
  servoMotor.attach(pin);
  servoMotor.write(servoAnguloInicial);
}

//Gira o servo até o ângulo final e volta após o tempo indicado 
void MovimentaServo(int anguloFinal, unsigned long tempo) {
  unsigned long tempoAtual = millis();

  // Inicia o movimento se o servo estiver parado
  if (!servoEmMovimento) {
    servoAnguloDestino = anguloFinal;
    servoTempoDuracao = tempo;
    servoTempoInicio = tempoAtual;
    servoEmMovimento = true;
    servoMotor.write(servoAnguloDestino); // gira para a posição final
    while ((millis() - servoTempoInicio) < servoTempoDuracao){
    }
    servoMotor.write(servoAnguloInicial); // volta para o início
    servoEmMovimento = false;             // libera para próxima chamada

  }
}

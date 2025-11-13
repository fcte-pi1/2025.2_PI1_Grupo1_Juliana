#include <Arduino.h>
#include <MonitorEnergia.h>
#include <mqtt.h>
#include <WiFi.h>
// #include <ServoMotor.h>  // Servo
#include <pin_declaration.h>
#include "Motor_Control.h"

// Constantes de calibração
// Tempo em milissegundos para girar 90 graus.
#define TURN_90_DEGREES_MS 1000 

#define WIFI_SSID     "Wokwi-GUEST"
#define WIFI_PASSWORD ""
#define WIFI_CHANNEL  6

// Fila de Comandos 
// F = Frente, T = Trás, D = Direita, E = Esquerda
char commandQueue[10];
int commandCount = 0;
int currentCommandIndex = 0;
bool executingCommand = false;

hw_timer_t * inaTmr = NULL;
MonitorEnergia ina219;

const float V_nominal = 6.0;
const float Capacidade_Ah = 2.7;
float EnergiaTotal;
float EnergiaConsumida = 0;
unsigned long ultimoTempo;
volatile bool inaUpdateFlag = false;

void IRAM_ATTR InaTmrISR(){
  inaUpdateFlag = true;
}

void handleSerialInput();
void executeNextCommand();
void processLoop();

void setup() {
  Serial.begin(115200);
  delay(100);

  //Encoders Setup
  encoderInit ();

  //Motors & H Bridge Setup
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
  
  // wifi_connect(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);

  //Timer Setup
  inaTmr = timerBegin(0,80,true);
  timerAttachInterrupt(inaTmr, &InaTmrISR, true);
  timerAlarmWrite(inaTmr, 3000000, true);

  if (!ina219.iniciar()) {
    Serial.println("ERRO: Sensor INA219 não encontrado!");
    while (1) delay(10);
  }

  EnergiaTotal = V_nominal * Capacidade_Ah * 3600.0;
  ultimoTempo = millis();

// mqtt_init();

/* Servo

ServoSetup(PWM_SERVO, 0); // Servo no pino 18, começa em 0°
MovimentaServo(90, 5000); // Aqui estamos fazendo o servo girar 90° por 5 segundos
Serial.println("Servo inicializado!");

*/
  
  digitalWrite(STBY, HIGH);
  
  timerAlarmEnable(inaTmr);
  Serial.println("Monitor de energia iniciado!");
  Serial.println("Aguardando comandos:");
  
  // Teste para boot, comente para não executar automaticamente
  /* */
  delay(3000); // Aguarda 3 segundos após boot
  commandQueue[0] = 'D';  // Direita
  commandCount = 1;
}

void loop() {
  handleSerialInput();
  processLoop();
}

void handleSerialInput() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    input.toUpperCase(); // Converter as cases de in para maiúsculas
    
    // Limpa a fila de comandos antes de adicionar novos
    commandCount = 0;
    currentCommandIndex = 0;

    // cada caractere como um comando
    for (int i = 0; i < input.length() && commandCount < 10; i++) {
        char c = input.charAt(i);
        // ignora espaços e vírgulas
        if (c != ' ' && c != ',') {
            // aceita apenas F, T, D, E
            if (c == 'F' || c == 'T' || c == 'D' || c == 'E') {
                commandQueue[commandCount++] = c;
            }
        }
    }

    Serial.printf("%d comandos recebidos e enfileirados.\n", commandCount);
  }
}

void processLoop() {
    if (executingCommand) {
        // Se está executando um comando de movimento ou giro, atualiza o estado
        if (!updateMotor() && !updateTurn()) {
            executingCommand = false; // Comando terminou
            Serial.println("Comando finalizado.");
        }
        
        // Monitoramento de energia durante o movimento
        if (inaUpdateFlag) {
            inaUpdateFlag = false;
            
            float tensao = ina219.obterTensao();
            float corrente = ina219.obterCorrente();
            float potencia = ina219.obterPotencia();
            
            unsigned long tempoAtual = millis();
            float deltaT = (tempoAtual - ultimoTempo) / 1000.0;
            ultimoTempo = tempoAtual;
            
            EnergiaConsumida += potencia * deltaT;
            float percentualRestante = ((EnergiaTotal - EnergiaConsumida) / EnergiaTotal) * 100.0;
            
            Serial.printf("Tensão: %.2fV | Corrente: %.2fmA | Potência: %.2fmW | Bateria: %.1f%%\n",
                        tensao, corrente, potencia, percentualRestante);
        }
    } else if (currentCommandIndex < commandCount) {
        // Se não está executando nada e há comandos na fila, executa o próximo
        executeNextCommand();
    }
}

void executeNextCommand() {
    if (currentCommandIndex >= commandCount) return;

    char command = commandQueue[currentCommandIndex];
    currentCommandIndex++;
    
    Serial.printf("Executando comando: '%c'\n", command);

    // Comando: F (Frente - andar 1 metro)
    if (command == 'F') {
        moveMeters(1.0);
        executingCommand = true;
    } 
    // Comando: T (Trás - andar 1 metro para trás)
    else if (command == 'T') {
        moveMeters(-1.0);
        executingCommand = true;
    } 
    // Comando: D (Direita - girar 90° à direita)
    else if (command == 'D') {
        turnDegrees(90);
        executingCommand = true;
    } 
    // Comando: E (Esquerda - girar 90° à esquerda)
    else if (command == 'E') {
        turnDegrees(-90);
        executingCommand = true;
    } 
    // Comando desconhecido
    else {
        Serial.printf("Comando desconhecido: '%c'\n", command);
        Serial.println("Comandos disponíveis:");
        Serial.println("  F - Andar 1 metro para frente");
        Serial.println("  T - Andar 1 metro para trás");
        Serial.println("  D - Girar 90° à direita");
        Serial.println("  E - Girar 90° à esquerda");
    }
}


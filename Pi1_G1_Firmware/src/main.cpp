#include <Arduino.h>
#include <MonitorEnergia.h>
#include <mqtt.h>
#include <WiFi.h>
#include <ServoMotor.h>  // Servo
#include <pin_declaration.h>
#include "Motor_Control.h"
#include <main.h>
#include "parser.h"

// Constantes de calibração
// Tempo em milissegundos para girar 90 graus.
#define TURN_90_DEGREES_MS 1000 

#define WIFI_SSID     "hotspot_rhkbo"
#define WIFI_PASSWORD "roundwaves"
#define WIFI_CHANNEL  6

// Fila de Comandos 
// F = Frente, T = Trás, D = Direita, E = Esquerda
char commandQueue[10];
int commandCount = 0;
int currentCommandIndex = 0;
bool executingCommand = false;
HighLevelStates highLevelState = WAIT_COMMANDS;

hw_timer_t * inaTmr = NULL;
MonitorEnergia ina219;

const float V_nominal = 6.0;
const float Capacidade_Ah = 2.7;
float EnergiaTotal;
float EnergiaConsumida = 0;
unsigned long ultimaMedicao;
volatile bool inaUpdateFlag = false;
int flag = 0;

void IRAM_ATTR InaTmrISR(){
  inaUpdateFlag = true;
}

void handleSerialInput();
void executeNextCommand();
void processLoop();


static void wifi_connect(const char* ssid, const char* pass, int channel) {
  WiFi.setSleep(false);
  WiFi.begin(ssid, pass, channel);
#if defined(SERIAL_DEBUG)
  Serial.print("WiFi conectando");
#endif
  while (WiFi.status() != WL_CONNECTED) { delay(120); Serial.print("."); }
#if defined(SERIAL_DEBUG)
  Serial.println(" ✓");
  Serial.print("IP: "); Serial.println(WiFi.localIP());
#endif
}


void setup() {
  Serial.begin(115200);
  delay(100);

  //Encoders Setup
  encoderInit ();

  //Motors & H Bridge Setup
  MotorInit();
  
  // ServoSetup(PWM_SERVO, 0); // Servo no pino 18, começa em 0°
  // MovimentaServo(90, 500); // Aqui estamos fazendo o servo girar 90° por 5 segundos

  wifi_connect(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);

  //Timer Setup
  inaTmr = timerBegin(0,80,true);
  timerAttachInterrupt(inaTmr, &InaTmrISR, true);
  timerAlarmWrite(inaTmr, 5000000, true);
  digitalWrite(STBY, LOW);

  if (!ina219.iniciar()) {
#if defined(SERIAL_DEBUG)
    Serial.println("ERRO: Sensor INA219 não encontrado!");
#endif
    while (1) delay(10);
  }

  EnergiaTotal = V_nominal * Capacidade_Ah * 3600.0;
  ultimaMedicao = millis();

  mqtt_init();

  // Servo

  ServoSetup(PWM_SERVO, 0); // Servo no pino 18, começa em 0°
  // Serial.println("Servo inicializado!");



  
  
  // Teste para boot, comente para não executar automaticamente
  /* */
  // delay(3000); // Aguarda 3 segundos após boot
  // commandQueue[0] = 'D';  // Direita
  commandQueue[0] = 'F';
  commandCount = 1;
  my_led_bind_cmd_topic("esp/test");


  timerAlarmEnable(inaTmr);
#if defined(SERIAL_DEBUG)
  Serial.println("Monitor de energia iniciado!");
  Serial.println("Aguardando comandos:");
#endif
}

void loop() {
  
  switch (highLevelState){
  case WAIT_COMMANDS:
    mqtt_loop();
    if (getFlagStop()) {
      highLevelState = EXECUTE_COMMAND;
      digitalWrite(STBY, HIGH);
#if defined(SERIAL_DEBUG)
      Serial.println("Troca para EXECUTE_COMMAND");
#endif
      break;
    }

    break;
  case EXECUTE_COMMAND:
    if (!getFlagStop()) {
        highLevelState = WAIT_COMMANDS;  
        digitalWrite(STBY, LOW);
        delay(100);
        MovimentaServo(90, 5000); // Aqui estamos fazendo o servo girar 90° por 5 segundos
#if defined(SERIAL_DEBUG)
        Serial.println("Troca para WAIT_COMMANDS");
#endif
        break;
    }
    mqtt_loop();
    processLoop();
    break;
  }
  // Monitoramento de energia
  if (inaUpdateFlag) {
      inaUpdateFlag = false;
      unsigned long t0 = micros();

      float corrente_mA = ina219.obterCorrente();
      float corrente = corrente_mA / 1000.0;
      float tensao = ina219.obterTensao();
            
      unsigned long tempoAtual = millis();
      float dt = (tempoAtual - ultimaMedicao) / 1000.0;
      ultimaMedicao = tempoAtual;

      float P = tensao * corrente;
      EnergiaConsumida += P * dt;

      if (EnergiaConsumida > EnergiaTotal) EnergiaConsumida = EnergiaTotal;

      float EnergiaRestante = EnergiaTotal - EnergiaConsumida;
      float t_restante = (P > 0.001) ? (EnergiaRestante / P) : INFINITY;

      int total_segundos = (int)t_restante;
      int t_h = total_segundos / 3600;
      int t_min = (total_segundos % 3600) / 60;
      float t_seg = t_restante - (t_h *3600) - (t_min * 60);
      mqtt_send_telemetry_kv_num("esp/telemetry", "tensao", tensao);
      mqtt_send_telemetry_kv_num("esp/telemetry", "corrente", corrente);
      mqtt_send_telemetry_kv_num("esp/telemetry", "energia_restante_Wh", (EnergiaRestante/3600));
      mqtt_send_telemetry_kv_num("esp/telemetry", "distancia_mm", getDistanceMillimeter());
      char  cmd_atual = getCommandCode(currentCommandIndex);
      if(cmd_atual == 0) cmd_atual = '-';
      mqtt_send_telemetry_kv("esp/telemetry", "comando_atual_tipo", String(cmd_atual).c_str());
      mqtt_send_telemetry_kv_num("esp/telemetry", "numero_comando", currentCommandIndex);

#if defined(SERIAL_DEBUG)
      Serial.printf("Tensão: %.3f V | Corrente: %.3f mA | Tempo restante: %d h %d min %.3f s (%.2f s)\n",
                    tensao, corrente, t_h, t_min, t_seg, t_restante);
#endif
  }
}

// void handleSerialInput() {
//   if (Serial.available() > 0) {
//     String input = Serial.readStringUntil('\n');
//     input.trim();
//     input.toUpperCase(); // Converter as cases de in para maiúsculas
    
//     // Limpa a fila de comandos antes de adicionar novos
//     commandCount = 0;
//     currentCommandIndex = 0;

//     // cada caractere como um comando
//     for (int i = 0; i < input.length() && commandCount < 10; i++) {
//         char c = input.charAt(i);
//         // ignora espaços e vírgulas
//         if (c != ' ' && c != ',') {
//             // aceita apenas F, T, D, E
//             if (c == 'F' || c == 'T' || c == 'D' || c == 'E') {
//                 commandQueue[commandCount++] = c;
//             }
//         }
//     }

//     Serial.printf("%d comandos recebidos e enfileirados.\n", commandCount);
//   }
  
// }


void processLoop() {
  if (executingCommand) {
    char cmd = getCommandCode(currentCommandIndex);
    // Se está executando um comando de movimento ou giro, atualiza o estado
    if (cmd == 'F'){
      if (!updateMotor()) {
        executingCommand = false; // Comando terminou
        mqtt_send_telemetry_kv("esp/telemetry", "comando_atual_tipo", String(cmd).c_str());
        mqtt_send_telemetry_kv_num("esp/telemetry", "numero_comando", currentCommandIndex);
        mqtt_send_telemetry_kv_num("esp/telemetry", "distancia_mm", getDistanceMillimeter());
#if defined(SERIAL_DEBUG)
        Serial.println("Comando finalizado.");
#endif
        // Avança para o próximo comando somente após terminar
        currentCommandIndex++;
      }
    }
    else if (cmd == 'D' || cmd == 'E'){
      if (!updateTurn()) {
        executingCommand = false; // Comando terminou
        mqtt_send_telemetry_kv("esp/telemetry", "comando_atual_tipo", String(cmd).c_str());
        mqtt_send_telemetry_kv_num("esp/telemetry", "numero_comando", currentCommandIndex);
        mqtt_send_telemetry_kv_num("esp/telemetry", "distancia_mm", getDistanceMillimeter());
#if defined(SERIAL_DEBUG)
        Serial.println("Comando finalizado.");
#endif
        // Avança para o próximo comando somente após terminar
        currentCommandIndex++;
      }
    }
  } else if (currentCommandIndex < getNumeroComandos()) {
      // Se não está executando nada e há comandos na fila, executa o próximo
      resetErrorsPID();
      delay(100);
      executeNextCommand();
#if defined(SERIAL_DEBUG)
      Serial.println("Chamando proximo comando.");
#endif
  } else if (currentCommandIndex >= getNumeroComandos()) {
      // Não há mais comandos
      // Serial.println("Todos os comandos da fila foram executados.");
      clearCommandQueue();
      resetErrorsPID();
      currentCommandIndex = 0;
      resetFlagStop();
  }
    
}

// ...existing code...
void executeNextCommand() {
    if (currentCommandIndex >= getNumeroComandos()) return;

    char command = getCommandCode(currentCommandIndex);
    
#if defined(SERIAL_DEBUG)
    Serial.printf("Executando comando: '%c'\n", command);
#endif

    if (command == 'F') {
        moveMillimeters(getCommandDistance(currentCommandIndex));
        executingCommand = true;
    } 
    else if (command == 'D') {
        turnDegrees(90);
        executingCommand = true;
    } 
    else if (command == 'E') {
        turnDegrees(-90);
        executingCommand = true;
    } 
    else {
#if defined(SERIAL_DEBUG)
        Serial.printf("Comando desconhecido: '%c'\n", command);
        Serial.println("Comandos disponíveis:");
        Serial.println("  F - Andar 1 metro para frente");
        Serial.println("  T - Andar 1 metro para trás");
        Serial.println("  D - Girar 90° à direita");
        Serial.println("  E - Girar 90° à esquerda");
#endif
        // pula comando inválido imediatamente
        currentCommandIndex++;
    }
    // removido incremento aqui — agora só incrementamos quando o comando terminar
}
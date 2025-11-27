// ...existing code...
#include "parser.h"
#include <stdio.h>
#include <string.h>

static int numeroComandos = 0;

bool flag_stop = false;

typedef struct {
  char commandCode;
  int distance;
} Command;

typedef struct {
  Command items[100];
  int size;
} CommandQueue;

static CommandQueue *commandQueueInstance(void) {
  static CommandQueue instance;
  static int initialized = 0;
  if (!initialized) {
    for (int i = 0; i < 100; ++i) {
      instance.items[i].commandCode = 0;
      instance.items[i].distance = 0;
    }
    instance.size = 0;
    initialized = 1;
  }
  return &instance;
}

void clearCommandQueue(void) {
  CommandQueue *q = commandQueueInstance();
  for (int i = 0; i < 100; ++i) {
    q->items[i].commandCode = 0;
    q->items[i].distance = 0;
  }
  q->size = 0;
  numeroComandos = 0;
}

static char readCommand(const char *palavra_atual, const char *lado) {
  if (!palavra_atual) return 0;
  if (strcmp(palavra_atual, "andar") == 0) return 'F';
  if (strcmp(palavra_atual, "virar") == 0) {
    if (lado && strcmp(lado, "direita") == 0) return 'D';
    if (lado && strcmp(lado, "esquerda") == 0) return 'E';
  }
  return 0;
}

static int converter_numero(const char *subcomando_atual) {
  if (!subcomando_atual) return 0;
  int resultado = 0;
  int i = 0;
  while (subcomando_atual[i] == ' ') i++;
  while (subcomando_atual[i] >= '0' && subcomando_atual[i] <= '9') {
    resultado = resultado * 10 + (subcomando_atual[i] - '0');
    i++;
  }
  return resultado;
}

void parser(char *str) {
  if (!str) return;
  CommandQueue *q = commandQueueInstance();
  int p = 0;

  // buffers protegidos
  enum { MAX_CMD_WORD = 32, MAX_SUBCMD = 64 };
  char palavra_atual[MAX_CMD_WORD];
  char subcomando_atual[MAX_SUBCMD];

  int i = 0;
  int k;

  // procura inicio do array de comandos
  while (str[i] != '[') {
    if (str[i] == '\0') return;
    i++;
  }

  // percorre array
  while (str[i] != ']' && str[i] != '\0') {
    if (str[i] == '{') {
      // avança para o início da chave
      i++;
      // pula espaços e aspas
      while (str[i] == ' ' || str[i] == '"' ) { if (str[i] == '\0') break; i++; }

      // copia a chave com limite
      k = 0;
      while (str[i] != '"' && str[i] != ':' && str[i] != '\0' && k < (MAX_CMD_WORD - 1)) {
        palavra_atual[k++] = str[i++];
      }
      palavra_atual[k] = '\0';

      // avança até o início do valor (pula até ':'), depois pula ':' e espaços/aspas
      while (str[i] != ':' && str[i] != '\0') i++;
      if (str[i] == ':') i++;
      while (str[i] == ' ' || str[i] == '"' ) { if (str[i] == '\0') break; i++; }

      // copia valor/subcomando até '}' ou ',' com limite
      k = 0;
      while (str[i] != '}' && str[i] != ',' && str[i] != '\0' && k < (MAX_SUBCMD - 1)) {
        if (str[i] != '"') subcomando_atual[k++] = str[i];
        i++;
      }
      subcomando_atual[k] = '\0';

      // registra comando
      if (p < 100) {
        q->items[p].commandCode = readCommand(palavra_atual, subcomando_atual);
        if (q->items[p].commandCode == 'F') {
          q->items[p].distance = converter_numero(subcomando_atual);
        } else {
          q->items[p].distance = 0;
        }
        p++;
      }
    } else {
      i++;
    }
  }

  q->size = p;
  numeroComandos = p;

  // sinaliza que há comandos prontos
  flag_stop = true;
}

int getNumeroComandos(void) {
  return numeroComandos;
}

char getCommandCode(int index) {
  CommandQueue *q = commandQueueInstance();
  if (index < 0 || index >= q->size) return 0;
  return q->items[index].commandCode;
}

int getCommandDistance(int index) {
  CommandQueue *q = commandQueueInstance();
  if (index < 0 || index >= q->size) return 0;
  return q->items[index].distance;
}

void setFlagStop() {
  // torna explícito: sinaliza que a fila deve ser executada
  flag_stop = true;
}

void resetFlagStop() {
  // torna explícito: sinaliza que a fila deve ser executada
  flag_stop = false;
}

bool getFlagStop() {
  return flag_stop;
}
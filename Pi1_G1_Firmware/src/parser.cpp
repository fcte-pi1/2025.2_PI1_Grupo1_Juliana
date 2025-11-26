#include <stdio.h>
#include <string.h>

int numeroComandos = 0;

typedef struct {
  char commandCode;
  int distance;
} commands;

commands commandQueue[100];

char readCommand(char *palavra_atual, char *lado) {
  char c;
  if (strcmp(palavra_atual, "andar") == 0) {
    c = 'F';
  } else if (strcmp(palavra_atual, "virar") == 0) {
    if (strcmp(lado, "direita") == 0) {
      c = 'D';
    } else if (strcmp(lado, "esquerda") == 0) {
      c = 'E';
    }
  }
  return c;
}

int converter_numero(char *subcomando_atual) {
  int resultado = 0;
  int i = 0;

  while (subcomando_atual[i] == ' ') {
    i++;
  }
  while (subcomando_atual[i] >= '0' && subcomando_atual[i] <= '9') {
    resultado = resultado * 10 + (subcomando_atual[i] - '0');
    i++;
  }

  return resultado;
}

void parser(char *str) {
  int p = 0;
  char palavra_atual[15];
  char subcomando_atual[15];
  int i = 0;
  int k;
  while (str[i] != '[') {
    i++;
  }

  while (str[i] != ']') {
    if (str[i] == '{') {
      i += 2;
      k = 0;
      while (str[i] != '"') {
        palavra_atual[k] = str[i];
        i++;
        k++;
      }
      palavra_atual[k] = '\0';
      i += 3;
      k = 0;
      while (str[i] != '}') {
        if (str[i] == '"') {
        } else {
          subcomando_atual[k] = str[i];
          k++;
        }
        i++;
      }
      subcomando_atual[k] = '\0';
      commandQueue[p].commandCode =
          readCommand(palavra_atual, subcomando_atual);
      if (commandQueue[p].commandCode == 'F') {
        commandQueue[p].distance = converter_numero(subcomando_atual);
      } else {
        commandQueue[p].distance = 0;
      }

      p++;
    }
    i++;
  }
}

int main() {
  // 1. String corrigida com escape sequence (\") para as aspas internas
  char str[] = "{\"comandos\": [{\"andar\": 20}, {\"virar\": \"direita\"}, "
               "{\"andar\": 10}, {\"virar\": \"esquerda\"}, {\"andar\": 5}]}";

  // 2. Chama o parser
  parser(str);

  // 3. Imprime os resultados
  printf("--- Resultado do Parse ---\n");

  // Como sua função 'parser' usa um 'p' local e não atualiza a variável global
  // 'numeroComandos', vamos iterar até encontrar um comando vazio (code 0) para
  // mostrar o que foi salvo.
  int i = 0;
  while (i < 100) {
    // Verifica se existe um comando salvo nessa posição
    if (commandQueue[i].commandCode == 0) {
      break; // Sai do loop se não houver mais comandos
    }

    printf("Indice %d: Codigo = '%c', Distancia = %d\n", i,
           commandQueue[i].commandCode, commandQueue[i].distance);
    i++;
  }

  // Atualiza a global para refletir o que foi encontrado
  numeroComandos = i;
  printf("Total de comandos: %d\n", numeroComandos);

  return 0;
}
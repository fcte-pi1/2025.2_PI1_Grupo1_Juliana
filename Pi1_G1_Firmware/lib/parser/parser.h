// ...existing code...
#ifndef PARSER_H
#define PARSER_H

#ifdef __cplusplus
extern "C" {
#endif

// typedef struct {
//   char commandCode;
//   int distance;
// } Command;

void clearCommandQueue(void);
void parser(char *str);
int getNumeroComandos(void);
char getCommandCode(int index);
int getCommandDistance(int index);
void setFlagStop();
void resetFlagStop();
bool getFlagStop();

#ifdef __cplusplus
}
#endif

#endif
// ...existing code...
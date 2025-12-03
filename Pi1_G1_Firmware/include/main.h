

typedef enum {
    WAIT_COMMANDS = 0,
    EXECUTE_COMMAND = 1,
} HighLevelStates;

struct pos {
  int x;
  int y;
};


#define     SOMA_X      0
#define     SUBTRAI_Y   1
#define     SUBTRAI_X   2
#define     SOMA_Y      3
#define     X_INIT      0
#define     Y_INIT      0
# Guia de Comandos do Robô

## Sistema de Fila de Comandos (Command Queue)

O robô utiliza um sistema de **fila de comandos** que permite:
- Enfileirar até **10 comandos** por vez
- Executar comandos **sequencialmente** (um de cada vez)
- Enviar múltiplos comandos **separados por vírgula**
- Monitorar **energia em tempo real** durante a execução

### Como Funciona
1. Você envia comandos via **Serial Monitor** (115200 baud)
2. Os comandos são armazenados na `commandQueue[]`
3. O robô executa cada comando **completamente** antes de passar para o próximo
4. Durante a execução, o sistema monitora **tensão, corrente e bateria**

## Comandos Disponíveis

### 1. Movimentação Linear

#### `andar X`
Move o robô X metros para frente ou para trás.
- **X > 0**: Move para frente
- **X < 0**: Move para trás

**Exemplos:**
```
andar 2.5     → Anda 2.5 metros para frente
andar -1.0    → Anda 1.0 metro para trás
andar 0.5     → Anda 50 centímetros para frente
```

### 2. Rotação

#### `GD`
Gira 90° para a direita.

**Exemplo:**
```
GD    → Gira 90° à direita
```

#### `GE`
Gira 90° para a esquerda.

**Exemplo:**
```
GE    → Gira 90° à esquerda
```

#### `girar X`
Gira X graus.
- **X > 0**: Gira para a direita
- **X < 0**: Gira para a esquerda

**Exemplos:**
```
girar 180     → Gira 180° à direita (meia-volta)
girar -45     → Gira 45° à esquerda
girar 360     → Gira 360° à direita (volta completa)
```

## Enviando Múltiplos Comandos

### Sintaxe: Comandos separados por vírgula

```
comando1, comando2, comando3, ...
```

**Limite:** Até 10 comandos por envio

### Como a Fila Funciona:

1. **Envio:** Você digita os comandos separados por vírgula e pressiona Enter
2. **Parsing:** O sistema divide os comandos e armazena na `commandQueue[]`
3. **Execução Sequencial:** 
   - O robô executa o **primeiro** comando
   - Aguarda até o comando **finalizar completamente**
   - Passa para o **próximo** comando
   - Repete até esvaziar a fila

4. **Feedback:** O Serial Monitor mostra:
   ```
   3 comandos recebidos e enfileirados.
   Executando comando: 'andar 2'
   Iniciando movimento: 2.00 metros (2000 mm) na direção FRENTE
   Tensão: 6.12V | Corrente: 245.30mA | Potência: 1501.23mW | Bateria: 98.5%
   Comando finalizado.
   Executando comando: 'GD'
   ...
   ```

### Exemplos de Uso:

**Exemplo 1: Percurso Simples**
```
andar 2, GD, andar 1.5
```
**O que acontece:**
1. Robô anda 2m para frente → aguarda finalizar
2. Robô gira 90° à direita → aguarda finalizar  
3. Robô anda 1.5m para frente → aguarda finalizar

**Exemplo 2: Retorno ao Ponto Inicial**
```
andar 1, girar 180, andar 1
```
**O que acontece:**
1. Anda 1m para frente
2. Gira 180° (meia-volta)
3. Anda 1m (volta ao início)

**Exemplo 3: Quadrado de 2x2 metros**
```
andar 2, GD, andar 2, GD, andar 2, GD, andar 2, GD
```
**O que acontece:**
- 8 comandos enfileirados
- Executa lado por lado até completar o quadrado

### Importante:

- **Novos comandos SUBSTITUEM a fila anterior:** Se você enviar novos comandos enquanto outros estão executando, a fila é **limpa** e reiniciada
- **Máximo de 10 comandos:** Comandos extras serão ignorados
- **Espaços são ignorados:** `andar 2,GD,andar 1` funciona igual a `andar 2, GD, andar 1`

## Calibração

### Calibrar o Giro (IMPORTANTE!)

O tempo para girar 90° depende de vários fatores:
- Peso do robô
- Tipo de superfície
- Voltagem da bateria
- Tipo de rodas

**Para calibrar:**

1. Abra o arquivo `Pi1_G1_Firmware/lib/MotorControlWithEncoder/Motor_Control.cpp`
2. Localize a linha na função `girarGraus()`:
   ```cpp
   const unsigned long TEMPO_90_GRAUS = 1000; // tempo em ms
   ```
3. Execute o comando `GD` ou `girar 90`
4. Observe quantos graus o robô realmente girou
5. Ajuste o valor:
   - Se girou **menos** que 90°: **AUMENTE** o valor
   - Se girou **mais** que 90°: **DIMINUA** o valor
6. Recompile e teste novamente

**Fórmula para ajuste rápido:**
```
Novo_Valor = Valor_Atual * (90 / Graus_Girados_Realmente)
```

**Exemplo:**
- Valor atual: 1000ms
- Girou apenas 60°
- Novo valor = 1000 * (90/60) = 1500ms

### Calibrar a Distância

A distância percorrida é calculada através dos encoders. Se notar imprecisão:

1. Verifique o valor de `DEFAULT_CIRCUMFERENCE_MILLIMETER` no arquivo `Motor_Control.h`
2. Meça o perímetro real das suas rodas em milímetros
3. Ajuste o valor conforme necessário

## Monitoramento via Serial

O robô envia feedback em tempo real pela porta serial (115200 baud):

### Mensagens da Fila de Comandos:
```
3 comandos recebidos e enfileirados.           ← Confirma quantos comandos foram adicionados
Executando comando: 'andar 2'                  ← Inicia execução do comando atual
Iniciando movimento: 2.00 metros (2000 mm) na direção FRENTE
Ramp Up started at: 0
Drive started at: 220
Tensão: 6.12V | Corrente: 245.30mA | Potência: 1501.23mW | Bateria: 98.5%  ← Monitoramento em tempo real
Comando finalizado.                            ← Comando completado, passa para o próximo
Executando comando: 'GD'
Iniciando giro: 90 graus para DIREITA (1000 ms)
Tensão: 6.08V | Corrente: 312.45mA | Potência: 1899.67mW | Bateria: 97.8%
Giro por tempo finalizado.
Comando finalizado.
```

### Informações Exibidas:

**Durante Movimento/Giro:**
- **Tensão** da bateria (V)
- **Corrente** consumida (mA)
- **Potência** instantânea (mW)
- **Percentual de bateria** restante (%)

**Controle de Fluxo:**
- Comandos recebidos e enfileirados
- Comando sendo executado
- Comando finalizado
- Próximo comando na fila

## Exemplos Práticos

### Exemplo 1: Quadrado (8 comandos)
```
andar 1, GD, andar 1, GD, andar 1, GD, andar 1, GD
```
**Fila:** [andar 1] → [GD] → [andar 1] → [GD] → [andar 1] → [GD] → [andar 1] → [GD]

### Exemplo 2: Triângulo Equilátero (6 comandos)
```
andar 1, girar 120, andar 1, girar 120, andar 1, girar 120
```
**Fila:** [andar 1] → [girar 120] → [andar 1] → [girar 120] → [andar 1] → [girar 120]

### Exemplo 3: Percurso Complexo (7 comandos)
```
andar 2, GD, andar 1.5, GE, andar 1, girar 180, andar 0.5
```
**Fila:** [andar 2] → [GD] → [andar 1.5] → [GE] → [andar 1] → [girar 180] → [andar 0.5]

### Exemplo 4: Zigue-zague (7 comandos)
```
andar 0.5, girar 45, andar 0.5, girar -90, andar 0.5, girar 45, andar 0.5
```
**Fila:** [andar 0.5] → [girar 45] → [andar 0.5] → [girar -90] → [andar 0.5] → [girar 45] → [andar 0.5]

### Exemplo 5: Teste de Bateria (3 comandos longos)
```
andar 5, girar 360, andar -5
```
Útil para monitorar o consumo de energia em percursos longos

## Solução de Problemas

### Robô não se move
- Verifique se os motores estão conectados corretamente
- Verifique a bateria
- Confira os pinos no arquivo `pin_declaration.h`
- Observe se aparecem mensagens de erro no Serial Monitor

### Comandos não são executados
- **Verifique a fila:** Novos comandos substituem a fila anterior
- **Confirme o formato:** Use vírgulas para separar comandos
- **Limite de 10 comandos:** Comandos extras são ignorados
- **Aguarde finalização:** O robô só aceita novos comandos após terminar a execução atual

### Distância incorreta
- Calibre o perímetro das rodas
- Verifique se os encoders estão funcionando
- Verifique a superfície (piso liso é mais preciso)

### Giro impreciso
- Calibre o valor `TIME_90_DEGREES` (anteriormente `TEMPO_90_GRAUS`)
- Teste em diferentes superfícies
- Verifique se as rodas estão girando livremente

### Fila de comandos trava
- Reinicie o ESP32 (botão RESET)
- Verifique se `executingCommand` está funcionando corretamente
- Envie um comando simples para limpar a fila: `andar 0`

## Especificações Técnicas

### Sistema de Controle
- **Velocidade padrão**: PWM 200 (ajustável)
- **Resolução dos encoders**: 20 pulsos por rotação
- **Precisão de distância**: ±10mm (em superfície lisa)
- **Taxa de atualização**: 20ms por ciclo de controle

### Fila de Comandos (Command Queue)
- **Capacidade máxima**: 10 comandos
- **Array**: `String commandQueue[10]`
- **Contador**: `commandCount` (0-10)
- **Índice atual**: `currentCommandIndex`
- **Flag de execução**: `executingCommand` (bool)

### Monitoramento de Energia
- **Sensor**: INA219
- **Taxa de atualização**: 3 segundos (timer interrupt)
- **Parâmetros monitorados**:
  - Tensão (V)
  - Corrente (mA)
  - Potência (mW)
  - Energia consumida (acumulativa)
  - Percentual de bateria restante

### Comunicação Serial
- **Baud rate**: 115200
- **Formato de entrada**: Comandos separados por vírgula
- **Feedback**: Tempo real durante execução

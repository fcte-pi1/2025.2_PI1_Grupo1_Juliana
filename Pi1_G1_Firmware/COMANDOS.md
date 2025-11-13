# Guia de Comandos do Robô

## Sistema de Fila de Comandos (Command Queue)

O robô utiliza um sistema de **fila de comandos** que permite:
- Enfileirar até **10 comandos** por vez
- Executar comandos **sequencialmente** (um de cada vez)
- Enviar múltiplos comandos em uma única linha
- Monitorar **energia em tempo real** durante a execução

### Como Funciona
1. Você envia comandos via **Serial Monitor** (115200 baud)
2. Os comandos são armazenados na `commandQueue[]` (array de caracteres)
3. O robô executa cada comando **completamente** antes de passar para o próximo
4. Durante a execução, o sistema monitora **tensão, corrente e bateria**

## Comandos Disponíveis

O sistema usa **comandos de um único caractere** para simplicidade e eficiência:

### Comandos de Movimento

| Comando | Descrição | Distância |
|---------|-----------|-----------|
| **F** | Frente (Forward) | 1 metro |
| **T** | Trás (Backward) | 1 metro |

### Comandos de Rotação

| Comando | Descrição | Ângulo |
|---------|-----------|--------|
| **D** | Direita (Right) | 90° |
| **E** | Esquerda (Left) | 90° |

### Detalhes dos Comandos

#### `F` - Andar para Frente
Move o robô **1 metro** para frente.

**Exemplo:**
```
F    → Anda 1 metro para frente
```

#### `T` - Andar para Trás
Move o robô **1 metro** para trás.

**Exemplo:**
```
T    → Anda 1 metro para trás (ré)
```

#### `D` - Girar à Direita
Gira o robô **90°** para a direita (sentido horário).

**Exemplo:**
```
D    → Gira 90° à direita
```

#### `E` - Girar à Esquerda
Gira o robô **90°** para a esquerda (sentido anti-horário).

**Exemplo:**
```
E    → Gira 90° à esquerda
```

## Enviando Múltiplos Comandos

### Sintaxe

Basta digitar os caracteres de comando em sequência:

```
FDFE    → Frente, Direita, Frente, Esquerda
```

```
F D F E         → Mesmo que FDFE
F, D, F, E      → Mesmo que FDFE
F,D,F,E         → Mesmo que FDFE
```

**Limite:** Até 10 comandos por envio

### Como a Fila Funciona:

1. **Envio:** Você digita os comandos (ex: `FDFE`) e pressiona Enter
2. **Parsing:** O sistema extrai apenas os caracteres válidos (F, T, D, E) e ignora espaços/vírgulas
3. **Execução Sequencial:** 
   - O robô executa o **primeiro** comando
   - Aguarda até o comando **finalizar completamente**
   - Passa para o **próximo** comando
   - Repete até esvaziar a fila

4. **Feedback:** O Serial Monitor mostra:
   ```
   4 comandos recebidos e enfileirados.
   Executando comando: 'F'
   Iniciando movimento: 1.00 metros (1000 mm) na direção FRENTE
   Tensão: 6.12V | Corrente: 245.30mA | Potência: 1501.23mW | Bateria: 98.5%
   Comando finalizado.
   Executando comando: 'D'
   Iniciando giro: 90 graus para DIREITA (500 ms)
   ...
   ```

### Exemplos de Uso:

**Exemplo 1: Quadrado (1m × 1m)**
```
FDFDFDFD
```
ou com espaços para melhor leitura:
```
F D F D F D F D
```
**O que acontece:**
1. Frente 1m → Direita 90° → Frente 1m → Direita 90° → Frente 1m → Direita 90° → Frente 1m → Direita 90°
2. Resultado: Quadrado completo retornando à posição inicial

**Exemplo 2: Ida e Volta**
```
FFFDDFFFF
```
**O que acontece:**
1. Frente 3m (FFF)
2. Meia-volta (DD = 180°)
3. Frente 4m (FFFF)

**Exemplo 3: Zigue-zague**
```
FDFEFDFEF
```
**O que acontece:**
- F → D → F → E → F → D → F → E → F
- Cria um padrão em zigue-zague

**Exemplo 4: Octógono**
```
FDFDFDFDFDFDFDF
```
**O que acontece:**
- 8 vezes: Frente + Direita (cada giro de 45° seria ideal, mas com 90° faz um padrão interessante)

**Exemplo 5: Exploração em Cruz**
```
FFDDFFFFTFF
```
**O que acontece:**
1. FF - Frente 2m
2. DD - Meia volta (180°)
3. FFFF - Frente 4m (passa ponto inicial)
4. T - Ré 1m
5. FF - Frente 2m

### Importante:

- **Case insensitive:** Tanto `fdfe` quanto `FDFE` quanto `FdFe` funcionam
- **Novos comandos SUBSTITUEM a fila anterior:** Se você enviar novos comandos enquanto outros estão executando, a fila é **limpa** e reiniciada
- **Máximo de 10 comandos:** Comandos extras serão ignorados
- **Espaços e vírgulas são ignorados:** `F D F E` = `F,D,F,E` = `FDFE`
- **Caracteres inválidos são ignorados:** `F123D456` será lido como `FD`

## Calibração

### Calibrar o Giro

> **Giro por Encoder**  
> O sistema agora usa **contagem de pulsos do encoder** para controle de giro, tornando-o **independente de voltagem**.

**Valor Atual de Calibração:**
```cpp
#define ENCODER_COUNTS_PER_90_DEGREES 20  // pulsos necessários para 90°
```

**Calibração Simplificada:**

1. Execute o comando `D` (girar 90° à direita)
2. Observe o Serial Monitor:
   ```
   Iniciando giro por ENCODER: 90 graus (10 pulsos)
   Pulsos: 8/10 (faltam 2)
   Giro por ENCODER finalizado! Total de pulsos: 10
   ```
3. Meça o ângulo real girado com transferidor ou app
4. Ajuste a constante no arquivo `Motor_Control.h`:
   - **Se girou MENOS que 90°**: DIMINUA o valor
   - **Se girou MAIS que 90°**: AUMENTE o valor

**Fórmula para ajuste:**
```
Novo_Pulsos = Pulsos_Atual × (90 / Ângulo_Real)
```

**Exemplo:**
- Valor atual: 10 pulsos
- Girou: 110° (muito)
- Novo valor = 10 × (90/110) ≈ 8 pulsos


### Calibrar a Distância

A distância percorrida é calculada através dos encoders. Se notar imprecisão:

1. Verifique o valor de `DEFAULT_CIRCUMFERENCE_MILLIMETER` no arquivo `Motor_Control.h`
2. Meça o perímetro real das suas rodas em milímetros
3. Ajuste o valor conforme necessário

**Valor Atual:** `DEFAULT_CIRCUMFERENCE_MILLIMETER = 227mm` (ajustado de 204mm)

**Fórmula:**
```
Novo_Valor = Valor_Atual * (Distância_Esperada / Distância_Real)
```

**Exemplo:**
- Comando: `F` (deve andar 1m = 1000mm)
- Andou: 900mm
- Ajuste: 227 * (1000/900) ≈ 252mm

## Monitoramento via Serial

O robô envia feedback em tempo real pela porta serial (115200 baud):

### Mensagens da Fila de Comandos:
```
4 comandos recebidos e enfileirados.           ← Confirma quantos comandos foram adicionados
Executando comando: 'F'                        ← Inicia execução do comando atual
Iniciando movimento: 1.00 metros (1000 mm) na direção FRENTE
PWM setado: 200
PWM compensado: 191
Ramp Up started at: 0
Drive started at: 220
Tensão: 6.12V | Corrente: 245.30mA | Potência: 1501.23mW | Bateria: 98.5%  ← Monitoramento em tempo real
Ramp Down started at: 880
Comando finalizado.                            ← Comando completado, passa para o próximo
Executando comando: 'D'
Iniciando giro: 90 graus para DIREITA (500 ms)
Tensão: 6.08V | Corrente: 312.45mA | Potência: 1899.67mW | Bateria: 97.8%
Giro por tempo finalizado.
Comando finalizado.
Executando comando: 'F'
...
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

### Exemplo 1: Quadrado 1m × 1m (8 comandos)
```
FDFDFDFD
```
ou com espaços:
```
F D F D F D F D
```
**Fila:** [F] → [D] → [F] → [D] → [F] → [D] → [F] → [D]
**Resultado:** Quadrado completo de 1 metro por lado

### Exemplo 2: Retângulo 2m × 1m (8 comandos)
```
FFDFFDFFD
```
**Fila:** [F] → [F] → [D] → [F] → [F] → [D] → [F] → [F] → [D]
**Resultado:** Retângulo com lados de 2m e 1m alternados

### Exemplo 3: Exploração em "L" (4 comandos)
```
FFDF
```
**Fila:** [F] → [F] → [D] → [F]
**Resultado:** Anda 2m, vira direita, anda 1m

### Exemplo 4: Meia-volta e retorno (5 comandos)
```
FFDDF
```
**Fila:** [F] → [F] → [D] → [D] → [F]
**Resultado:** Anda 2m, gira 180° (DD), anda 1m de volta

### Exemplo 5: Teste de Bateria - Percurso Longo (10 comandos)
```
FFFFFFFFFF
```
**Fila:** 10× [F]
**Resultado:** Anda 10 metros total (útil para monitorar consumo de energia)

### Exemplo 6: Padrão em Cruz (9 comandos)
```
FFDFFDDFF
```
**Fila:** [F] → [F] → [D] → [F] → [F] → [D] → [D] → [F] → [F]
**Resultado:** 
- Anda 2m
- Vira direita, anda 2m
- Meia-volta, anda 2m (volta)

### Exemplo 7: Octógono Aproximado (8 comandos)
```
FDFDFDFDF
```
**Resultado:** Cria um padrão octogonal (cada giro de 90° cria forma aproximada)

### Exemplo 8: Teste de Ré (4 comandos)
```
FTFT
```
**Fila:** [F] → [T] → [F] → [T]
**Resultado:** Frente 1m, ré 1m, frente 1m, ré 1m

### Exemplo 9: Percurso Alternado (6 comandos)
```
FDEFTF
```
**Fila:** [F] → [D] → [E] → [F] → [T] → [F]
**Resultado:** Frente, direita, esquerda (volta posição), frente, ré, frente

### Exemplo 10: Máximo de Comandos (10 comandos)
```
FDFEFDFEFD
```
**Resultado:** Padrão complexo com 10 movimentos

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
- Envie um novo comando para limpar e reiniciar a fila

### Comandos não são aceitos
- Verifique se está usando caracteres válidos: F, T, D, E
- Confirme que o Serial Monitor está em 115200 baud
- Tente enviar comandos em maiúscula (embora minúscula também funcione)

## Especificações Técnicas

### Sistema de Controle
- **Velocidade padrão**: PWM 200 (ajustável)
- **Velocidade de giro**: PWM 150 normal, 80 final (ajustável)
- **Resolução dos encoders**: 20 pulsos por rotação
- **Perímetro da roda**: 227mm (ajustado de 204mm)
- **Precisão de distância**: ±10mm (em superfície lisa)
- **Precisão de giro**: ±2°
- **Taxa de atualização**: 20ms por ciclo de controle
- **Método de giro**: Contagem de pulsos do encoder (independente de voltagem)
- **Pulsos para 90°**: 10 pulsos (ajustável via `ENCODER_COUNTS_PER_90_DEGREES`)

### Fila de Comandos (Command Queue)
- **Capacidade máxima**: 10 comandos
- **Array**: `char commandQueue[10]`
- **Tipo de dados**: Caracteres simples (F, T, D, E)
- **Contador**: `commandCount` (0-10)
- **Índice atual**: `currentCommandIndex`
- **Flag de execução**: `executingCommand` (bool)

### Comandos Disponíveis
| Comando | Tipo | Parâmetro Fixo |
|---------|------|----------------|
| F | Movimento | 1.0 metro frente |
| T | Movimento | 1.0 metro trás |
| D | Rotação | 90° direita |
| E | Rotação | 90° esquerda |

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
- **Formato de entrada**: Sequência de caracteres (ex: `FDFE`)
- **Caracteres válidos**: F, T, D, E (case insensitive)
- **Separadores aceitos**: Espaço, vírgula (ignorados)
- **Feedback**: Tempo real durante execução
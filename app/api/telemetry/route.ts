import { NextResponse } from "next/server";
import mqtt from "mqtt";

const BROKER_URL = "mqtt:20.49.38.223:443";
const TELEMETRY_TOPIC = "telemetry";

export async function GET() {
  try {
    console.log("[API/telemetry] Iniciando conexão com broker:", BROKER_URL);
    const client = mqtt.connect(BROKER_URL);

    return new Promise<Response>((resolve) => {
      let finished = false;

      const finish = (res: Response) => {
        if (finished) return;
        finished = true;
        try {
          client.end();
        } catch {
          // ignore
        }
        resolve(res);
      };

      const timeout = setTimeout(() => {
        console.log("[API/telemetry] Timeout sem receber pos_x/pos_y em", TELEMETRY_TOPIC);
        // 204 não deve ter corpo; usamos Response direto em vez de NextResponse.json
        finish(new Response(null, { status: 204 }));
      }, 5000);

      client.on("connect", () => {
        console.log("[API/telemetry] Conectado ao broker, fazendo subscribe em", TELEMETRY_TOPIC);
        client.subscribe(TELEMETRY_TOPIC, (err) => {
          if (err) {
            clearTimeout(timeout);
            finish(
              NextResponse.json(
                { error: "Falha ao inscrever no tópico MQTT" },
                { status: 500 },
              ),
            );
          }
        });
      });

      client.on("message", (_topic, payload) => {
        const text = payload.toString().trim();
        console.log("[API/telemetry] Mensagem recebida no tópico", _topic, "payload:", text);
        if (!text) return;

        try {
          const data = JSON.parse(text) as Record<string, unknown>;
          const hasPosX = typeof data.pos_x === "number";
          const hasPosY = typeof data.pos_y === "number";

          if (!hasPosX && !hasPosY) {
            // ignorar mensagens que não tenham pos_x/pos_y
            console.log("[API/telemetry] Mensagem ignorada (sem pos_x/pos_y)");
            return;
          }

          clearTimeout(timeout);

          console.log(
            "[API/telemetry] Enviando dados crus para o frontend:",
            {
              pos_x: hasPosX ? (data.pos_x as number) : null,
              pos_y: hasPosY ? (data.pos_y as number) : null,
            },
          );

          finish(
            NextResponse.json({
              pos_x: hasPosX ? (data.pos_x as number) : null,
              pos_y: hasPosY ? (data.pos_y as number) : null,
            }),
          );
        } catch {
          // mensagem não é JSON válido ou não é do formato esperado
          console.log("[API/telemetry] Mensagem inválida (não JSON ou formato inesperado)");
        }
      });

      client.on("error", (err) => {
        console.error("[API/telemetry] Erro de conexão com broker:", err);
        clearTimeout(timeout);
        finish(
          NextResponse.json(
            { error: "Erro de conexão com Broker: " + err.message },
            { status: 500 },
          ),
        );
      });
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro interno ao iniciar conexão MQTT" },
      { status: 500 },
    );
  }
}



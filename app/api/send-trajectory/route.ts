import { NextResponse } from 'next/server';
import mqtt from 'mqtt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const client = mqtt.connect('mqtt:20.49.38.223:443');

    return new Promise((resolve) => {
      client.on('connect', () => {
        client.publish('esp/test', JSON.stringify(body), (err) => {
          client.end();
          
          if (err) {
            resolve(NextResponse.json({ error: 'Erro ao publicar no MQTT' }, { status: 500 }));
          } else {
            resolve(NextResponse.json({ success: true }));
          }
        });
      });

      client.on('error', (err) => {
        client.end();
        resolve(NextResponse.json({ error: 'Erro de conexão com Broker: ' + err.message }, { status: 500 }));
      });
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}


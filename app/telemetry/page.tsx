"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RawPoint = {
  x: number;
  y: number;
};

export default function TelemetryPage() {
  const [points, setPoints] = useState<RawPoint[]>([]);
  const [lastX, setLastX] = useState<number | null>(null);
  const [lastY, setLastY] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [totalDistance, setTotalDistance] = useState(0); // em "cm" (mesma unidade de pos_x/pos_y)
  const [lastSegmentDistance, setLastSegmentDistance] = useState(0);

  // Polling simples na API que faz SUB MQTT no backend
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        console.log("[TelemetryPage] Fazendo request para /api/telemetry");
        const res = await fetch("/api/telemetry");

        if (res.status === 204) {
          // sem dados novos, considera ainda conectado
          console.log("[TelemetryPage] /api/telemetry retornou 204 (sem dados novos)");
          setIsConnected(true);
        } else if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error("[TelemetryPage] Erro HTTP em /api/telemetry:", res.status, data);
          setConnectionError(
            (data as { error?: string }).error ??
              "Erro ao buscar telemetria no backend.",
          );
          setIsConnected(false);
        } else {
          const data = (await res.json()) as {
            pos_x: number | null;
            pos_y: number | null;
          };

          console.log("[TelemetryPage] Dados recebidos da API:", data);

          setIsConnected(true);
          setConnectionError(null);

          let nextX = lastX;
          let nextY = lastY;

          if (typeof data.pos_x === "number") {
            nextX = data.pos_x;
            setLastX(nextX);
          }

          if (typeof data.pos_y === "number") {
            nextY = data.pos_y;
            setLastY(nextY);
          }

          if (nextX != null && nextY != null) {
            console.log("[TelemetryPage] Adicionando ponto à trajetória:", {
              x: nextX,
              y: nextY,
            });
            setPoints((prev) => {
              const newPoint = { x: nextX as number, y: nextY as number };

              if (prev.length > 0) {
                const lastPoint = prev[prev.length - 1];
                const dx = newPoint.x - lastPoint.x;
                const dy = newPoint.y - lastPoint.y;
                // Distância Euclidiana entre os dois pontos; se você estiver
                // só em linha reta no eixo X ou Y, é exatamente a diferença em cm.
                const segmentDistance = Math.sqrt(dx * dx + dy * dy);

                setLastSegmentDistance(segmentDistance);
                setTotalDistance((current) => current + segmentDistance);
              }

              return [...prev, newPoint];
            });
          }
        }
      } catch (err) {
        console.error("[TelemetryPage] Erro ao buscar telemetria:", err);
        setConnectionError("Erro de comunicação com o backend.");
        setIsConnected(false);
      } finally {
        if (!cancelled) {
          setTimeout(poll, 500); // próximo ciclo de polling
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [lastX, lastY]);

  // Normaliza os pontos para caberem num SVG 400x400
  const scaledPoints = useMemo(() => {
    if (points.length === 0) return [];

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 10;
    const width = 400 - padding * 2;
    const height = 400 - padding * 2;

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;

    return points.map((p) => {
      const nx = (p.x - minX) / dx; // 0..1
      const ny = (p.y - minY) / dy; // 0..1

      // Inverte Y para ficar "para cima" no SVG
      const sx = padding + nx * width;
      const sy = padding + (1 - ny) * height;

      return { x: sx, y: sy };
    });
  }, [points]);

  const polylinePoints = useMemo(
    () => scaledPoints.map((p) => `${p.x},${p.y}`).join(" "),
    [scaledPoints]
  );

  const handleReset = () => {
    setPoints([]);
    setLastX(null);
    setLastY(null);
    setTotalDistance(0);
    setLastSegmentDistance(0);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Telemetria em Tempo Real
                </h1>
                <p className="text-sm text-muted-foreground">
                  Trajetória do carrinho recebida via MQTT (pos_x, pos_y).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge
                  variant="default"
                  className="gap-1.5 bg-chart-5 hover:bg-chart-5"
                >
                  <Wifi className="h-3.5 w-3.5" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1.5">
                  <WifiOff className="h-3.5 w-3.5" />
                  Desconectado
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="w-full space-y-6">
          {/* ThingsBoard Dashboard */}
          <div className="w-full h-[calc(100vh-200px)] border rounded-lg overflow-hidden bg-background">
            <iframe
              src="https://tb.fse.lappis.rocks/dashboard/7c51b110-c95f-11f0-a863-ebaa4eafc61f?publicId=54b4c820-cfa6-11f0-a863-ebaa4eafc61f"
              className="w-full h-full border-0"
              title="ThingsBoard Dashboard"
              allow="fullscreen"
            />
          </div>
        </div>
      </main>
    </div>
  );
}



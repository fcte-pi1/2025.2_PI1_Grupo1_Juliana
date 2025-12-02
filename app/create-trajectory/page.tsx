"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import mqtt from "mqtt" // MODIFICADO: Importar MQTT
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  MoveVertical,
  RotateCw,
  Package,
  Send,
  Trash2,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw, 
} from "lucide-react"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" // MODIFICADO: Para selecionar Lado

type CommandType = "move" | "rotate" | "release"
type SendStatus = "idle" | "sending" | "success" | "error"

type RawPoint = {
  x: number
  y: number
}

interface Command {
  id: string
  type: CommandType
  value: number // Para rotação: 90 = direita, -90 = esquerda
  unit: string
}

interface CommandTemplate {
  type: CommandType
  label: string
  icon: React.ReactNode
  color: string
  defaultValue: number
  unit: string
}

const commandTemplates: CommandTemplate[] = [
  {
    type: "move",
    label: "Andar",
    icon: <MoveVertical className="h-5 w-5" />,
    color: "bg-blue-500",
    defaultValue: 20,
    unit: "cm",
  },
  {
    type: "rotate",
    label: "Girar",
    icon: <RotateCw className="h-5 w-5" />,
    color: "bg-green-500",
    defaultValue: 90, // Vamos usar 90 para direita, -90 para esquerda internamente
    unit: "°",
  },
  {
    type: "release",
    label: "Liberar Carga",
    icon: <Package className="h-5 w-5" />,
    color: "bg-orange-500",
    defaultValue: 1,
    unit: "",
  },
]

export default function CreateTrajectory() {
  const [commands, setCommands] = useState<Command[]>([])
  const [trajectoryName, setTrajectoryName] = useState("")
  const [draggedTemplate, setDraggedTemplate] = useState<CommandTemplate | null>(null)
  const [draggedCommandId, setDraggedCommandId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle")
  const [storeInMemory, setStoreInMemory] = useState(false)

  // Estados para trajetória em tempo real
  const [points, setPoints] = useState<RawPoint[]>([])
  const [lastX, setLastX] = useState<number | null>(null)
  const [lastY, setLastY] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [totalDistance, setTotalDistance] = useState(0)
  const [lastSegmentDistance, setLastSegmentDistance] = useState(0)

  const handleTemplateDragStart = (template: CommandTemplate) => {
    setDraggedTemplate(template)
  }

  const handleCommandDragStart = (commandId: string) => {
    setDraggedCommandId(commandId)
  }

  const handleDrop = (targetIndex?: number) => {
    if (draggedTemplate) {
      const newCommand: Command = {
        id: Date.now().toString(),
        type: draggedTemplate.type,
        value: draggedTemplate.defaultValue,
        unit: draggedTemplate.unit,
      }

      if (targetIndex !== undefined) {
        const newCommands = [...commands]
        newCommands.splice(targetIndex, 0, newCommand)
        setCommands(newCommands)
      } else {
        setCommands([...commands, newCommand])
      }
    } else if (draggedCommandId) {
      const draggedIndex = commands.findIndex((cmd) => cmd.id === draggedCommandId)
      if (draggedIndex !== -1 && targetIndex !== undefined && draggedIndex !== targetIndex) {
        const newCommands = [...commands]
        const [draggedCommand] = newCommands.splice(draggedIndex, 1)
        const adjustedIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex
        newCommands.splice(adjustedIndex, 0, draggedCommand)
        setCommands(newCommands)
      }
    }

    setDraggedTemplate(null)
    setDraggedCommandId(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index?: number) => {
    e.preventDefault()
    setDragOverIndex(index ?? null)
  }

  const removeCommand = (id: string) => {
    setCommands(commands.filter((cmd) => cmd.id !== id))
  }

  const updateCommandValue = (id: string, value: number) => {
    setCommands(commands.map((cmd) => (cmd.id === id ? { ...cmd, value } : cmd)))
  }

  const getCommandColor = (type: CommandType) => {
    return commandTemplates.find((t) => t.type === type)?.color || "bg-gray-500"
  }

  const handleSend = async () => {
    setSendStatus("sending");

    if (commands.length === 0) {
      setSendStatus("error");
      return;
    }

    const formattedCommands = commands.map((cmd) => {
      if (cmd.type === "move") return { "andar": cmd.value };
      if (cmd.type === "rotate") return { "virar": cmd.value > 0 ? "direita" : "esquerda" };
      if (cmd.type === "release") return { "lib_carga": "1" };
      return {};
    });

    const payload = { comandos: formattedCommands };

    try {
      const response = await fetch('/api/send-trajectory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log("Sucesso via API!");
        setSendStatus("success");
      } else {
        console.error("Erro na API");
        setSendStatus("error");
      }

    } catch (error) {
      console.error("Erro de rede:", error);
      setSendStatus("error");
    }
  };

  const resetStatus = () => {
    setSendStatus("idle");
    setTrajectoryName("");
    setCommands([]);
    setStoreInMemory(false);
  };

  const handleReset = () => {
    setCommands([]);
    setTrajectoryName("");
    setSendStatus("idle");
    setStoreInMemory(false);
  };

  // Polling para trajetória em tempo real
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        const res = await fetch("/api/telemetry");

        if (res.status === 204) {
          setIsConnected(true);
        } else if (!res.ok) {
          const data = await res.json().catch(() => ({}));
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
            setPoints((prev) => {
              const newPoint = { x: nextX as number, y: nextY as number };

              if (prev.length > 0) {
                const lastPoint = prev[prev.length - 1];
                const dx = newPoint.x - lastPoint.x;
                const dy = newPoint.y - lastPoint.y;
                const segmentDistance = Math.sqrt(dx * dx + dy * dy);

                setLastSegmentDistance(segmentDistance);
                setTotalDistance((current) => current + segmentDistance);
              }

              return [...prev, newPoint];
            });
          }
        }
      } catch (err) {
        console.error("[CreateTrajectory] Erro ao buscar telemetria:", err);
        setConnectionError("Erro de comunicação com o backend.");
        setIsConnected(false);
      } finally {
        if (!cancelled) {
          setTimeout(poll, 500);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [lastX, lastY]);

  // Normaliza os pontos para caberem num SVG 400x400 com padding generoso
  const scaledPoints = useMemo(() => {
    if (points.length === 0) return [];

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Padding maior para evitar que os desenhos fiquem nas bordas
    const padding = 50;
    const width = 400 - padding * 2;
    const height = 400 - padding * 2;

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;

    return points.map((p) => {
      const nx = (p.x - minX) / dx;
      const ny = (p.y - minY) / dy;

      const sx = padding + nx * width;
      const sy = padding + (1 - ny) * height;

      return { x: sx, y: sy };
    });
  }, [points]);

  const polylinePoints = useMemo(
    () => scaledPoints.map((p) => `${p.x},${p.y}`).join(" "),
    [scaledPoints]
  );

  const handleResetTrajectory = () => {
    setPoints([]);
    setLastX(null);
    setLastY(null);
    setTotalDistance(0);
    setLastSegmentDistance(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Criar e Enviar Trajetória</h1>
              <p className="text-sm text-muted-foreground">MQTT Controller</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex gap-6 max-w-7xl mx-auto">
          {/* Left Sidebar */}
          <aside className="w-80 flex-shrink-0">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Biblioteca</CardTitle>
                <CardDescription>Arraste os comandos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {commandTemplates.map((template) => (
                  <div
                    key={template.type}
                    draggable
                    onDragStart={() => handleTemplateDragStart(template)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <div
                      className={`${template.color} text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all hover:scale-105`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 rounded-lg p-2">{template.icon}</div>
                        <div className="flex-1">
                          <div className="font-semibold">{template.label}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sequência de Comandos</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`min-h-[400px] rounded-xl border-2 border-dashed p-6 transition-colors ${
                    dragOverIndex === null && (draggedTemplate || draggedCommandId)
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20"
                  }`}
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={() => handleDrop()}
                >
                  {commands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                      <p className="text-base font-medium text-foreground">Arraste comandos aqui</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {commands.map((command, index) => (
                        <div key={command.id} className="relative">
                          <div
                            className={`h-3 transition-all ${
                              dragOverIndex === index ? "bg-primary/20 rounded mb-2" : ""
                            }`}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={() => handleDrop(index)}
                          />

                          <div
                            draggable
                            onDragStart={() => handleCommandDragStart(command.id)}
                            className="cursor-grab active:cursor-grabbing relative"
                          >
                            <div
                              className={`${getCommandColor(command.type)} text-white rounded-xl p-5 shadow-lg relative`}
                            >
                              <div className="flex items-center gap-4">
                                <GripVertical className="h-5 w-5 opacity-50 flex-shrink-0" />
                                <Badge variant="secondary" className="font-mono bg-white/20 text-white border-0 text-sm px-3">
                                  {index + 1}
                                </Badge>

                                <div className="bg-white/20 rounded-lg p-2 flex-shrink-0">
                                  {}
                                  {command.type === 'rotate' ? (
                                     command.value > 0 ? <RotateCw className="h-5 w-5"/> : <RotateCcw className="h-5 w-5"/>
                                  ) : (
                                     commandTemplates.find((t) => t.type === command.type)?.icon
                                  )}
                                </div>

                                <div className="flex-1">
                                  <span className="font-semibold text-base">
                                    {commandTemplates.find((t) => t.type === command.type)?.label}
                                  </span>
                                </div>

                                {}
                                {command.type === "move" && (
                                  <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                                    <Input
                                      type="number"
                                      value={command.value}
                                      onChange={(e) => updateCommandValue(command.id, Number.parseFloat(e.target.value))}
                                      className="w-20 h-9 bg-white/30 border-white/40 text-white placeholder:text-white/50 font-semibold"
                                    />
                                    <span className="text-sm font-semibold">cm</span>
                                  </div>
                                )}

                                {command.type === "rotate" && (
                                  <div className="flex items-center gap-2 bg-white/20 rounded-lg px-1 py-1">
                                     <Select 
                                        value={command.value > 0 ? "direita" : "esquerda"} 
                                        onValueChange={(val) => updateCommandValue(command.id, val === "direita" ? 90 : -90)}
                                     >
                                      <SelectTrigger className="w-[110px] h-9 bg-white/30 border-white/40 text-white font-semibold">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="direita">Direita</SelectItem>
                                        <SelectItem value="esquerda">Esquerda</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeCommand(command.id)
                                  }}
                                  className="h-9 w-9 hover:bg-white/20 text-white flex-shrink-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Final drop zone */}
                      <div
                        className={`h-3 transition-all ${
                          dragOverIndex === commands.length ? "bg-primary/20 rounded mt-2" : ""
                        }`}
                        onDragOver={(e) => handleDragOver(e, commands.length)}
                        onDrop={() => handleDrop(commands.length)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {commands.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Enviar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sendStatus === "idle" && (
                    <div className="flex gap-2">
                      <Button onClick={handleSend} size="lg" className="flex-1">
                        <Send className="mr-2 h-5 w-5" />
                        Enviar via MQTT
                      </Button>
                      <Button onClick={handleReset} variant="outline" size="lg" className="flex-1">
                        <RotateCcw className="mr-2 h-5 w-5" />
                        Resetar
                      </Button>
                    </div>
                  )}
                  {sendStatus === "sending" && (
                    <p className="text-center text-muted-foreground">Enviando...</p>
                  )}
                  {sendStatus === "success" && (
                    <div className="space-y-2">
                      <div className="text-center text-green-600 font-bold">
                        Sucesso! Pacote JSON enviado.
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSend} variant="outline" className="flex-1">
                          <Send className="mr-2 h-4 w-4" />
                          Enviar Novamente
                        </Button>
                        <Button onClick={handleReset} variant="outline" className="flex-1">
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Resetar
                        </Button>
                      </div>
                    </div>
                  )}
                  {sendStatus === "error" && (
                    <div className="space-y-2">
                      <div className="text-center text-red-500 font-bold">
                        Erro ao conectar ou enviar. Verifique o console.
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSend} variant="outline" className="flex-1">
                          <Send className="mr-2 h-4 w-4" />
                          Tentar Novamente
                        </Button>
                        <Button onClick={handleReset} variant="outline" className="flex-1">
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Resetar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Trajetória em tempo real */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Trajetória do Carrinho</CardTitle>
                    <CardDescription>Visualização em tempo real da rota percorrida</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleResetTrajectory}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Resetar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <svg
                    viewBox="0 0 400 400"
                    className="w-full max-w-md aspect-square border rounded-md bg-background"
                  >
                    {/* Grade simples */}
                    <defs>
                      <pattern
                        id="grid-trajectory"
                        width="20"
                        height="20"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 20 0 L 0 0 0 20"
                          fill="none"
                          stroke="#e5e5e5"
                          strokeWidth="0.5"
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-trajectory)" />

                    {/* Pista - borda externa escura */}
                    {polylinePoints && (
                      <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke="#374151"
                        strokeWidth={14}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    
                    {/* Pista - base cinza */}
                    {polylinePoints && (
                      <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke="#9ca3af"
                        strokeWidth={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    
                    {/* Linha tracejada amarela no meio da pista */}
                    {polylinePoints && (
                      <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        strokeLinecap="round"
                      />
                    )}

                    {scaledPoints.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={2}
                        fill="#1d4ed8"
                        opacity={idx === scaledPoints.length - 1 ? 1 : 0.7}
                      />
                    ))}

                    {/* Relâmpago McQueen acompanhando a trajetória */}
                    {scaledPoints.length > 0 && (() => {
                      // Calcular direção do movimento para orientar o carro
                      const lastIdx = scaledPoints.length - 1;
                      const angle = lastIdx > 0 ? (() => {
                        const prev = scaledPoints[lastIdx - 1];
                        const curr = scaledPoints[lastIdx];
                        return Math.atan2(curr.y - prev.y, curr.x - prev.x) * (180 / Math.PI);
                      })() : 0;
                      
                      return (
                        <g
                          transform={`translate(${
                            scaledPoints[lastIdx].x
                          }, ${scaledPoints[lastIdx].y}) rotate(${angle})`}
                        >
                          {/* Corpo principal do carro - vermelho */}
                          <rect x={-10} y={-5} width={20} height={10} rx={3} fill="#DC143C" stroke="#B91C1C" strokeWidth={1.5} />
                          
                          {/* Parte frontal mais estreita */}
                          <rect x={8} y={-4} width={6} height={8} rx={2} fill="#DC143C" />
                          
                          {/* Janelas laterais - preto */}
                          <rect x={-6} y={-4} width={8} height={3} rx={1} fill="#1a1a1a" opacity={0.7} />
                          <rect x={-6} y={1} width={8} height={3} rx={1} fill="#1a1a1a" opacity={0.7} />
                          
                          {/* Número 95 centralizado */}
                          <text
                            x={0}
                            y={3}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="bold"
                            fill="#FFD700"
                            stroke="#000"
                            strokeWidth={0.5}
                            fontFamily="Arial, sans-serif"
                          >
                            95
                          </text>
                          
                          {/* Raios de luz frontal */}
                          <rect x={12} y={-2} width={3} height={4} rx={1} fill="#FFD700" opacity={0.8} />
                          
                          {/* Rodas - 4 rodas visíveis de cima */}
                          <circle cx={-6} cy={-6} r={3} fill="#1a1a1a" stroke="#000" strokeWidth={0.5} />
                          <circle cx={-6} cy={-6} r={2} fill="#333" />
                          <circle cx={-6} cy={-6} r={1} fill="#555" />
                          
                          <circle cx={6} cy={-6} r={3} fill="#1a1a1a" stroke="#000" strokeWidth={0.5} />
                          <circle cx={6} cy={-6} r={2} fill="#333" />
                          <circle cx={6} cy={-6} r={1} fill="#555" />
                          
                          <circle cx={-6} cy={6} r={3} fill="#1a1a1a" stroke="#000" strokeWidth={0.5} />
                          <circle cx={-6} cy={6} r={2} fill="#333" />
                          <circle cx={-6} cy={6} r={1} fill="#555" />
                          
                          <circle cx={6} cy={6} r={3} fill="#1a1a1a" stroke="#000" strokeWidth={0.5} />
                          <circle cx={6} cy={6} r={2} fill="#333" />
                          <circle cx={6} cy={6} r={1} fill="#555" />
                        </g>
                      );
                    })()}
                  </svg>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Distância total percorrida:{" "}
                  <span className="font-mono text-foreground">
                    {totalDistance.toFixed(0)} cm
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
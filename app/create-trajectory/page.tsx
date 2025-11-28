"use client"

import type React from "react"
import { useState } from "react"
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
                    <Button onClick={handleSend} size="lg" className="w-full">
                      <Send className="mr-2 h-5 w-5" />
                      Enviar via MQTT
                    </Button>
                  )}
                  {sendStatus === "sending" && <p className="text-center text-muted-foreground">Enviando...</p>}
                  {sendStatus === "success" && (
                    <div className="text-center text-green-600 font-bold">
                       Sucesso! Pacote JSON enviado.
                       <Button variant="link" onClick={resetStatus}>Novo envio</Button>
                    </div>
                  )}
                  {sendStatus === "error" && (
                    <div className="text-center text-red-500 font-bold">
                       Erro ao conectar ou enviar. Verifique o console.
                       <Button variant="link" onClick={resetStatus}>Tentar novamente</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
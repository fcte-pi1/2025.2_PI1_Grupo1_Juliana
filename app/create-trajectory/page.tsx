"use client"

import type React from "react"

import { useState } from "react"
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
} from "lucide-react"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"

type CommandType = "move" | "rotate" | "release"
type SendStatus = "idle" | "sending" | "success" | "error"

interface Command {
  id: string
  type: CommandType
  value: number
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
    defaultValue: 100,
    unit: "cm",
  },
  {
    type: "rotate",
    label: "Girar",
    icon: <RotateCw className="h-5 w-5" />,
    color: "bg-green-500",
    defaultValue: 90,
    unit: "°",
  },
  {
    type: "release",
    label: "Liberar Carga",
    icon: <Package className="h-5 w-5" />,
    color: "bg-orange-500",
    defaultValue: 0,
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
      // Adding new command from palette
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
      // Reordering existing command
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

    if (!trajectoryName || commands.length === 0) {
      console.error("Nome ou comandos faltando");
      setSendStatus("error");
      return;
    }

    // Backend expects { nome: string, trechos: [{ comando, parametro, ordem }] }
    const payloadTrechos = commands.map(({ type, value }, index) => ({
      comando: type, // 'move' | 'rotate' | 'release'
      parametro: value,
      ordem: index,
    }));

    const payload = {
      nome: trajectoryName,
      trechos: payloadTrechos,
    };

    try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          if (!apiUrl) {
            throw new Error("API URL não está configurada");
          }

          const response = await fetch(`${apiUrl}/circuitos/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

      if (response.ok) {
        const result = await response.json();
        console.log("Trajetória salva com sucesso:", result);
        setSendStatus("success");
      } else {
        console.error("Falha ao salvar trajetória:", response.statusText);
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
      {/* Header */}
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
              <p className="text-sm text-muted-foreground">Arraste comandos para construir a sequência</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex gap-6 max-w-7xl mx-auto">
          {/* Left Sidebar - Command Library */}
          <aside className="w-80 flex-shrink-0">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Biblioteca de Comandos</CardTitle>
                <CardDescription>Arraste para a área de construção</CardDescription>
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
                      className={`${template.color} text-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all hover:scale-105 hover:-translate-y-1`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 rounded-lg p-2">{template.icon}</div>
                        <div className="flex-1">
                          <div className="font-semibold">{template.label}</div>
                          {template.unit && (
                            <div className="text-xs opacity-90 mt-0.5">
                              Padrão: {template.defaultValue} {template.unit}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>

          {/* Main Content - Building Area */}
          <div className="flex-1 space-y-6">
            {/* Trajectory Name */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label htmlFor="trajectory-name">Nome da Trajetória</Label>
                  <Input
                    id="trajectory-name"
                    placeholder="Ex: Rota de Entrega A"
                    value={trajectoryName}
                    onChange={(e) => setTrajectoryName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sequence Builder */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sequência de Comandos</CardTitle>
                    <CardDescription>
                      {commands.length} comando{commands.length !== 1 ? "s" : ""} na sequência
                    </CardDescription>
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
                      <div className="rounded-full bg-muted p-8 mb-4">
                        <MoveVertical className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <p className="text-base font-medium text-foreground">Arraste comandos aqui</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Comece arrastando um comando da biblioteca ao lado
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {commands.map((command, index) => (
                        <div key={command.id} className="relative">
                          {/* Drop zone indicator */}
                          <div
                            className={`h-3 transition-all ${
                              dragOverIndex === index ? "bg-primary/20 rounded mb-2" : ""
                            }`}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={() => handleDrop(index)}
                          />

                          {/* Command Card */}
                          <div
                            draggable
                            onDragStart={() => handleCommandDragStart(command.id)}
                            className="cursor-grab active:cursor-grabbing relative"
                          >
                            <div
                              className={`${getCommandColor(command.type)} text-white rounded-xl p-5 shadow-lg hover:shadow-xl transition-all relative`}
                            >
                              <div className="flex items-center gap-4">
                                <GripVertical className="h-5 w-5 opacity-50 flex-shrink-0" />
                                <Badge
                                  variant="secondary"
                                  className="font-mono bg-white/20 text-white border-0 text-sm px-3"
                                >
                                  {index + 1}
                                </Badge>

                                <div className="bg-white/20 rounded-lg p-2 flex-shrink-0">
                                  {commandTemplates.find((t) => t.type === command.type)?.icon}
                                </div>

                                <div className="flex-1">
                                  <span className="font-semibold text-base">
                                    {commandTemplates.find((t) => t.type === command.type)?.label}
                                  </span>
                                </div>

                                {command.type !== "release" && (
                                  <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                                    <Input
                                      type="number"
                                      value={command.value}
                                      onChange={(e) =>
                                        updateCommandValue(command.id, Number.parseFloat(e.target.value))
                                      }
                                      className="w-20 h-9 bg-white/30 border-white/40 text-white placeholder:text-white/50 font-semibold"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-sm font-semibold">{command.unit}</span>
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

                          {index < commands.length - 1 && (
                            <div className="flex justify-center py-2">
                              <div className="w-0.5 h-6 bg-border relative">
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-border rounded-full" />
                              </div>
                            </div>
                          )}
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
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Opções de Envio</CardTitle>
                    <CardDescription>Configure como a trajetória será enviada</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="store-memory"
                        checked={storeInMemory}
                        onCheckedChange={(checked) => setStoreInMemory(checked as boolean)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label
                          htmlFor="store-memory"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Armazenar na memória do carrinho
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          A trajetória será salva na memória local do carrinho para execução offline
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Enviar Trajetória</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sendStatus === "idle" && (
                      <div className="text-center py-6">
                        <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
                          <Send className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Pronto para enviar {commands.length} comando{commands.length !== 1 ? "s" : ""}
                        </p>
                        <Button onClick={handleSend} size="lg" className="w-full">
                          <Send className="mr-2 h-5 w-5" />
                          Enviar Sequência Completa
                        </Button>
                      </div>
                    )}

                    {sendStatus === "sending" && (
                      <div className="text-center py-8">
                        <div className="rounded-full bg-primary/10 p-4 w-fit mx-auto mb-4">
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">Enviando trajetória...</p>
                        <p className="text-xs text-muted-foreground">Transmitindo {commands.length} comandos</p>
                      </div>
                    )}

                    {sendStatus === "success" && (
                      <div className="text-center py-8">
                        <div className="rounded-full bg-green-500/10 p-4 w-fit mx-auto mb-4">
                          <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">Trajetória enviada com sucesso!</p>
                        <p className="text-xs text-muted-foreground">
                          O carrinho está pronto para executar a sequência
                        </p>
                        <div className="flex gap-2 justify-center mt-4">
                          <Link href="/telemetry">
                            <Button size="sm">Ver Telemetria</Button>
                          </Link>
                          <Button size="sm" variant="outline" onClick={resetStatus}>
                            Criar Nova Trajetória
                          </Button>
                        </div>
                      </div>
                    )}

                    {sendStatus === "error" && (
                      <div className="text-center py-8">
                        <div className="rounded-full bg-destructive/10 p-4 w-fit mx-auto mb-4">
                          <AlertCircle className="h-8 w-8 text-destructive" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">Erro ao enviar trajetória</p>
                        <p className="text-xs text-muted-foreground">Verifique a conexão e tente novamente</p>
                        <Button size="sm" variant="outline" onClick={resetStatus} className="mt-4 bg-transparent">
                          Tentar Novamente
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

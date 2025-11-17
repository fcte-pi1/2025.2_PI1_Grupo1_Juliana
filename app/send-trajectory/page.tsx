"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Send, CheckCircle2, AlertCircle, Loader2, MoveVertical, RotateCw, Package, LucideIcon } from "lucide-react"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type SendStatus = "idle" | "sending" | "success" | "error"

interface Command {
  id: number
  type: "move" | "rotate" | "release"
  value: number
  unit: string
  order: number
}

interface Trajectory {
  id: number
  name: string
  store_in_memory: boolean
  status: string
  commands: Command[]
}

const getCommandInfo = (command: Command): { Icon: LucideIcon, color: string, label: string } => {
  switch (command.type) {
    case "move":
      return { Icon: MoveVertical, color: "bg-blue-500", label: "Andar" }
    case "rotate":
      return { Icon: RotateCw, color: "bg-purple-500", label: "Girar" }
    case "release":
      return { Icon: Package, color: "bg-green-500", label: "Liberar Carga" }
    default:
      return { Icon: AlertCircle, color: "bg-gray-500", label: "Desconhecido" }
  }
}

export default function SendTrajectory() {
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle")
  const [storeInMemory, setStoreInMemory] = useState(false)
  const [trajectories, setTrajectories] = useState<Trajectory[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTrajectories = async () => {
      setIsLoading(true)
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        // backend migrated trajectories -> circuitos
        const response = await fetch(`${apiUrl}/circuitos/`)

        if (!response.ok) {
          throw new Error("Falha ao buscar trajetórias")
        }

        const data = await response.json()
        // map backend CircuitoRead -> frontend Trajectory shape
        const mapped: Trajectory[] = data.map((c: any) => ({
          id: c.id_circuito,
          name: c.nome || c.name || `Circuito ${c.id_circuito}`,
          store_in_memory: false,
          status: "saved",
          commands: (c.trechos || []).map((t: any) => ({
            id: t.id_trecho ?? Math.random(),
            type: (t.comando || "move").toLowerCase() === "rotate" ? "rotate" : "move",
            value: t.parametro,
            unit: "",
            order: t.ordem ?? 0,
          })),
        }))
        setTrajectories(mapped)
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrajectories()
  }, [])

  const handleSend = async () => {
    if (!selectedId) {
      alert("Por favor, selecione uma trajetória para enviar.")
      return
    }

    setSendStatus("sending")
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

      // Backend expects ExecutionStart: { id_circuito, id_carrinho, tempo_estimado? }
      const payload = {
        id_circuito: selectedId,
        // default to simulated/local cart id 1 if not selecting carts in UI
        id_carrinho: 1,
      }

      const response = await fetch(`${apiUrl}/execucoes/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => null)
        console.error("Falha ao enviar. status:", response.status, text)
        throw new Error("Falha ao enviar trajetória")
      }

      const result = await response.json()
      console.log("Trajetória enviada com sucesso:", result)
      setSendStatus("success")
    } catch (error) {
      console.error("Erro ao enviar trajetória:", error)
      setSendStatus("error")
    }
  }

  const resetStatus = () => {
    setSendStatus("idle")
    setSelectedId(null)
  }

  const selectedTrajectory = trajectories.find((t) => t.id === selectedId)

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
              <h1 className="text-xl font-bold text-foreground">Enviar Trajetória</h1>
              <p className="text-sm text-muted-foreground">Transmita a sequência completa para o carrinho</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">   

          {/*Trajetória Selecionada*/}
          <Card>
            <CardHeader>
              <CardTitle>Trajetória Selecionada</CardTitle>
              {selectedTrajectory ? (
                <CardDescription>
                  Sequência de {selectedTrajectory.commands.length} comandos
                </CardDescription>
              ) : (
                <CardDescription>
                  Nenhuma trajetória selecionada
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedTrajectory ? (
                <>
                  <div className="space-y-2 mb-4">
                    <h3 className="font-semibold text-foreground">{selectedTrajectory.name}</h3>
                  </div>
                  <div className="space-y-2">
                    {selectedTrajectory.commands.map((command, index) => {
                      const { Icon, color, label } = getCommandInfo(command)
                      return (
                        <div key={command.id} className={`${color} text-white rounded-lg p-3 shadow-sm`}>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="font-mono bg-white/20 text-white border-0">
                              {index + 1}
                            </Badge>
                            <Icon className="h-4 w-4" />
                            <span className="font-medium text-sm">{label}</span>
                            {command.unit && (
                              <span className="text-sm ml-auto">
                                {command.value} {command.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <p>Selecione uma trajetória da lista abaixo para ver os detalhes.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/*Selecionar Trajetória*/}
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Trajetória</CardTitle>
              <CardDescription>Escolha a trajetória que deseja enviar ao carrinho</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p>Carregando trajetórias...</p>}
              
              {!isLoading && trajectories.length === 0 && (
                <p className="text-muted-foreground">Nenhuma trajetória salva foi encontrada.</p>
              )}

              {trajectories.map((trajectory) => {
                const isSelected = trajectory.id === selectedId
                const firstCommand = trajectory.commands[0]
                return (
                  <div
                    key={trajectory.id}
                    className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:bg-accent/5"
                    }`}
                    onClick={() => setSelectedId(trajectory.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{trajectory.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {trajectory.commands.length} comandos
                        </p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {firstCommand && (
                             <Badge variant={isSelected ? "secondary" : "outline"} className="text-xs">
                                {getCommandInfo(firstCommand).label}: {firstCommand.value}{firstCommand.unit}
                             </Badge>
                          )}
                          {trajectory.commands.length > 1 && (
                            <Badge variant={isSelected ? "secondary" : "outline"} className="text-xs">
                              +{trajectory.commands.length - 1} mais
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 ${
                        isSelected ? "border-primary bg-primary" : "border-border"
                      } flex-shrink-0`}>
                        {isSelected && <div className="h-full w-full p-0.5"><div className="h-full w-full rounded-full bg-primary-foreground" /></div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Opções de Envio*/}
          {selectedTrajectory && (
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

              {/* Status de Envio */}
              <Card>
                <CardHeader>
                  <CardTitle>Status de Envio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sendStatus === "idle" && (
                    <div className="text-center py-8">
                      <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
                        <Send className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Pronto para enviar a sequência completa</p>
                    </div>
                  )}
                  {sendStatus === "sending" && (
                    <div className="text-center py-8">
                      <div className="rounded-full bg-primary/10 p-4 w-fit mx-auto mb-4">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">Enviando trajetória...</p>
                      <p className="text-xs text-muted-foreground">
                        Transmitindo {selectedTrajectory.commands.length} comandos
                      </p>
                    </div>
                  )}
                  {sendStatus === "success" && (
                    <div className="text-center py-8">
                      <div className="rounded-full bg-chart-5/10 p-4 w-fit mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-chart-5" />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">Trajetória enviada com sucesso!</p>
                      <p className="text-xs text-muted-foreground">O carrinho está pronto para executar a sequência</p>
                      <div className="flex gap-2 justify-center mt-4">
                        <Link href="/telemetry">
                          <Button size="sm">Ver Telemetria</Button>
                        </Link>
                        <Button size="sm" variant="outline" onClick={resetStatus}>
                          Enviar Outra
                        </Button>
                      </div>
                    </div>
                  )}
                  {sendStatus === "error" && (
                    <div className="text-center py-8">
                      {/* ... (Erro) ... */}
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

                  {sendStatus === "idle" && (
                    <Button onClick={handleSend} className="w-full" size="lg">
                      <Send className="mr-2 h-5 w-5" />
                      Enviar Sequência Completa
                    </Button>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
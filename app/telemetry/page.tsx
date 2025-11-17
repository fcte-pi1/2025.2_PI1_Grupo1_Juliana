"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Wifi, WifiOff, Play, Pause, RotateCcw } from "lucide-react"
import Link from "next/link"

interface ExecutionLog {
  id_log: number
  timestamp: string
  posicao_x: number
  posicao_y: number
  orientacao: number
  velocidade: number
  observacao: string
}

export default function Telemetry() {
  const [isConnected, setIsConnected] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [rotation, setRotation] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [distance, setDistance] = useState(0)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [logIndex, setLogIndex] = useState(0)

  // Load latest execution logs from backend
  useEffect(() => {
    const fetchLatestExecution = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        
        // Try to get the latest execution - default to ID 1 for now
        const response = await fetch(`${apiUrl}/execucoes/1/logs`)
        if (response.ok) {
          const data: ExecutionLog[] = await response.json()
          setLogs(data)
          setIsConnected(true)
        }
      } catch (error) {
        console.error("Erro ao carregar logs:", error)
        setIsConnected(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLatestExecution()
  }, [])

  // Simulate cart movement or playback from logs
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 0.1)

      // If we have logs, playback from them, otherwise simulate
      if (logs.length > 0 && logIndex < logs.length) {
        const log = logs[logIndex]
        setPosition({ x: log.posicao_x, y: log.posicao_y })
        setRotation(log.orientacao)
        setDistance((prev) => prev + log.velocidade * 0.1)
        setLogIndex((prev) => (prev + 1) % logs.length)
      } else {
        // Fallback to simulation
        setDistance((prev) => prev + 2)
        setPosition((prev) => ({
          x: prev.x + Math.cos((rotation * Math.PI) / 180) * 0.5,
          y: prev.y + Math.sin((rotation * Math.PI) / 180) * 0.5,
        }))
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isRunning, rotation, logs, logIndex])

  const toggleExecution = () => {
    setIsRunning(!isRunning)
  }

  const resetSimulation = () => {
    setIsRunning(false)
    setPosition({ x: 50, y: 50 })
    setRotation(0)
    setElapsedTime(0)
    setDistance(0)
  }

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
                <h1 className="text-xl font-bold text-foreground">Telemetria em Tempo Real</h1>
                <p className="text-sm text-muted-foreground">Acompanhe a execução do carrinho</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="default" className="gap-1.5 bg-chart-5 hover:bg-chart-5">
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
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Visualization */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Visualização 2D</CardTitle>
                    <CardDescription>Posição e trajetória do carrinho</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={isRunning ? "secondary" : "default"} onClick={toggleExecution}>
                      {isRunning ? (
                        <>
                          <Pause className="mr-2 h-4 w-4" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Iniciar
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetSimulation}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                  {/* Grid */}
                  <svg className="absolute inset-0 w-full h-full">
                    <defs>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="0.5"
                          className="text-border"
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>

                  {/* Path trail */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line
                      x1="50%"
                      y1="50%"
                      x2={`${position.x}%`}
                      y2={`${position.y}%`}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      className="text-primary/30"
                    />
                  </svg>

                  {/* Cart */}
                  <div
                    className="absolute w-8 h-8 -ml-4 -mt-4 transition-all duration-100"
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      transform: `rotate(${rotation}deg)`,
                    }}
                  >
                    <div className="relative w-full h-full">
                      <div className="absolute inset-0 bg-primary rounded-lg shadow-lg" />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-secondary rounded-full" />
                      {isRunning && <div className="absolute inset-0 bg-primary rounded-lg animate-ping opacity-75" />}
                    </div>
                  </div>

                  {/* Start position marker */}
                  <div className="absolute top-1/2 left-1/2 -ml-2 -mt-2 w-4 h-4 border-2 border-dashed border-muted-foreground rounded-full" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Posição X:</span>
                    <span className="ml-2 font-mono font-medium">{position.x.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Posição Y:</span>
                    <span className="ml-2 font-mono font-medium">{position.y.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rotação:</span>
                    <span className="ml-2 font-mono font-medium">{rotation.toFixed(0)}°</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={isRunning ? "default" : "secondary"} className="ml-2">
                      {isRunning ? "Em Execução" : "Parado"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Telemetry Data */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados em Tempo Real</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Tempo Decorrido</span>
                  </div>
                  <div className="text-2xl font-bold font-mono">{elapsedTime.toFixed(1)}s</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Distância Percorrida</span>
                  </div>
                  <div className="text-2xl font-bold font-mono">{distance.toFixed(0)} cm</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Velocidade Média</span>
                  </div>
                  <div className="text-2xl font-bold font-mono">
                    {elapsedTime > 0 ? (distance / elapsedTime).toFixed(1) : "0.0"} cm/s
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bateria</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-chart-5" style={{ width: "87%" }} />
                    </div>
                    <span className="text-sm font-medium">87%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Temperatura</span>
                  <span className="text-sm font-medium">42°C</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sinal</span>
                  <Badge variant="outline" className="bg-chart-5/10 text-chart-5 border-chart-5/20">
                    Excelente
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Comandos Restantes</span>
                  <span className="text-sm font-medium">3 de 5</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alertas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Nenhum alerta no momento</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

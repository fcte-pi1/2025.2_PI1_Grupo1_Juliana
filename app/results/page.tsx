"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Download, CheckCircle2, Clock, Route, TrendingUp, Loader2, AlertCircle, FileJson, FileText } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

interface Execution {
  id_execucao: number
  id_carrinho: number
  id_circuito: number
  data_inicio: string
  data_fim: string
  status: string
  tempo_estimado: string
}

interface ExecutionLog {
  id_log: number
  timestamp: string
  posicao_atual: string
  velocidade: number
  posicao_x: number
  posicao_y: number
  orientacao: number
  observacao: string
}

export default function Results() {
  const searchParams = useSearchParams()
  const executionId = searchParams.get("id") || "1"
  
  const [execution, setExecution] = useState<Execution | null>(null)
  const [logs, setLogs] = useState<ExecutionLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        
        // Buscar detalhes da execução
        const execResponse = await fetch(`${apiUrl}/execucoes/${executionId}`)
        if (!execResponse.ok) {
          throw new Error("Falha ao buscar detalhes da execução")
        }
        const execData = await execResponse.json()
        setExecution(execData)
        
        // Buscar logs de telemetria
        const logsResponse = await fetch(`${apiUrl}/execucoes/${executionId}/logs`)
        if (!logsResponse.ok) {
          throw new Error("Falha ao buscar logs")
        }
        const logsData = await logsResponse.json()
        setLogs(logsData)
        
      } catch (err) {
        console.error("Erro ao buscar dados:", err)
        setError(err instanceof Error ? err.message : "Erro ao carregar dados")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [executionId])

  const handleExport = async (format: "csv" | "txt") => {
    setIsExporting(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${apiUrl}/execucoes/${executionId}/export/csv`)
      
      if (!response.ok) {
        throw new Error("Falha ao exportar dados")
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `execucao_${executionId}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Erro ao exportar:", err)
      alert("Erro ao exportar dados. Tente novamente.")
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados da execução...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Erro ao Carregar</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Link href="/">
              <Button variant="outline" className="w-full">Voltar ao Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!execution) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Execução não encontrada</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="outline" className="w-full">Voltar ao Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

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
              <h1 className="text-xl font-bold text-foreground">Resultados da Execução</h1>
              <p className="text-sm text-muted-foreground">Análise e exportação de dados</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Execution Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Resumo da Execução</CardTitle>
                  <CardDescription>
                    Execução #{execution.id_execucao} • {execution.data_inicio ? new Date(execution.data_inicio).toLocaleString("pt-BR") : "Data não disponível"}
                  </CardDescription>
                </div>
                <Badge className={execution.status === "completed" ? "bg-chart-5 hover:bg-chart-5" : "bg-yellow-500 hover:bg-yellow-600"}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  {execution.status === "completed" ? "Concluída" : execution.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Tempo Total</span>
                  </div>
                  <div className="text-2xl font-bold">{execution.tempo_estimado || "N/A"}</div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Route className="h-4 w-4" />
                    <span className="text-sm">Logs Coletados</span>
                  </div>
                  <div className="text-2xl font-bold">{logs.length}</div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Velocidade Média</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {logs.length > 0 
                      ? (logs.reduce((sum, log) => sum + (log.velocidade || 0), 0) / logs.length).toFixed(1)
                      : "0.0"
                    } cm/s
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Carrinho</span>
                  </div>
                  <div className="text-2xl font-bold">#{execution.id_carrinho}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trajectory Details */}
          <Card>
            <CardHeader>
              <CardTitle>Trajetória Percorrida</CardTitle>
              <CardDescription>Sequência de logs coletados ({logs.length} registros)</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log disponível para esta execução
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {logs.slice(0, 20).map((log, index) => (
                    <div key={log.id_log} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                      <Badge variant="outline" className="font-mono">
                        {index + 1}
                      </Badge>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Log #{log.id_log}</span>
                          {log.posicao_atual && <span className="text-sm text-muted-foreground">{log.posicao_atual}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(log.timestamp).toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-chart-5" />
                    </div>
                  ))}
                  {logs.length > 20 && (
                    <div className="text-center text-sm text-muted-foreground py-2">
                      +{logs.length - 20} mais logs...
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Telemetry Data */}
          <Card>
            <CardHeader>
              <CardTitle>Dados de Telemetria</CardTitle>
              <CardDescription>Informações coletadas durante a execução</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado de telemetria disponível
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Primeira Leitura</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Posição X:</span>
                        <span className="font-mono">{logs[0]?.posicao_x?.toFixed(2) || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Posição Y:</span>
                        <span className="font-mono">{logs[0]?.posicao_y?.toFixed(2) || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rotação:</span>
                        <span className="font-mono">{logs[0]?.orientacao?.toFixed(2) || "N/A"}°</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Última Leitura</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Posição X:</span>
                        <span className="font-mono">{logs[logs.length - 1]?.posicao_x?.toFixed(2) || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Posição Y:</span>
                        <span className="font-mono">{logs[logs.length - 1]?.posicao_y?.toFixed(2) || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rotação:</span>
                        <span className="font-mono">{logs[logs.length - 1]?.orientacao?.toFixed(2) || "N/A"}°</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Velocidade</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mínima:</span>
                        <span className="font-mono">
                          {Math.min(...logs.map(l => l.velocidade || 0)).toFixed(2)} cm/s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Máxima:</span>
                        <span className="font-mono">
                          {Math.max(...logs.map(l => l.velocidade || 0)).toFixed(2)} cm/s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Média:</span>
                        <span className="font-mono">
                          {(logs.reduce((sum, l) => sum + (l.velocidade || 0), 0) / logs.length).toFixed(2)} cm/s
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Tempo</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Primeira:</span>
                        <span className="font-mono">{new Date(logs[0]?.timestamp).toLocaleTimeString("pt-BR")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última:</span>
                        <span className="font-mono">{new Date(logs[logs.length - 1]?.timestamp).toLocaleTimeString("pt-BR")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duração:</span>
                        <span className="font-mono">
                          {logs.length > 1 
                            ? (
                              (new Date(logs[logs.length - 1]?.timestamp).getTime() - 
                               new Date(logs[0]?.timestamp).getTime()) / 1000
                            ).toFixed(1)
                            : "N/A"
                          }s
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle>Exportar Dados</CardTitle>
              <CardDescription>Baixe os dados desta execução em diferentes formatos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full" 
                variant="outline"
                disabled={isExporting || !execution}
                onClick={() => handleExport("csv")}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exportando..." : "Exportar como CSV"}
              </Button>
              <Button className="w-full" variant="outline" disabled={!execution}>
                <FileJson className="mr-2 h-4 w-4" />
                Exportar como JSON
              </Button>
              <Button className="w-full" variant="outline" disabled={!execution}>
                <FileText className="mr-2 h-4 w-4" />
                Exportar Relatório
              </Button>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

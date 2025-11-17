"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Navigation2, Route, Activity, BarChart3, Wifi, WifiOff } from "lucide-react"
import Link from "next/link"

interface TrajectoryStats {
  total_saved: number
  total_executed: number
}

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState(true)
  const [stats, setStats] = useState<TrajectoryStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        // Backend uses 'circuitos' (Portuguese) for trajectories entities
        const response = await fetch(`${apiUrl}/circuitos/stats`)

        if (!response.ok) {
          throw new Error("Falha ao buscar estatísticas")
        }
        
        const data: TrajectoryStats = await response.json()
        setStats(data)
      } catch (error) {
        console.error("Erro ao buscar estatísticas:", error)
        setStats({ total_saved: 0, total_executed: 0 })
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Navigation2 className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">RoboCart Control</h1>
                <p className="text-sm text-muted-foreground">Sistema de Controle Robótico</p>
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

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard</h2>
          <p className="text-muted-foreground">Acesso rápido às principais funcionalidades do sistema</p>
        </div>

        {/* Quick Access Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/create-trajectory" className="group">
            <Card className="transition-all hover:shadow-lg hover:border-primary cursor-pointer h-full">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
                  <Route className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Criar Trajetória</CardTitle>
                <CardDescription>Adicione comandos e planeje a rota do carrinho</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/send-trajectory" className="group">
            <Card className="transition-all hover:shadow-lg hover:border-primary cursor-pointer h-full">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10 mb-3 group-hover:bg-secondary/20 transition-colors">
                  <Navigation2 className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle className="text-lg">Enviar Trajetória</CardTitle>
                <CardDescription>Transmita a trajetória para o carrinho robótico</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/telemetry" className="group">
            <Card className="transition-all hover:shadow-lg hover:border-primary cursor-pointer h-full">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 mb-3 group-hover:bg-accent/20 transition-colors">
                  <Activity className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-lg">Telemetria em Tempo Real</CardTitle>
                <CardDescription>Acompanhe a execução e posição do carrinho</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/results" className="group">
            <Card className="transition-all hover:shadow-lg hover:border-primary cursor-pointer h-full">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-1/10 mb-3 group-hover:bg-chart-1/20 transition-colors">
                  <BarChart3 className="h-6 w-6 text-chart-1" />
                </div>
                <CardTitle className="text-lg">Resultados</CardTitle>
                <CardDescription>Analise dados e exporte relatórios de execução</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Status Overview */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Conexão</span>
                  <Badge
                    variant={isConnected ? "default" : "destructive"}
                    className={isConnected ? "bg-chart-5 hover:bg-chart-5" : ""}
                  >
                    {isConnected ? "Online" : "Offline"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bateria</span>
                  <span className="text-sm font-medium">87%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Última Execução</span>
                  <span className="text-sm font-medium">Há 2h</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trajetórias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Salvas</span>
                  <span className="text-sm font-medium">
                    {isLoading ? "..." : stats?.total_saved ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Executadas</span>
                  <span className="text-sm font-medium">
                    {isLoading ? "..." : stats?.total_executed ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Taxa de Sucesso</span>
                  <span className="text-sm font-medium">
                    {isLoading ? "..." : "N/A"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
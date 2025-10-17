import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Package, Truck, AlertTriangle, TrendingUp, Box } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface DashboardStats {
  activeEvents: number;
  upcomingTrips: number;
  lowStockItems: number;
  conflictsCount: number;
}

interface RecentEvent {
  id: string;
  name: string;
  client: string;
  eventDate: string;
  status: string;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentEvents, isLoading: eventsLoading } = useQuery<RecentEvent[]>({
    queryKey: ["/api/dashboard/recent-events"],
  });

  if (statsLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Eventos Ativos",
      value: stats?.activeEvents || 0,
      icon: Calendar,
      description: "Em andamento",
      color: "text-chart-1",
      testId: "stat-active-events"
    },
    {
      title: "Viagens Próximas",
      value: stats?.upcomingTrips || 0,
      icon: Truck,
      description: "Próximos 7 dias",
      color: "text-chart-2",
      testId: "stat-upcoming-trips"
    },
    {
      title: "Itens com Estoque Baixo",
      value: stats?.lowStockItems || 0,
      icon: Package,
      description: "Abaixo do mínimo",
      color: "text-chart-5",
      testId: "stat-low-stock"
    },
    {
      title: "Conflitos",
      value: stats?.conflictsCount || 0,
      icon: AlertTriangle,
      description: "Requer atenção",
      color: "text-destructive",
      testId: "stat-conflicts"
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard de Operações</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitore eventos, estoque e operações logísticas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={stat.testId}>{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Eventos Recentes
            </CardTitle>
            <CardDescription>Atividade mais recente</CardDescription>
          </CardHeader>
          <CardContent>
            {!recentEvents || recentEvents.length === 0 ? (
              <div className="text-center py-8">
                <Box className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">Nenhum evento recente</p>
                <Button asChild variant="outline" size="sm" className="mt-4" data-testid="button-create-event">
                  <Link href="/events">Criar Evento</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="flex items-center justify-between p-3 rounded-md hover-elevate border border-border"
                    data-testid={`event-${event.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.name}</p>
                      <p className="text-xs text-muted-foreground">{event.client}</p>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <StatusBadge status={event.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start" variant="outline" data-testid="button-new-event">
              <Link href="/events">
                <Calendar className="h-4 w-4 mr-2" />
                Create New Event
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" data-testid="button-new-request">
              <Link href="/requests">
                <Package className="h-4 w-4 mr-2" />
                New Material Request
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" data-testid="button-plan-trip">
              <Link href="/trips">
                <Truck className="h-4 w-4 mr-2" />
                Plan Trip
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" data-testid="button-view-inventory">
              <Link href="/inventory">
                <Box className="h-4 w-4 mr-2" />
                View Inventory
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

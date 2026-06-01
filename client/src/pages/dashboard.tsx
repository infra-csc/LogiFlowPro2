import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Package, Truck, AlertTriangle, TrendingUp, Box, Bell, CheckCheck, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import type { Notification } from "@shared/schema";

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
  const [, setLocation] = useLocation();
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentEvents, isLoading: eventsLoading } = useQuery<RecentEvent[]>({
    queryKey: ["/api/dashboard/recent-events"],
  });
  
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });
  
  const unreadNotifications = notifications.filter(n => !n.isRead);
  
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/notifications/${id}/read`, {});
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/read-all", {});
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
    }
  };

  if (statsLoading || eventsLoading) {
    return <PageLoading message="Carregando dashboard..." />;
  }

  const statCards = [
    {
      title: "Eventos Ativos",
      value: stats?.activeEvents || 0,
      icon: Calendar,
      description: "Em andamento",
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
      testId: "stat-active-events"
    },
    {
      title: "Viagens Próximas",
      value: stats?.upcomingTrips || 0,
      icon: Truck,
      description: "Próximos 7 dias",
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
      testId: "stat-upcoming-trips"
    },
    {
      title: "Itens com Estoque Baixo",
      value: stats?.lowStockItems || 0,
      icon: Package,
      description: "Abaixo do mínimo",
      color: "text-chart-5",
      bgColor: "bg-chart-5/10",
      testId: "stat-low-stock"
    },
    {
      title: "Conflitos",
      value: stats?.conflictsCount || 0,
      icon: AlertTriangle,
      description: "Requer atenção",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      testId: "stat-conflicts"
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard de Operações"
        description="Monitore eventos, estoque e operações logísticas"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover-elevate border-border/60 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight" data-testid={stat.testId}>{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Notifications Section */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-base text-foreground">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-primary/70" />
                </div>
                Notificações Recentes
              </div>
              {unreadNotifications.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {unreadNotifications.length} não lida{unreadNotifications.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
            {unreadNotifications.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                data-testid="button-mark-all-read-dashboard"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
          <ScrollArea className="h-[300px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Bell className="h-7 w-7 text-primary/40" />
                </div>
                <p className="text-sm font-medium">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.slice(0, 10).map((notification) => (
                  <Card
                    key={notification.id}
                    className={!notification.isRead ? "border-primary" : ""}
                    data-testid={`notification-card-${notification.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <Badge variant="default" className="text-xs">Nova</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {notification.message}
                          </p>
                          {notification.actionUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleNotificationClick(notification)}
                              className="h-auto p-0 text-xs text-primary underline-offset-4 hover:underline"
                              data-testid={`button-view-notification-${notification.id}`}
                            >
                              Ver detalhes
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 font-semibold text-base mb-1">
              <Calendar className="h-5 w-5" />
              Eventos Recentes
            </div>
            <p className="text-sm text-muted-foreground mb-4">Atividade mais recente</p>
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

        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-base text-foreground mb-1">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary/70" />
              </div>
              Ações Rápidas
            </div>
            <p className="text-sm text-muted-foreground mb-4">Operações mais comuns</p>
            <Button asChild className="w-full justify-start" variant="outline" data-testid="button-new-event">
              <Link href="/events">
                <Calendar className="h-4 w-4 mr-2" />
                Criar Novo Evento
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" data-testid="button-new-request">
              <Link href="/requests">
                <Package className="h-4 w-4 mr-2" />
                Nova Requisição
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" data-testid="button-plan-trip">
              <Link href="/trips">
                <Truck className="h-4 w-4 mr-2" />
                Planejar Viagem
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline" data-testid="button-view-inventory">
              <Link href="/inventory">
                <Box className="h-4 w-4 mr-2" />
                Ver Estoque
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

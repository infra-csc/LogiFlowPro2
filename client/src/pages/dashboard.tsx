import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Package,
  Truck,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Box,
  Bell,
  CheckCheck,
  ExternalLink,
  Clock,
  Info,
  MessageSquare,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getNotificationIcon(type: string | null | undefined) {
  switch (type) {
    case "mention":
      return MessageSquare;
    case "warning":
    case "alert":
      return AlertTriangle;
    case "info":
      return Info;
    default:
      return Bell;
  }
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentEvents, isLoading: eventsLoading } = useQuery<RecentEvent[]>({
    queryKey: ["/api/dashboard/recent-events"],
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const unreadNotifications = notifications.filter((n) => !n.isRead);

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

  const greeting = getGreeting();
  const firstName = user?.name?.split(" ")[0] || user?.username || "";
  const todayLabel = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const todayFormatted = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);
  const greetingLine = firstName ? `${greeting}, ${firstName}! · ${todayFormatted}` : `${greeting}! · ${todayFormatted}`;

  const conflicts = stats?.conflictsCount || 0;

  const statCards = [
    {
      title: "Eventos Ativos",
      value: stats?.activeEvents || 0,
      icon: Calendar,
      description: "Em andamento",
      color: "text-primary",
      bgColor: "bg-primary/10",
      href: "/events",
      testId: "stat-active-events",
    },
    {
      title: "Viagens Próximas",
      value: stats?.upcomingTrips || 0,
      icon: Truck,
      description: "Próximos 7 dias",
      color: "text-chart-5",
      bgColor: "bg-chart-5/10",
      href: "/trips",
      testId: "stat-upcoming-trips",
    },
    {
      title: "Itens com Estoque Baixo",
      value: stats?.lowStockItems || 0,
      icon: AlertTriangle,
      description: "Abaixo do mínimo",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      href: "/stock-simulation",
      testId: "stat-low-stock",
    },
    ...(conflicts > 0
      ? [
          {
            title: "Conflitos",
            value: conflicts,
            icon: AlertCircle,
            description: "Requer atenção",
            color: "text-destructive",
            bgColor: "bg-destructive/10",
            href: "/loading-orders",
            testId: "stat-conflicts",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={greetingLine}
      />

      {/* StatsBar */}
      <div className={`grid gap-4 ${conflicts > 0 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
        {statCards.map((stat) => (
          <button
            key={stat.testId}
            onClick={() => setLocation(stat.href)}
            className="text-left"
            data-testid={`statcard-${stat.testId}`}
          >
            <Card className="hover-elevate border-border/60 h-full cursor-pointer">
              <CardContent className="p-4">
                <div className="flex flex-row items-center justify-between gap-2 pb-2">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <div className={`h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <div
                  className={`text-2xl font-bold tracking-tight ${stat.color}`}
                  data-testid={stat.testId}
                >
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Main 2-column layout */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left — Eventos Recentes */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-primary/70" />
                </div>
                <p className="font-semibold text-base">Eventos Recentes</p>
              </div>
              <Button asChild variant="ghost" size="sm" data-testid="link-view-all-events">
                <Link href="/events">Ver todos</Link>
              </Button>
            </div>

            {/* Event list */}
            {!recentEvents || recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Calendar className="h-5 w-5 text-primary/60" />
                </div>
                <p className="text-sm font-semibold text-foreground">Nenhum evento recente</p>
                <p className="text-xs text-muted-foreground mt-1">Crie um evento para começar a gerenciar operações.</p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  data-testid="button-create-event"
                >
                  <Link href="/events">Criar Evento</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-md hover-elevate border border-border/60"
                    data-testid={`event-${event.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{event.name}</p>
                      <div className="flex items-center gap-x-2 flex-wrap text-xs text-muted-foreground mt-0.5">
                        <span>{event.client}</span>
                        {event.eventDate && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(event.eventDate), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      <StatusBadge status={event.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right — Notificações */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-primary/70" />
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-base">Notificações</p>
                  {unreadNotifications.length > 0 && (
                    <Badge variant="default" className="text-xs" data-testid="badge-unread-count">
                      {unreadNotifications.length}
                    </Badge>
                  )}
                </div>
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

            {/* Notifications list */}
            <ScrollArea className="h-[320px]" style={{ scrollbarWidth: "thin" }}>
              {notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="Nenhuma notificação"
                  description="Você está em dia! Novas notificações aparecerão aqui."
                  compact
                />
              ) : (
                <div className="space-y-2 pr-3">
                  {notifications.slice(0, 15).map((notification) => {
                    const NotifIcon = getNotificationIcon((notification as any).type);
                    return (
                      <div
                        key={notification.id}
                        className={`flex gap-3 p-3 rounded-md border cursor-pointer hover-elevate ${
                          !notification.isRead
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/60"
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                        data-testid={`notification-card-${notification.id}`}
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                          <NotifIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="font-semibold text-sm truncate">
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          {notification.actionUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationClick(notification);
                              }}
                              className="h-auto p-0 mt-1 text-xs text-primary underline-offset-4 hover:underline"
                              data-testid={`button-view-notification-${notification.id}`}
                            >
                              Ver detalhes
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 font-semibold text-base text-foreground mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary/70" />
            </div>
            Ações Rápidas
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

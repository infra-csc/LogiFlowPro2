import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar, Package, Truck, AlertTriangle, AlertCircle, TrendingUp, Box, Bell,
  CheckCheck, ExternalLink, Clock, Info, MessageSquare, ClipboardList, Activity,
  ChevronRight, Plus, Layers, PackageSearch, XCircle, BarChart3, ArrowRight,
  Warehouse,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow, format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import type { Notification } from "@shared/schema";
import {
  userIsAdmin, userCanWriteLogistics, userCanApproveLoadingOrder,
  userCanApproveMovement, userCanCreateMovement, userIsAlmoxarifado,
  userIsSupervisor,
} from "@/lib/authz";

// ── Types ──────────────────────────────────────────────────────────────────
interface DashboardSummary {
  kpis: {
    upcomingEvents: number;
    pendingRequests: number;
    actionableOrders: number;
    activeMovements: number;
    lowStockItems: number;
    upcomingTrips: number;
  };
  alerts: {
    id: string;
    type: string;
    severity: "critical" | "warning" | "info";
    message: string;
    entityName?: string;
    href: string;
  }[];
  pendingApprovals: {
    id: string;
    type: "request" | "movement";
    name: string;
    eventName?: string;
    requesterName?: string;
    createdAt: string;
    href: string;
  }[];
  activeOperations: {
    movements: { id: string; name: string; status: string; eventName?: string; href: string }[];
    loadingOrders: { id: string; name: string; status: string; eventName?: string; loadedItems: number; totalItems: number; href: string }[];
    trips: { id: string; description: string; status: string; eventName?: string; driverName?: string; vehicleTypeName?: string; loadingStartTime?: string; href: string }[];
  };
  upcomingSchedule: {
    date: string;
    type: "event" | "trip_loading" | "trip_unloading";
    name: string;
    status: string;
    href: string;
  }[];
  criticalStock: {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    minimumStock: number;
    unit: string;
    href: string;
  }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getNotificationIcon(type: string | null | undefined) {
  switch (type) {
    case "mention": return MessageSquare;
    case "warning": case "alert": return AlertTriangle;
    case "info": return Info;
    default: return Bell;
  }
}

function formatScheduleDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return `Hoje, ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Amanhã, ${format(d, "HH:mm")}`;
  return format(d, "EEE dd/MM HH:mm", { locale: ptBR });
}

function scheduleTypeLabel(type: string) {
  if (type === "event") return { label: "Evento", color: "bg-primary/15 text-primary" };
  if (type === "trip_loading") return { label: "Carga", color: "bg-chart-2/15 text-chart-2" };
  return { label: "Descarga", color: "bg-chart-5/15 text-chart-5" };
}

// Small section header inside cards
function SectionTitle({ icon: Icon, label, action }: {
  icon: React.ElementType;
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary/70" />
        </div>
        <span className="font-semibold text-sm">{label}</span>
      </div>
      {action}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const isAdminUser = userIsAdmin(user);
  const canWriteLogistics = userCanWriteLogistics(user);
  const canApproveOrders = userCanApproveLoadingOrder(user);
  const canApproveMovement = userCanApproveMovement(user);
  const canCreateMovement = userCanCreateMovement(user);
  const isAlmox = userIsAlmoxarifado(user);
  const isSup = userIsSupervisor(user);
  const canSeeApprovals = isAdminUser || isSup || canApproveOrders;

  const { data: summary, isLoading: summaryLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const unread = notifications.filter((n) => !n.isRead);

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/read-all", {});
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/notifications/${id}/read`, {});
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const handleNotifClick = (n: Notification) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    if (n.actionUrl) setLocation(n.actionUrl);
  };

  if (summaryLoading) return <PageLoading message="Carregando central de controle..." />;

  const kpis = summary?.kpis;
  const alerts = summary?.alerts ?? [];
  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const firstName = user?.name?.split(" ")[0] || user?.username || "";
  const greeting = getGreeting();
  const todayStr = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  // KPI cards config
  const kpiCards = [
    {
      label: "Eventos Próximos",
      value: kpis?.upcomingEvents ?? 0,
      icon: Calendar,
      desc: "Próximos 15 dias",
      color: "text-primary",
      bg: "bg-primary/10",
      href: "/events",
      testId: "kpi-upcoming-events",
    },
    {
      label: "Requisições Pendentes",
      value: kpis?.pendingRequests ?? 0,
      icon: ClipboardList,
      desc: "Aguardando aprovação",
      color: kpis?.pendingRequests ? "text-amber-500" : "text-chart-4",
      bg: kpis?.pendingRequests ? "bg-amber-500/10" : "bg-chart-4/10",
      href: "/approvals",
      testId: "kpi-pending-requests",
    },
    {
      label: "Ordens de Carga",
      value: kpis?.actionableOrders ?? 0,
      icon: Layers,
      desc: "Em andamento / pendentes",
      color: "text-chart-2",
      bg: "bg-chart-2/10",
      href: "/loading-orders",
      testId: "kpi-actionable-orders",
    },
    {
      label: "Movimentações Ativas",
      value: kpis?.activeMovements ?? 0,
      icon: Activity,
      desc: "Em andamento ou pausadas",
      color: kpis?.activeMovements ? "text-chart-5" : "text-muted-foreground",
      bg: kpis?.activeMovements ? "bg-chart-5/10" : "bg-muted",
      href: "/movements",
      testId: "kpi-active-movements",
    },
    {
      label: "Estoque Crítico",
      value: kpis?.lowStockItems ?? 0,
      icon: AlertTriangle,
      desc: "Abaixo do mínimo",
      color: kpis?.lowStockItems ? "text-destructive" : "text-muted-foreground",
      bg: kpis?.lowStockItems ? "bg-destructive/10" : "bg-muted",
      href: "/reports/stock-projection",
      testId: "kpi-low-stock",
    },
    {
      label: "Planos de Viagens Próximos",
      value: kpis?.upcomingTrips ?? 0,
      icon: Truck,
      desc: "Próximos 7 dias",
      color: "text-chart-4",
      bg: "bg-chart-4/10",
      href: "/trips",
      testId: "kpi-upcoming-trips",
    },
  ];

  const severityIcon = (s: string) => {
    if (s === "critical") return <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />;
    if (s === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    return <Info className="h-4 w-4 text-primary flex-shrink-0" />;
  };

  // Quick actions (RBAC-aware)
  const quickActions = [
    { label: "Criar Evento", icon: Calendar, href: "/events", show: isAdminUser, testId: "qa-event" },
    { label: "Nova Requisição", icon: Package, href: "/requests", show: true, testId: "qa-request" },
    { label: "Novo Plano de Viagens", icon: Truck, href: "/trips", show: canWriteLogistics, testId: "qa-trip" },
    { label: "Ordem de Carregamento", icon: Layers, href: "/loading-orders", show: canWriteLogistics, testId: "qa-loading-order" },
    { label: "Nova Movimentação", icon: Warehouse, href: "/movements", show: canCreateMovement || isAlmox, testId: "qa-movement" },
    { label: "Ver Aprovações", icon: CheckCheck, href: "/approvals", show: canSeeApprovals, testId: "qa-approvals" },
    { label: "Projeção de Estoque", icon: BarChart3, href: "/reports/stock-projection", show: true, testId: "qa-stock" },
  ].filter((a) => a.show);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">
            {todayStr} · Veja pendências, operações e próximos eventos.
          </p>
        </div>
        {criticalAlerts.length > 0 && (
          <Badge variant="destructive" className="gap-1 h-6 px-2 text-xs">
            <AlertCircle className="h-3 w-3" />
            {criticalAlerts.length} alerta{criticalAlerts.length !== 1 ? "s" : ""} crítico{criticalAlerts.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((k) => (
          <button
            key={k.testId}
            onClick={() => setLocation(k.href)}
            className="text-left"
            data-testid={`statcard-${k.testId}`}
          >
            <Card className="border-border/60 hover-elevate h-full cursor-pointer">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-1 mb-2">
                  <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                  <div className={`h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center ${k.bg}`}>
                    <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
                  </div>
                </div>
                <div className={`text-2xl font-bold tabular-nums leading-none ${k.color}`} data-testid={k.testId}>
                  {k.value}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{k.desc}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* ── Alertas Operacionais ── */}
      {alerts.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="p-4">
            <SectionTitle icon={AlertCircle} label="Alertas Operacionais" />
            <div className="space-y-2">
              {alerts.map((alert) => (
                <Link key={alert.id} href={alert.href}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-md border hover-elevate cursor-pointer ${
                      alert.severity === "critical"
                        ? "border-destructive/40 bg-destructive/5"
                        : alert.severity === "warning"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-primary/30 bg-primary/5"
                    }`}
                    data-testid={`alert-${alert.id}`}
                  >
                    {severityIcon(alert.severity)}
                    <span className="flex-1 text-sm">{alert.message}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 2-column: Agenda + Pendências (esq) | Notificações (dir) ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT col (2/3): Agenda + Pendências */}
        <div className="lg:col-span-2 space-y-4">
          {/* Agenda próximos 7 dias */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <SectionTitle
                icon={Clock}
                label="Próximos 7 dias"
                action={
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <Link href="/trips">Ver planos de viagens</Link>
                  </Button>
                }
              />
              {!summary?.upcomingSchedule?.length ? (
                <EmptyState
                  icon={Calendar}
                  title="Nada agendado"
                  description="Nenhum evento ou plano de viagens nos próximos 7 dias."
                  compact
                />
              ) : (
                <div className="space-y-1.5">
                  {summary.upcomingSchedule.map((item, idx) => {
                    const { label, color } = scheduleTypeLabel(item.type);
                    return (
                      <Link key={`${item.date}-${idx}`} href={item.href}>
                        <div className="flex items-center gap-3 p-2.5 rounded-md border border-border/60 hover-elevate cursor-pointer">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${color}`}>
                            {label}
                          </span>
                          <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                            {formatScheduleDate(item.date)}
                          </span>
                          <StatusBadge status={item.status} className="text-[10px] px-1.5 py-0.5 h-auto" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pendências de aprovação */}
          {canSeeApprovals && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <SectionTitle
                  icon={ClipboardList}
                  label="Pendências de Aprovação"
                  action={
                    <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                      <Link href="/approvals">Ver todas</Link>
                    </Button>
                  }
                />
                {!summary?.pendingApprovals?.length ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-chart-4">
                    <CheckCheck className="h-4 w-4 flex-shrink-0" />
                    Nenhuma pendência de aprovação.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {summary.pendingApprovals.map((item) => (
                      <Link key={item.id} href={item.href}>
                        <div
                          className="flex items-start gap-3 p-3 rounded-md border border-border/60 hover-elevate cursor-pointer"
                          data-testid={`approval-${item.id}`}
                        >
                          <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {item.type === "request" ? (
                              <Package className="h-3.5 w-3.5 text-amber-500" />
                            ) : (
                              <Activity className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground mt-0.5">
                              {item.eventName && <span>{item.eventName}</span>}
                              {item.requesterName && <span>· {item.requesterName}</span>}
                              <span>·{" "}{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}</span>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="flex-shrink-0 h-7 text-xs">
                            Analisar
                          </Button>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT col (1/3): Notificações */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="h-3.5 w-3.5 text-primary/70" />
                </div>
                <span className="font-semibold text-sm">Notificações</span>
                {unread.length > 0 && (
                  <Badge variant="default" className="h-4 text-[10px] px-1.5" data-testid="badge-unread-count">
                    {unread.length}
                  </Badge>
                )}
              </div>
              {unread.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  data-testid="button-mark-all-read-dashboard"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Todas lidas
                </Button>
              )}
            </div>
            <ScrollArea className="h-[340px]" style={{ scrollbarWidth: "thin" }}>
              {notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="Nenhuma notificação"
                  description="Você está em dia!"
                  compact
                />
              ) : (
                <div className="space-y-2 pr-2">
                  {notifications.slice(0, 15).map((n) => {
                    const Icon = getNotificationIcon((n as any).type);
                    return (
                      <div
                        key={n.id}
                        className={`flex gap-2.5 p-2.5 rounded-md border cursor-pointer hover-elevate ${
                          !n.isRead ? "border-primary/40 bg-primary/5" : "border-border/60"
                        }`}
                        onClick={() => handleNotifClick(n)}
                        data-testid={`notification-card-${n.id}`}
                      >
                        <div className="flex-shrink-0 h-6 w-6 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{n.title}</p>
                            {!n.isRead && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(n.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                          {n.actionUrl && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleNotifClick(n); }}
                              className="text-[10px] text-primary underline-offset-2 hover:underline mt-0.5 flex items-center gap-0.5"
                              data-testid={`button-view-notification-${n.id}`}
                            >
                              Ver detalhes
                              <ExternalLink className="h-2.5 w-2.5" />
                            </button>
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

      {/* ── Operações em Andamento ── */}
      {(summary?.activeOperations?.movements?.length ||
        summary?.activeOperations?.loadingOrders?.length ||
        summary?.activeOperations?.trips?.length) ? (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
          {/* Movimentações */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <SectionTitle
                icon={Activity}
                label="Movimentações"
                action={
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <Link href="/movements">Ver todas</Link>
                  </Button>
                }
              />
              {!summary.activeOperations.movements.length ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma movimentação ativa.</p>
              ) : (
                <div className="space-y-1.5">
                  {summary.activeOperations.movements.map((m) => (
                    <Link key={m.id} href={m.href}>
                      <div
                        className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover-elevate cursor-pointer"
                        data-testid={`op-movement-${m.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{m.name}</p>
                          {m.eventName && (
                            <p className="text-[10px] text-muted-foreground truncate">{m.eventName}</p>
                          )}
                        </div>
                        <StatusBadge status={m.status} className="text-[10px] px-1.5 py-0.5 h-auto flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loading Orders */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <SectionTitle
                icon={Layers}
                label="Ordens de Carregamento"
                action={
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <Link href="/loading-orders">Ver todas</Link>
                  </Button>
                }
              />
              {!summary.activeOperations.loadingOrders.length ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma ordem ativa.</p>
              ) : (
                <div className="space-y-1.5">
                  {summary.activeOperations.loadingOrders.map((lo) => (
                    <Link key={lo.id} href={lo.href}>
                      <div
                        className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover-elevate cursor-pointer"
                        data-testid={`op-order-${lo.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{lo.name}</p>
                          {lo.eventName && (
                            <p className="text-[10px] text-muted-foreground truncate">{lo.eventName}</p>
                          )}
                          {lo.totalItems > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${Math.min(100, (lo.loadedItems / lo.totalItems) * 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {lo.loadedItems}/{lo.totalItems}
                              </span>
                            </div>
                          )}
                        </div>
                        <StatusBadge status={lo.status} className="text-[10px] px-1.5 py-0.5 h-auto flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Viagens */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <SectionTitle
                icon={Truck}
                label="Planos de Viagens"
                action={
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <Link href="/trips">Ver todas</Link>
                  </Button>
                }
              />
              {!summary.activeOperations.trips.length ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum plano de viagens ativo.</p>
              ) : (
                <div className="space-y-1.5">
                  {summary.activeOperations.trips.map((t) => (
                    <Link key={t.id} href={t.href}>
                      <div
                        className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover-elevate cursor-pointer"
                        data-testid={`op-trip-${t.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {t.description || t.eventName || "Plano de viagens"}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                            {t.vehicleTypeName && <span>{t.vehicleTypeName}</span>}
                            {t.driverName && <span>· {t.driverName}</span>}
                            {t.loadingStartTime && (
                              <span>· {format(new Date(t.loadingStartTime), "dd/MM HH:mm")}</span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={t.status} className="text-[10px] px-1.5 py-0.5 h-auto flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ── Estoque Crítico ── */}
      {summary?.criticalStock?.length ? (
        <Card className="border-border/60">
          <CardContent className="p-4">
            <SectionTitle
              icon={PackageSearch}
              label="Estoque Crítico"
              action={
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                  <Link href="/reports/stock-projection">Ver projeção</Link>
                </Button>
              }
            />
            <div className="space-y-1.5">
              {summary.criticalStock.map((p) => (
                <Link key={p.id} href={p.href}>
                  <div
                    className="flex items-center gap-3 p-2.5 rounded-md border border-destructive/30 bg-destructive/5 hover-elevate cursor-pointer"
                    data-testid={`stock-${p.id}`}
                  >
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground font-mono ml-2">{p.sku}</span>
                    </div>
                    <div className="text-xs text-right whitespace-nowrap flex-shrink-0">
                      <span className="text-destructive font-semibold tabular-nums">{p.currentStock}</span>
                      <span className="text-muted-foreground">/{p.minimumStock} {p.unit}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-4">
            <SectionTitle icon={PackageSearch} label="Estoque Crítico" />
            <div className="flex items-center gap-2 text-sm text-chart-4 py-1">
              <CheckCheck className="h-4 w-4 flex-shrink-0" />
              Nenhum item abaixo do estoque mínimo.
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Ações Rápidas ── */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <SectionTitle icon={TrendingUp} label="Ações Rápidas" />
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {quickActions.map((a) => (
              <Button
                key={a.testId}
                asChild
                className="w-full justify-start h-9"
                variant="outline"
                data-testid={`button-${a.testId}`}
              >
                <Link href={a.href}>
                  <a.icon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{a.label}</span>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

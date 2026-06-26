import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft, Edit, Plus, Truck, FileText, ClipboardList,
  AlertTriangle, CheckCircle2, Clock, Calendar, ChevronRight,
  AlertCircle, Info, RefreshCw, Users, Package, Boxes, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { EventDialog } from "@/components/event-dialog";
import { RequestDialog } from "@/components/request-dialog";
import { TripDialog } from "@/components/trip-dialog";
import { LoadingOrderDialog } from "@/components/loading-order-dialog";
import type { Event, MaterialRequest, Trip, LoadingOrder } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin, userCanWriteLogistics } from "@/lib/authz";

// ── Types ──────────────────────────────────────────────────────────────────

interface EventOverview {
  event: Event;
  windowStatus: "open" | "future" | "closed" | "none";
  daysToEvent: number | null;
  requestsSummary: {
    total: number; draft: number; pending: number; approved: number; rejected: number;
  };
  requests: any[];
  loadingOrdersSummary: {
    total: number; draft: number; ready: number; approved: number; inProgress: number; completed: number;
  };
  loadingOrders: any[];
  tripsSummary: { total: number; planned: number; inProgress: number; completed: number };
  trips: any[];
  movementsSummary: {
    total: number; inProgress: number; paused: number; completed: number; pendingApproval: number;
  };
  movements: any[];
  alerts: Array<{ severity: string; message: string; type: string }>;
}

interface MaterialsSummary {
  eventId: string;
  requestCount: number;
  totals: {
    distinctProducts: number;
    totalPieces: number;
    distinctKits: number;
    totalKits: number;
  };
  pieces: Array<{
    productId: string;
    sku: string;
    name: string;
    unit: string;
    category: string | null;
    quantity: number;
    fromKits: number;
    direct: number;
  }>;
  kits: Array<{
    kitId: string;
    name: string;
    quantity: number;
    requestCount: number;
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(val: string | Date | null | undefined, pattern = "dd/MM/yy") {
  if (!val) return "—";
  try { return format(new Date(val as string), pattern, { locale: ptBR }); } catch { return "—"; }
}

function fmtDateTime(val: string | Date | null | undefined) {
  return fmtDate(val, "dd/MM HH:mm");
}

// ── Sub-components ─────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: { severity: string; message: string } }) {
  const isCritical = alert.severity === "critical";
  const isInfo = alert.severity === "info";
  const Icon = isCritical ? AlertTriangle : isInfo ? Info : AlertCircle;
  const cls = isCritical
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : isInfo
    ? "border-primary/30 bg-primary/5 text-primary"
    : "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400";
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-md border ${cls}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <span className="text-sm">{alert.message}</span>
    </div>
  );
}

function TimelineStrip({ event }: { event: Event }) {
  const now = new Date();
  const items = [
    { label: "Janela Abre", date: event.requestWindowStart },
    { label: "Janela Fecha", date: event.requestWindowEnd },
    { label: "Montagem", date: event.setupDate },
    { label: "Evento", date: event.eventDate, primary: true },
    { label: "Desmontagem", date: event.teardownDate },
  ].filter((i) => i.date);

  if (items.length === 0)
    return <p className="text-xs text-muted-foreground">Nenhuma data configurada.</p>;

  return (
    <div className="flex items-start gap-0 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
      {items.map((item, idx) => {
        const d = item.date ? new Date(item.date as unknown as string) : null;
        const isPast = d && d < now;
        const dotCls = item.primary
          ? "bg-primary border-primary"
          : isPast
          ? "bg-chart-4 border-chart-4"
          : "bg-background border-border/60";
        const labelCls = item.primary
          ? "text-primary"
          : isPast
          ? "text-chart-4"
          : "text-muted-foreground";
        return (
          <div key={item.label} className="flex items-start gap-0">
            <div className="flex flex-col items-center min-w-[84px]">
              <div className={`w-3 h-3 rounded-full border-2 mt-0.5 flex-shrink-0 ${dotCls}`} />
              <p className={`text-[10px] font-medium mt-1 text-center leading-tight ${labelCls}`}>
                {item.label}
              </p>
              <p className="text-[10px] text-muted-foreground text-center">{fmtDate(item.date)}</p>
            </div>
            {idx < items.length - 1 && (
              <div className={`h-0.5 w-8 mt-1.5 flex-shrink-0 ${isPast ? "bg-chart-4/40" : "bg-border/40"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  valueClass = "",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-muted shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground leading-none mb-1.5">{label}</p>
            <p className={`text-xl font-bold leading-none ${valueClass}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  action,
  linkHref,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  action?: { label: string; onClick: () => void };
  linkHref: string;
}) {
  return (
    <div className="px-4 py-3 border-b border-border/40 flex flex-row items-center justify-between gap-2 flex-wrap">
      <div className="text-sm font-semibold flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
        <span className="text-xs font-normal text-muted-foreground">({count})</span>
      </div>
      <div className="flex items-center gap-1">
        {action && (
          <Button size="sm" variant="ghost" onClick={action.onClick} className="h-7 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        )}
        <Link href={linkHref}>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" asChild>
            <span>
              Ver todas
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showTripDialog, setShowTripDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);

  const { data: overview, isLoading } = useQuery<EventOverview>({
    queryKey: ["/api/events", id, "overview"],
    enabled: !!id,
  });

  const { data: materials, isLoading: materialsLoading } = useQuery<MaterialsSummary>({
    queryKey: ["/api/events", id, "materials-summary"],
    enabled: !!id,
  });

  const canAdmin = userIsAdmin(user);
  const canLogistics = userCanWriteLogistics(user);

  if (isLoading) return <PageLoading message="Carregando central do evento..." />;

  if (!overview) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Evento não encontrado"
        description="O evento solicitado não existe ou não pôde ser carregado."
        action={{ label: "Voltar para Eventos", onClick: () => navigate("/events") }}
      />
    );
  }

  const {
    event,
    windowStatus,
    daysToEvent,
    requestsSummary,
    requests,
    loadingOrdersSummary,
    loadingOrders,
    tripsSummary,
    trips,
    movementsSummary,
    movements,
    alerts,
  } = overview;

  const windowLabelMap: Record<string, string> = {
    open: "Janela aberta",
    future: "Janela futura",
    closed: "Encerrado",
    none: "Sem janela",
  };

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <PageHeader
        title={event.name}
        description={[event.client, event.location, fmtDate(event.eventDate, "dd/MM/yyyy")]
          .filter(Boolean)
          .join(" · ")}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={event.status} />
          {daysToEvent !== null && daysToEvent > 0 && daysToEvent <= 60 && (
            <Badge
              variant="outline"
              className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
            >
              {daysToEvent}d para o evento
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate("/events")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar
          </Button>
          {canAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowEventDialog(true)}>
              <Edit className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
          )}
          {canAdmin && (
            <Button size="sm" variant="outline" onClick={() => setShowRequestDialog(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Requisição
            </Button>
          )}
          {canLogistics && (
            <Button size="sm" variant="outline" onClick={() => setShowTripDialog(true)}>
              <Truck className="h-4 w-4 mr-1.5" />
              Plano de Viagens
            </Button>
          )}
          {canLogistics && (
            <Button size="sm" variant="outline" onClick={() => setShowOrderDialog(true)}>
              <ClipboardList className="h-4 w-4 mr-1.5" />
              Ordem
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── Summary strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={FileText}
          label="Requisições"
          value={requestsSummary.total}
          sub={
            requestsSummary.pending > 0
              ? `${requestsSummary.pending} pendente(s)`
              : `${requestsSummary.approved} aprovada(s)`
          }
          valueClass={requestsSummary.pending > 0 ? "text-amber-500" : ""}
        />
        <StatCard
          icon={ClipboardList}
          label="Ordens de Carga"
          value={loadingOrdersSummary.total}
          sub={
            loadingOrdersSummary.approved > 0
              ? `${loadingOrdersSummary.approved} aprovada(s)`
              : loadingOrdersSummary.draft > 0
              ? `${loadingOrdersSummary.draft} rascunho(s)`
              : undefined
          }
        />
        <StatCard
          icon={Truck}
          label="Planos de Viagens"
          value={tripsSummary.total}
          sub={
            tripsSummary.inProgress > 0
              ? `${tripsSummary.inProgress} em andamento`
              : tripsSummary.planned > 0
              ? `${tripsSummary.planned} agendada(s)`
              : undefined
          }
          valueClass={tripsSummary.inProgress > 0 ? "text-primary" : ""}
        />
        <StatCard
          icon={RefreshCw}
          label="Movimentações"
          value={movementsSummary.total}
          sub={
            movementsSummary.paused > 0
              ? `${movementsSummary.paused} pausada(s)`
              : movementsSummary.inProgress > 0
              ? `${movementsSummary.inProgress} em andamento`
              : undefined
          }
          valueClass={
            movementsSummary.paused > 0
              ? "text-destructive"
              : movementsSummary.inProgress > 0
              ? "text-primary"
              : ""
          }
        />
        <StatCard
          icon={Calendar}
          label="Janela"
          value={windowLabelMap[windowStatus]}
          sub={event.requestWindowEnd ? `Até ${fmtDate(event.requestWindowEnd)}` : undefined}
          valueClass={
            windowStatus === "open"
              ? "text-chart-4 text-base"
              : windowStatus === "closed"
              ? "text-muted-foreground text-base"
              : "text-amber-500 text-base"
          }
        />
        <StatCard
          icon={AlertTriangle}
          label="Alertas"
          value={alerts.length}
          sub={alerts.length === 0 ? "Sem alertas" : undefined}
          valueClass={
            alerts.some((a) => a.severity === "critical")
              ? "text-destructive"
              : alerts.length > 0
              ? "text-amber-500"
              : "text-chart-4"
          }
        />
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────── */}
      {alerts.length > 0 ? (
        <Card className="border-border/60">
          <div className="px-4 py-3 border-b border-border/40">
            <p className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas do Evento
            </p>
          </div>
          <CardContent className="p-4 space-y-2">
            {alerts.map((alert, i) => (
              <AlertRow key={i} alert={alert} />
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-chart-4/30 bg-chart-4/5 text-chart-4 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Nenhum alerta crítico para este evento.
        </div>
      )}

      {/* ── Timeline ────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <div className="px-4 py-3 border-b border-border/40">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Timeline
          </p>
        </div>
        <CardContent className="p-4">
          <TimelineStrip event={event} />
          {event.notes && (
            <p className="mt-3 text-xs text-muted-foreground border-t border-border/40 pt-3">
              {event.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Resumo de Materiais ─────────────────────────────────────── */}
      <Card className="border-border/60">
        <div className="px-4 py-3 border-b border-border/40 flex flex-row items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Resumo de Materiais do Evento
            {materials && (
              <span className="text-xs font-normal text-muted-foreground">
                ({materials.requestCount} requisição(ões), incluindo pendentes)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            {materials && (
              <>
                <Badge variant="outline" className="text-[10px]">
                  {materials.totals.distinctProducts} peça(s) · {materials.totals.totalPieces} unid
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {materials.totals.distinctKits} kit(s) · {materials.totals.totalKits} unid
                </Badge>
              </>
            )}
            <Button
              asChild
              size="sm"
              variant="outline"
              data-testid="link-materials-detail"
            >
              <a href={`/events/${id}/materials`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver detalhado
              </a>
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          {materialsLoading ? (
            <div className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Calculando materiais...
            </div>
          ) : !materials || (materials.pieces.length === 0 && materials.kits.length === 0) ? (
            <div className="p-4">
              <EmptyState
                icon={Package}
                title="Nenhum material"
                description="Nenhuma requisição com itens foi criada para este evento ainda."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/40">
              {/* Kits */}
              <div className="min-w-0">
                <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2 bg-muted/30">
                  <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Kits ({materials.kits.length})
                  </span>
                </div>
                {materials.kits.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Nenhum kit requisitado.
                  </p>
                ) : (
                  <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
                    {materials.kits.map((k) => (
                      <div
                        key={k.kitId}
                        className="flex items-center gap-3 px-4 py-2.5"
                        data-testid={`material-kit-${k.kitId}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{k.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {k.requestCount} requisição(ões)
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs font-semibold shrink-0">
                          {k.quantity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Pieces */}
              <div className="min-w-0">
                <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2 bg-muted/30">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Peças ({materials.pieces.length})
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    inclui itens de kits
                  </span>
                </div>
                {materials.pieces.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Nenhuma peça requisitada.
                  </p>
                ) : (
                  <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
                    {materials.pieces.map((p) => (
                      <div
                        key={p.productId}
                        className="flex items-center gap-3 px-4 py-2.5"
                        data-testid={`material-piece-${p.productId}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">
                            {p.sku}
                            {p.fromKits > 0 && p.direct > 0 && (
                              <span className="font-sans"> · {p.direct} avulso + {p.fromKits} de kits</span>
                            )}
                            {p.fromKits > 0 && p.direct === 0 && (
                              <span className="font-sans"> · de kits</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-baseline gap-1 shrink-0">
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {p.quantity}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{p.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Requisições ─────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <SectionHeader
          icon={FileText}
          title="Requisições"
          count={requestsSummary.total}
          action={canAdmin ? { label: "Nova", onClick: () => setShowRequestDialog(true) } : undefined}
          linkHref="/requests"
        />
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={FileText}
                title="Nenhuma requisição"
                description="Nenhuma requisição foi criada para este evento."
                action={
                  canAdmin
                    ? { label: "Nova Requisição", onClick: () => setShowRequestDialog(true) }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {requests.map((req: any) => (
                <Link key={req.id} href={`/requests/${req.id}`}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover-elevate cursor-pointer"
                    data-testid={`event-request-${req.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={req.status} />
                        <span className="text-sm font-medium truncate">{req.area || "Sem área"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.requestedByUser?.name || "—"} · {fmtDate(req.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ordens de Carregamento ──────────────────────────────────── */}
      <Card className="border-border/60">
        <SectionHeader
          icon={ClipboardList}
          title="Ordens de Carregamento"
          count={loadingOrdersSummary.total}
          action={
            canLogistics ? { label: "Nova", onClick: () => setShowOrderDialog(true) } : undefined
          }
          linkHref="/loading-orders"
        />
        <CardContent className="p-0">
          {loadingOrders.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ClipboardList}
                title="Nenhuma ordem"
                description="Nenhuma ordem de carregamento foi criada para este evento."
                action={
                  canLogistics
                    ? { label: "Criar Ordem", onClick: () => setShowOrderDialog(true) }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {loadingOrders.map((lo: any) => {
                const total = lo.totalItems || 0;
                const loaded = lo.loadedItems || 0;
                const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
                return (
                  <Link key={lo.id} href={`/loading-orders/${lo.id}`}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 hover-elevate cursor-pointer"
                      data-testid={`event-lo-${lo.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={lo.status} />
                          <span className="text-sm font-medium">Ordem #{lo.orderNumber}</span>
                          {lo.plannedStartTime && (
                            <span className="text-xs text-muted-foreground">
                              {fmtDate(lo.plannedStartTime)}
                            </span>
                          )}
                        </div>
                        {total > 0 && (
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                              <div
                                className={`h-full rounded-full ${
                                  pct === 100
                                    ? "bg-chart-4"
                                    : pct > 0
                                    ? "bg-primary"
                                    : "bg-muted-foreground/20"
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {loaded}/{total} itens
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Viagens ─────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <SectionHeader
          icon={Truck}
          title="Planos de Viagens"
          count={tripsSummary.total}
          action={
            canLogistics ? { label: "Nova", onClick: () => setShowTripDialog(true) } : undefined
          }
          linkHref="/trips"
        />
        <CardContent className="p-0">
          {trips.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Truck}
                title="Nenhum plano de viagens"
                description="Nenhum plano de viagens foi criado para este evento."
                action={
                  canLogistics
                    ? { label: "Novo Plano de Viagens", onClick: () => setShowTripDialog(true) }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {trips.map((trip: any) => (
                <div
                  key={trip.id}
                  className="flex items-center gap-3 px-4 py-3"
                  data-testid={`event-trip-${trip.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={trip.status} />
                      <span className="text-sm font-medium truncate">
                        {trip.description || "Plano de viagens"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
                      {trip.driver && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {trip.driver.name}
                        </span>
                      )}
                      {trip.loadingStartTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDateTime(trip.loadingStartTime)}
                        </span>
                      )}
                      {!trip.driverId && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400"
                        >
                          Sem motorista
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Movimentações ───────────────────────────────────────────── */}
      <Card className="border-border/60">
        <SectionHeader
          icon={RefreshCw}
          title="Movimentações"
          count={movementsSummary.total}
          linkHref={`/events/${id}/movements`}
        />
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={RefreshCw}
                title="Nenhuma movimentação"
                description="Nenhuma movimentação está vinculada a este evento."
              />
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {movements.map((mov: any) => (
                <Link key={mov.id} href={`/movements/${mov.id}`}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover-elevate cursor-pointer"
                    data-testid={`event-mov-${mov.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={mov.status} />
                        <span className="text-sm font-medium truncate">{mov.name}</span>
                        {mov.movementNumber && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {mov.movementNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <EventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        event={event}
      />
      <RequestDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
        request={{ eventId: event.id } as any}
      />
      <TripDialog
        open={showTripDialog}
        onOpenChange={setShowTripDialog}
        trip={{ eventId: event.id } as any}
      />
      <LoadingOrderDialog
        open={showOrderDialog}
        onOpenChange={setShowOrderDialog}
        order={{ eventId: event.id } as any}
      />
    </div>
  );
}

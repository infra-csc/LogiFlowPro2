import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/filter-bar";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus, Truck, PlayCircle, PauseCircle, CheckCircle2, Eye, Pencil, X,
  MapPin, CalendarDays, Clock, ArrowRight, FileText, Tag, Package,
  Camera, AlertTriangle, CheckCircle, Route, Anchor, User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { MovementDialog } from "@/components/movement-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  userCanCreateMovement,
  userCanEditMovement,
} from "@/lib/authz";
import { PageHeader, PageLoading, EmptyState, StatusBadge } from "@/components";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Movement, LoadingOrder, Event, Dock, Trip, MovementTypeConfig } from "@shared/schema";

type MovementStats = {
  itemsLoaded: number;
  unitsLoaded: number;
  itemsExpected: number;
  unitsExpected: number;
  evidenceCount: number;
};

type MovementWithRelations = Movement & {
  loadingOrder?: LoadingOrder & { eventId?: string };
  event?: Event;
  dock?: Dock;
  events?: Event[];
  trips?: Trip[];
  requests?: Array<{ id: string; area: string | null; eventId: string | null; status: string; event?: { id: string | null; name: string } | null }>;
  movementTypeConfig?: MovementTypeConfig;
  _stats?: MovementStats;
};

// Nature badge
function NatureBadge({ nature }: { nature?: string | null }) {
  if (!nature) return null;
  if (nature === "inbound") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
        Entrada
      </Badge>
    );
  }
  if (nature === "outbound") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
        Saída
      </Badge>
    );
  }
  return null;
}

function movementTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    outbound_event: "Saída para evento",
    inbound_return: "Retorno de evento",
    inbound_event: "Entrada de evento",
    outbound_return: "Saída para retorno",
    transfer: "Transferência",
    internal_transfer: "Transf. interna",
    loading: "Carga",
    unloading: "Descarga",
    adjustment: "Ajuste",
    inventory: "Inventário",
    other: "Outro",
  };
  return labels[type || ""] || type || "Movimentação";
}

// Compact stat counter for the stats bar
function StatCounter({
  label,
  count,
  active,
  onClick,
  colorClass,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
  colorClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors w-full ${
        active
          ? "bg-primary/10 border-primary/40"
          : "bg-card border-border/60 hover-elevate"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${colorClass || "bg-muted-foreground"}`} />
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none text-foreground tabular-nums">{count}</div>
        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide font-medium truncate">{label}</div>
      </div>
    </button>
  );
}

// Progress display for loaded/expected
// Single metadata row
function MetaRow({ icon: Icon, label, value, truncate }: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  truncate?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground text-xs shrink-0">{label}:</span>
      {truncate ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-foreground font-medium truncate min-w-0 cursor-default">{value}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">{value}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-xs text-foreground font-medium truncate min-w-0">{value}</span>
      )}
    </div>
  );
}

// Rich movement card
function MovementCard({
  movement,
  onNavigate,
  onStatusChange,
  isPending,
  canEdit,
}: {
  movement: MovementWithRelations;
  onNavigate: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  isPending: boolean;
  canEdit: boolean;
}) {
  const stats = movement._stats ?? {
    itemsLoaded: 0,
    unitsLoaded: 0,
    itemsExpected: 0,
    unitsExpected: 0,
    evidenceCount: 0,
  };

  const typeName = movement.movementTypeConfig?.name || movementTypeLabel(movement.type);
  const eventName =
    movement.events?.[0]?.name ?? movement.event?.name ?? undefined;

  // Progress computation
  const hasExpected = stats.unitsExpected > 0;
  const progressPct = hasExpected
    ? Math.min(100, Math.round((stats.unitsLoaded / stats.unitsExpected) * 100))
    : null;
  const unitsPending = hasExpected ? Math.max(0, stats.unitsExpected - stats.unitsLoaded) : null;
  const unitsExceeded = hasExpected ? Math.max(0, stats.unitsLoaded - stats.unitsExpected) : null;

  // Vehicle: prefer movement's own plate, fall back to first linked trip's plate
  const tripVehicle = movement.trips?.find((t: any) => t.vehiclePlate)?.vehiclePlate ?? null;
  const resolvedVehicle = movement.vehiclePlate || tripVehicle;

  // Status indicator chips
  const chips: Array<{ label: string; icon: React.ElementType; variant: "warn" | "ok" | "info" | "muted" }> = [];
  if (!resolvedVehicle) chips.push({ label: "Sem veículo", icon: AlertTriangle, variant: "warn" });
  if (stats.evidenceCount === 0) chips.push({ label: "Sem evidências", icon: Camera, variant: "muted" });
  if (stats.evidenceCount > 0) chips.push({ label: `${stats.evidenceCount} evidência${stats.evidenceCount !== 1 ? "s" : ""}`, icon: Camera, variant: "info" });
  if (progressPct === 100 && unitsExceeded === 0) chips.push({ label: "100% concluída", icon: CheckCircle, variant: "ok" });
  if (unitsPending !== null && unitsPending > 0 && movement.status !== "created") {
    chips.push({ label: `${unitsPending} un. pendente${unitsPending !== 1 ? "s" : ""}`, icon: AlertTriangle, variant: "warn" });
  }

  const requestLabel = movement.requests && movement.requests.length > 0
    ? movement.requests.length === 1
      ? (movement.requests[0].area || "Requisição")
      : `${movement.requests.length} requisições`
    : null;

  const tripsLabel = movement.trips && movement.trips.length > 0
    ? `${movement.trips.length} plano${movement.trips.length !== 1 ? "s" : ""} vinculado${movement.trips.length !== 1 ? "s" : ""}`
    : null;

  const createdAt = movement.createdAt
    ? format(new Date(movement.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })
    : null;
  const updatedAt = movement.updatedAt
    ? format(new Date(movement.updatedAt), "dd/MM/yy HH:mm", { locale: ptBR })
    : null;

  return (
    <Card
      key={movement.id}
      className="border-border/60 hover-elevate cursor-pointer"
      onClick={() => onNavigate(movement.id)}
      data-testid={`card-movement-${movement.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate(movement.id);
        }
      }}
    >
      <CardContent className="p-0">
        {/* ── TOP HEADER ─────────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-3">
          {/* Row 1: badges + code + type + actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <StatusBadge status={movement.status} />
              <NatureBadge nature={movement.movementTypeConfig?.nature} />
              {movement.movementNumber && (
                <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                  {movement.movementNumber}
                </span>
              )}
              {typeName && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {typeName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {(movement.status === "created" || movement.status === "paused") && canEdit && (
                <MovementDialog movement={movement}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`button-edit-${movement.id}`}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </MovementDialog>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(movement.id);
                }}
                data-testid={`button-details-${movement.id}`}
                title="Ver detalhes"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Row 2: movement name with tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <h3
                className="font-semibold text-base text-foreground mt-2 leading-snug line-clamp-2 cursor-default"
                data-testid={`text-movement-name-${movement.id}`}
              >
                {movement.name || "Movimentação sem nome"}
              </h3>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {movement.name || "Movimentação sem nome"}
            </TooltipContent>
          </Tooltip>

          {/* Row 3: event name */}
          {eventName && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 flex items-center gap-1 cursor-default">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{eventName}</span>
                </p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">{eventName}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ── METRICS ROW ─────────────────────────────────────────────── */}
        <div className="mx-4 rounded-lg bg-muted/20 border border-border/40 px-3 py-2.5 mb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Left: counts in plain readable format */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Product count */}
              <span className="text-sm tabular-nums">
                <span className="font-bold">{stats.itemsLoaded}</span>
                <span className="text-muted-foreground ml-1 text-xs">
                  {stats.itemsLoaded === 1 ? "produto" : "produtos"}
                </span>
              </span>

              <span className="text-border/70 text-xs">·</span>

              {/* Units: "349 un." or "349 / 500 un." */}
              <span className="text-sm tabular-nums">
                <span className="font-bold">{stats.unitsLoaded}</span>
                {hasExpected && (
                  <span className="text-muted-foreground text-xs"> / {stats.unitsExpected}</span>
                )}
                <span className="text-muted-foreground ml-1 text-xs">un.</span>
              </span>

              {/* Pending badge */}
              {unitsPending !== null && unitsPending > 0 && (
                <>
                  <span className="text-border/70 text-xs">·</span>
                  <span className="text-xs font-medium text-amber-500 tabular-nums">
                    {unitsPending} pendente{unitsPending !== 1 ? "s" : ""}
                  </span>
                </>
              )}

              {/* Exceeded badge */}
              {unitsExceeded !== null && unitsExceeded > 0 && (
                <>
                  <span className="text-border/70 text-xs">·</span>
                  <span className="text-xs font-medium text-red-500 tabular-nums">
                    {unitsExceeded} excedente{unitsExceeded !== 1 ? "s" : ""}
                  </span>
                </>
              )}

              {/* Empty state */}
              {stats.itemsLoaded === 0 && !hasExpected && (
                <span className="text-xs text-muted-foreground italic">Nenhum item registrado</span>
              )}
            </div>

            {/* Right: progress bar + % */}
            {progressPct !== null && (
              <div className="flex items-center gap-2 shrink-0">
                <Progress value={progressPct} className="h-1.5 w-16" />
                <span className={`text-sm font-bold tabular-nums leading-none ${
                  progressPct === 100 ? "text-emerald-500" : "text-foreground"
                }`}>
                  {progressPct}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── METADATA GRID ───────────────────────────────────────────── */}
        <div className="px-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mb-3">
          {requestLabel && (
            <MetaRow icon={FileText} label="Requisição" value={requestLabel} truncate />
          )}
          {movement.loadingOrder && (
            <MetaRow icon={Package} label="Ordem de carga" value={movement.loadingOrder.orderNumber ?? "Vinculada"} />
          )}
          {tripsLabel && (
            <MetaRow icon={Route} label="Plano de viagens" value={tripsLabel} />
          )}
          {resolvedVehicle && (
            <MetaRow
              icon={Truck}
              label="Veículo"
              value={resolvedVehicle + (tripVehicle && !movement.vehiclePlate ? " (viagem)" : "")}
            />
          )}
          {movement.dock && (
            <MetaRow icon={Anchor} label="Doca" value={(movement.dock as any).name} truncate />
          )}
          {createdAt && (
            <MetaRow icon={CalendarDays} label="Criado em" value={createdAt} />
          )}
          {updatedAt && updatedAt !== createdAt && (
            <MetaRow icon={Clock} label="Atualizado" value={updatedAt} />
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <div className="px-4 pb-3 pt-3 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
          {/* Indicator chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {chips.map((chip, i) => {
              const chipColors = {
                warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
                info: "bg-primary/10 text-primary border-primary/30",
                muted: "bg-muted/40 text-muted-foreground border-border/60",
              };
              const Icon = chip.icon;
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${chipColors[chip.variant]}`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {chip.label}
                </span>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {movement.status === "created" && canEdit && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(movement.id, "in_progress");
                }}
                disabled={isPending}
                data-testid={`button-start-${movement.id}`}
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1" />
                Iniciar
              </Button>
            )}
            {movement.status === "in_progress" && canEdit && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(movement.id, "paused");
                  }}
                  disabled={isPending}
                  data-testid={`button-pause-${movement.id}`}
                >
                  <PauseCircle className="h-3.5 w-3.5 mr-1" />
                  Pausar
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(movement.id, "completed");
                  }}
                  disabled={isPending}
                  data-testid={`button-finish-${movement.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Finalizar
                </Button>
              </>
            )}
            {movement.status === "paused" && canEdit && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(movement.id, "in_progress");
                }}
                disabled={isPending}
                data-testid={`button-continue-${movement.id}`}
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1" />
                Continuar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(movement.id);
              }}
              data-testid={`button-details-footer-${movement.id}`}
            >
              Detalhes
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Movements() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [filterEventId, setFilterEventId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterVehiclePlate, setFilterVehiclePlate] = useState<string>("");
  const [filterDockId, setFilterDockId] = useState<string>("");

  const { data: movements = [], isLoading } = useQuery<MovementWithRelations[]>({
    queryKey: ["/api/movements"],
  });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: docks = [] } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });
  const { data: movementTypes = [] } = useQuery<MovementTypeConfig[]>({
    queryKey: ["/api/movement-types-config"],
  });

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      if (filterEventId) {
        const evIds = movement.events?.map((e) => e.id) ?? [];
        if (!evIds.includes(filterEventId) && movement.loadingOrder?.eventId !== filterEventId) return false;
      }
      if (filterStartDate && movement.startedAt) {
        const movementDate = new Date(movement.startedAt).toISOString().split("T")[0];
        if (movementDate < filterStartDate) return false;
      }
      if (filterEndDate && movement.startedAt) {
        const movementDate = new Date(movement.startedAt).toISOString().split("T")[0];
        if (movementDate > filterEndDate) return false;
      }
      if (filterStatus && movement.status !== filterStatus) return false;
      if (filterType && movement.movementTypeConfigId !== filterType) return false;
      if (filterVehiclePlate && !movement.vehiclePlate?.toLowerCase().includes(filterVehiclePlate.toLowerCase())) return false;
      if (filterDockId && movement.dockId !== filterDockId) return false;
      return true;
    });
  }, [movements, filterEventId, filterStartDate, filterEndDate, filterStatus, filterType, filterVehiclePlate, filterDockId]);

  const stats = useMemo(() => ({
    all: movements.length,
    created: movements.filter((m) => m.status === "created").length,
    inProgress: movements.filter((m) => m.status === "in_progress").length,
    paused: movements.filter((m) => m.status === "paused").length,
    completed: movements.filter((m) => m.status === "completed").length,
  }), [movements]);

  const activeFiltersCount = useMemo(() => {
    return [filterEventId, filterStartDate, filterEndDate, filterStatus, filterType, filterVehiclePlate, filterDockId]
      .filter(Boolean).length;
  }, [filterEventId, filterStartDate, filterEndDate, filterStatus, filterType, filterVehiclePlate, filterDockId]);

  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onClear: () => void }[] = [];
    if (filterEventId) {
      const ev = events.find((e) => e.id === filterEventId);
      chips.push({ label: `Evento: ${ev?.name || filterEventId}`, onClear: () => setFilterEventId("") });
    }
    if (filterStatus) {
      const labels: Record<string, string> = {
        created: "Criada", in_progress: "Em Andamento", paused: "Pausada",
        completed: "Finalizada", cancelled: "Cancelada",
      };
      chips.push({ label: `Status: ${labels[filterStatus] || filterStatus}`, onClear: () => setFilterStatus("") });
    }
    if (filterType) {
      const mt = movementTypes.find((t) => t.id === filterType);
      chips.push({ label: `Tipo: ${mt?.name || filterType}`, onClear: () => setFilterType("") });
    }
    if (filterDockId) {
      const dk = docks.find((d) => d.id === filterDockId);
      chips.push({ label: `Doca: ${dk?.name || filterDockId}`, onClear: () => setFilterDockId("") });
    }
    if (filterVehiclePlate) chips.push({ label: `Placa: ${filterVehiclePlate}`, onClear: () => setFilterVehiclePlate("") });
    if (filterStartDate) chips.push({ label: `De: ${filterStartDate}`, onClear: () => setFilterStartDate("") });
    if (filterEndDate) chips.push({ label: `Até: ${filterEndDate}`, onClear: () => setFilterEndDate("") });
    return chips;
  }, [filterEventId, filterStatus, filterType, filterDockId, filterVehiclePlate, filterStartDate, filterEndDate, events, movementTypes, docks]);

  const clearAllFilters = () => {
    setFilterEventId("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterStatus("");
    setFilterType("");
    setFilterVehiclePlate("");
    setFilterDockId("");
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/movements/${id}/status`, { status });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      toast({ title: "Status atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const handleStatusChange = (id: string, status: string) => {
    updateStatusMutation.mutate(
      { id, status },
      { onSuccess: () => { if (status === "in_progress") navigate(`/movements/${id}`); } }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Carga e Descarga" description="Gerencie movimentações operacionais do armazém" />
        <PageLoading message="Carregando movimentações..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Carga e Descarga"
        description="Gerencie movimentações operacionais do armazém"
      >
        {userCanCreateMovement(user) && (
          <MovementDialog>
            <Button data-testid="button-new-movement">
              <Plus className="h-4 w-4 mr-2" />
              Nova Movimentação
            </Button>
          </MovementDialog>
        )}
      </PageHeader>

      {/* ── Stats Bar ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <StatCounter label="Total" count={stats.all} active={!filterStatus} onClick={() => setFilterStatus("")} colorClass="bg-primary" />
        <StatCounter label="Criadas" count={stats.created} active={filterStatus === "created"} onClick={() => setFilterStatus(filterStatus === "created" ? "" : "created")} colorClass="bg-muted-foreground" />
        <StatCounter label="Em Andamento" count={stats.inProgress} active={filterStatus === "in_progress"} onClick={() => setFilterStatus(filterStatus === "in_progress" ? "" : "in_progress")} colorClass="bg-primary" />
        <StatCounter label="Pausadas" count={stats.paused} active={filterStatus === "paused"} onClick={() => setFilterStatus(filterStatus === "paused" ? "" : "paused")} colorClass="bg-chart-5" />
        <StatCounter label="Finalizadas" count={stats.completed} active={filterStatus === "completed"} onClick={() => setFilterStatus(filterStatus === "completed" ? "" : "completed")} colorClass="bg-chart-4" />
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────── */}
      <FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearAllFilters : undefined}>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Evento</label>
          <Select value={filterEventId || undefined} onValueChange={(v) => setFilterEventId(v || "")}>
            <SelectTrigger data-testid="select-filter-event" className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Status</label>
          <Select value={filterStatus || undefined} onValueChange={(v) => setFilterStatus(v || "")}>
            <SelectTrigger data-testid="select-filter-status" className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Criada</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="paused">Pausada</SelectItem>
              <SelectItem value="completed">Finalizada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Tipo</label>
          <Select value={filterType || undefined} onValueChange={(v) => setFilterType(v || "")}>
            <SelectTrigger data-testid="select-filter-type" className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              {movementTypes.filter((mt) => mt.active).map((type) => (
                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Doca</label>
          <Select value={filterDockId || undefined} onValueChange={(v) => setFilterDockId(v || "")}>
            <SelectTrigger data-testid="select-filter-dock" className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todas as docas" />
            </SelectTrigger>
            <SelectContent>
              {docks.map((dock) => (
                <SelectItem key={dock.id} value={dock.id}>{dock.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Placa</label>
          <Input
            placeholder="Digite a placa..."
            value={filterVehiclePlate}
            onChange={(e) => setFilterVehiclePlate(e.target.value)}
            data-testid="input-filter-vehicle"
            className="h-9 bg-card border-border/60 rounded-md text-sm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Data Início</label>
          <Input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            data-testid="input-filter-start-date"
            className="h-9 bg-card border-border/60 rounded-md text-sm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Data Fim</label>
          <Input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            data-testid="input-filter-end-date"
            className="h-9 bg-card border-border/60 rounded-md text-sm"
          />
        </div>
      </FilterBar>

      {/* Active filter chips */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilterChips.map((chip, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className="text-xs font-normal cursor-pointer"
              onClick={chip.onClear}
              data-testid={`filter-chip-${idx}`}
            >
              {chip.label}
              <X className="h-3 w-3 ml-1 inline" />
            </Badge>
          ))}
        </div>
      )}

      {/* ── Results info ─────────────────────────────────────────────── */}
      {filteredMovements.length > 0 && (
        <div className="text-xs text-muted-foreground px-0.5">
          {filteredMovements.length === movements.length
            ? `${movements.length} movimentação${movements.length !== 1 ? "ões" : ""}`
            : `${filteredMovements.length} de ${movements.length} movimentação${movements.length !== 1 ? "ões" : ""}`}
        </div>
      )}

      {/* ── Lista ───────────────────────────────────────────────────── */}
      <style>{`
        .movements-scroll::-webkit-scrollbar { width: 5px; }
        .movements-scroll::-webkit-scrollbar-track { background: transparent; }
        .movements-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border) / 0.5); border-radius: 3px; }
      `}</style>
      <div className={`space-y-3 ${movements.length > 12 ? "max-h-[70vh] overflow-y-auto movements-scroll pr-1" : ""}`}>
        {filteredMovements.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Nenhuma movimentação encontrada"
            description={
              activeFiltersCount > 0
                ? "Tente ajustar os filtros para ver mais resultados"
                : "Crie uma nova movimentação para começar"
            }
            action={
              activeFiltersCount > 0
                ? { label: "Limpar Filtros", onClick: clearAllFilters }
                : userCanCreateMovement(user)
                ? { label: "Nova Movimentação", onClick: () => navigate("/movements/new") }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredMovements.map((movement) => (
              <MovementCard
                key={movement.id}
                movement={movement}
                onNavigate={(id) => navigate(`/movements/${id}`)}
                onStatusChange={handleStatusChange}
                isPending={updateStatusMutation.isPending}
                canEdit={userCanEditMovement(user)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

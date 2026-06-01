import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Truck, PlayCircle, PauseCircle, CheckCircle2, Eye, Pencil, X,
  MapPin, CalendarDays, Clock, ArrowRight, AlertCircle, FileText, Tag,
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
import { ActionBar } from "@/components/action-bar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Movement, LoadingOrder, Event, Dock, Trip, MovementTypeConfig } from "@shared/schema";

type MovementWithRelations = Movement & {
  loadingOrder?: LoadingOrder;
  event?: Event;
  dock?: Dock;
  events?: Event[];
  trips?: Trip[];
  movementTypeConfig?: MovementTypeConfig;
};

const formatDuration = (minutes?: number | null) => {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins}min`;
};

// Movement type label translation (fallback when movementTypeConfig.name is missing)
function movementTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    outbound_event: "Saída para evento",
    inbound_return: "Retorno de evento",
    inbound_event: "Entrada de evento",
    outbound_return: "Saída para retorno",
    transfer: "Transferência",
    internal_transfer: "Transferência interna",
    loading: "Carga",
    unloading: "Descarga",
    adjustment: "Ajuste",
    inventory: "Inventário",
    other: "Outro",
  };
  return labels[type || ""] || type || "Movimentação";
}

// Next action hint based on status
function statusHint(status: string): string {
  const hints: Record<string, string> = {
    created: "Pronta para iniciar",
    in_progress: "Em operação",
    paused: "Pausada — aguardando retomada",
    completed: "Finalizada",
    cancelled: "Cancelada",
  };
  return hints[status] || "";
}

// Stat counter mini-card
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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
        active
          ? "bg-primary/10 border-primary/30"
          : "bg-card border-border/60 hover:bg-muted/50"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className={`h-2 w-2 rounded-full ${colorClass || "bg-muted-foreground"}`} />
      <div>
        <div className="text-lg font-semibold leading-none text-foreground">{count}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
      </div>
    </button>
  );
}

export default function Movements() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Filtros
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

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });

  const { data: movementTypes = [] } = useQuery<MovementTypeConfig[]>({
    queryKey: ["/api/movement-types-config"],
  });

  // Aplicar filtros
  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      if (filterEventId && movement.loadingOrder?.eventId !== filterEventId) return false;
      if (filterStartDate && movement.startedAt) {
        const movementDate = new Date(movement.startedAt).toISOString().split('T')[0];
        if (movementDate < filterStartDate) return false;
      }
      if (filterEndDate && movement.startedAt) {
        const movementDate = new Date(movement.startedAt).toISOString().split('T')[0];
        if (movementDate > filterEndDate) return false;
      }
      if (filterStatus && movement.status !== filterStatus) return false;
      if (filterType && movement.movementTypeConfigId !== filterType) return false;
      if (filterVehiclePlate && !movement.vehiclePlate?.toLowerCase().includes(filterVehiclePlate.toLowerCase())) return false;
      if (filterDockId && movement.dockId !== filterDockId) return false;
      return true;
    });
  }, [movements, filterEventId, filterStartDate, filterEndDate, filterStatus, filterType, filterVehiclePlate, filterDockId]);

  // Contadores por status
  const stats = useMemo(() => {
    const all = movements.length;
    const created = movements.filter((m) => m.status === "created").length;
    const inProgress = movements.filter((m) => m.status === "in_progress").length;
    const paused = movements.filter((m) => m.status === "paused").length;
    const completed = movements.filter((m) => m.status === "completed").length;
    return { all, created, inProgress, paused, completed };
  }, [movements]);

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterEventId) count++;
    if (filterStartDate) count++;
    if (filterEndDate) count++;
    if (filterStatus) count++;
    if (filterType) count++;
    if (filterVehiclePlate) count++;
    if (filterDockId) count++;
    return count;
  }, [filterEventId, filterStartDate, filterEndDate, filterStatus, filterType, filterVehiclePlate, filterDockId]);

  // Labels dos filtros ativos (para chips visíveis quando FilterBar fechado)
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onClear: () => void }[] = [];
    if (filterEventId) {
      const ev = events.find((e) => e.id === filterEventId);
      chips.push({ label: `Evento: ${ev?.name || filterEventId}`, onClear: () => setFilterEventId("") });
    }
    if (filterStatus) {
      const labels: Record<string, string> = {
        created: "Criada",
        in_progress: "Em Andamento",
        paused: "Pausada",
        completed: "Finalizada",
        cancelled: "Cancelada",
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
    if (filterVehiclePlate) {
      chips.push({ label: `Placa: ${filterVehiclePlate}`, onClear: () => setFilterVehiclePlate("") });
    }
    if (filterStartDate) {
      chips.push({ label: `De: ${filterStartDate}`, onClear: () => setFilterStartDate("") });
    }
    if (filterEndDate) {
      chips.push({ label: `Até: ${filterEndDate}`, onClear: () => setFilterEndDate("") });
    }
    return chips;
  }, [filterEventId, filterStatus, filterType, filterDockId, filterVehiclePlate, filterStartDate, filterEndDate, events, movementTypes, docks]);

  // Limpar todos os filtros
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
      const res = await apiRequest("PATCH", `/api/movements/${id}`, { status });
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
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Carga e Descarga"
          description="Gerencie movimentações operacionais do armazém"
        />
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

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCounter
          label="Total"
          count={stats.all}
          active={!filterStatus}
          onClick={() => setFilterStatus("")}
          colorClass="bg-primary"
        />
        <StatCounter
          label="Criadas"
          count={stats.created}
          active={filterStatus === "created"}
          onClick={() => setFilterStatus(filterStatus === "created" ? "" : "created")}
          colorClass="bg-muted-foreground"
        />
        <StatCounter
          label="Em Andamento"
          count={stats.inProgress}
          active={filterStatus === "in_progress"}
          onClick={() => setFilterStatus(filterStatus === "in_progress" ? "" : "in_progress")}
          colorClass="bg-primary"
        />
        <StatCounter
          label="Pausadas"
          count={stats.paused}
          active={filterStatus === "paused"}
          onClick={() => setFilterStatus(filterStatus === "paused" ? "" : "paused")}
          colorClass="bg-chart-5"
        />
        <StatCounter
          label="Finalizadas"
          count={stats.completed}
          active={filterStatus === "completed"}
          onClick={() => setFilterStatus(filterStatus === "completed" ? "" : "completed")}
          colorClass="bg-chart-4"
        />
      </div>

      {/* Filtros */}
      <FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearAllFilters : undefined}>
        <div className="flex flex-col gap-2">
          <label htmlFor="filter-event" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Evento</label>
          <Select value={filterEventId || undefined} onValueChange={(value) => setFilterEventId(value || "")}>
            <SelectTrigger id="filter-event" data-testid="select-filter-event" className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-status" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Status</label>
          <Select value={filterStatus || undefined} onValueChange={(value) => setFilterStatus(value || "")}>
            <SelectTrigger id="filter-status" data-testid="select-filter-status" className="h-9 bg-card border-border/60 rounded-md text-sm">
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
          <label htmlFor="filter-type" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Tipo</label>
          <Select value={filterType || undefined} onValueChange={(value) => setFilterType(value || "")}>
            <SelectTrigger id="filter-type" data-testid="select-filter-type" className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              {movementTypes.filter(mt => mt.active).map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-dock" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Doca</label>
          <Select value={filterDockId || undefined} onValueChange={(value) => setFilterDockId(value || "")}>
            <SelectTrigger id="filter-dock" data-testid="select-filter-dock" className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todas as docas" />
            </SelectTrigger>
            <SelectContent>
              {docks.map((dock) => (
                <SelectItem key={dock.id} value={dock.id}>
                  {dock.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-vehicle" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Placa</label>
          <Input
            id="filter-vehicle"
            placeholder="Digite a placa..."
            value={filterVehiclePlate}
            onChange={(e) => setFilterVehiclePlate(e.target.value)}
            data-testid="input-filter-vehicle"
            className="h-9 bg-card border-border/60 rounded-md text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-start-date" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Data Início</label>
          <Input
            id="filter-start-date"
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            data-testid="input-filter-start-date"
            className="h-9 bg-card border-border/60 rounded-md text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-end-date" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Data Fim</label>
          <Input
            id="filter-end-date"
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
              className="text-xs font-normal cursor-pointer hover:bg-muted"
              onClick={chip.onClear}
              data-testid={`filter-chip-${idx}`}
            >
              {chip.label}
              <X className="h-3 w-3 ml-1 inline" />
            </Badge>
          ))}
        </div>
      )}

      {/* Custom scrollbar for list */}
      <style>{`
        .movements-scroll::-webkit-scrollbar { width: 5px; }
        .movements-scroll::-webkit-scrollbar-track { background: transparent; }
        .movements-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border) / 0.5); border-radius: 3px; }
      `}</style>

      {/* Lista de Movimentações */}
      <div className={`space-y-3 ${movements.length > 12 ? 'max-h-[70vh] overflow-y-auto movements-scroll pr-1' : ''}`}>
        {filteredMovements.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Nenhuma movimentação encontrada"
            description={activeFiltersCount > 0
              ? "Tente ajustar os filtros para ver mais resultados"
              : "Crie uma nova movimentação para começar"}
            action={activeFiltersCount > 0
              ? { label: "Limpar Filtros", onClick: clearAllFilters }
              : userCanCreateMovement(user)
              ? { label: "Nova Movimentação", onClick: () => navigate("/movements/new") }
              : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredMovements.map((movement) => {
              const hint = statusHint(movement.status);
              const typeName = movement.movementTypeConfig?.name
                || movementTypeLabel(movement.type);

              return (
                <Card
                  key={movement.id}
                  className="hover-elevate border-border/60 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/movements/${movement.id}`)}
                  data-testid={`card-movement-${movement.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/movements/${movement.id}`);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    {/* Header: status + code + name + actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={movement.status} />
                          <span className="text-xs text-muted-foreground font-mono">
                            {movement.movementNumber || "—"}
                          </span>
                          {typeName && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {typeName}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-base text-foreground mt-1 truncate" data-testid={`text-movement-name-${movement.id}`}>
                          {movement.name || "Movimentação sem nome"}
                        </h3>
                        {hint && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(movement.status === "created" || movement.status === "paused") && userCanEditMovement(user) && (
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
                            navigate(`/movements/${movement.id}`);
                          }}
                          data-testid={`button-details-${movement.id}`}
                          title="Ver detalhes"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Metadata grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40 text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Evento:</span>
                        <span className="text-foreground font-medium truncate">
                          {movement.events?.[0]?.name || movement.event?.name || "Não vinculado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Veículo:</span>
                        <span className="text-foreground font-medium">
                          {movement.vehiclePlate || "Não informado"}
                        </span>
                      </div>
                      {movement.dock && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Doca:</span>
                          <span className="text-foreground font-medium">{movement.dock.name}</span>
                        </div>
                      )}
                      {movement.startedAt && (
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Início:</span>
                          <span className="text-foreground font-medium">
                            {format(new Date(movement.startedAt), "dd MMM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      )}
                      {movement.totalDuration && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Duração:</span>
                          <span className="text-foreground font-medium">{formatDuration(movement.totalDuration)}</span>
                        </div>
                      )}
                      {movement.trips && movement.trips.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Viagens:</span>
                          <span className="text-foreground font-medium">{movement.trips.length}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions footer */}
                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border/40">
                      <div className="flex items-center gap-1">
                        {/* Status actions */}
                        {movement.status === "created" && userCanEditMovement(user) && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatusMutation.mutate(
                                { id: movement.id, status: "in_progress" },
                                { onSuccess: () => navigate(`/movements/${movement.id}`) }
                              );
                            }}
                            disabled={updateStatusMutation.isPending}
                            data-testid={`button-start-${movement.id}`}
                          >
                            <PlayCircle className="h-3.5 w-3.5 mr-1" />
                            Iniciar
                          </Button>
                        )}
                        {movement.status === "in_progress" && userCanEditMovement(user) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatusMutation.mutate({ id: movement.id, status: "paused" });
                              }}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-pause-${movement.id}`}
                            >
                              <PauseCircle className="h-3.5 w-3.5 mr-1" />
                              Pausar
                            </Button>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatusMutation.mutate({ id: movement.id, status: "completed" });
                              }}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-finish-${movement.id}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Finalizar
                            </Button>
                          </>
                        )}
                        {movement.status === "paused" && userCanEditMovement(user) && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatusMutation.mutate({ id: movement.id, status: "in_progress" });
                            }}
                            disabled={updateStatusMutation.isPending}
                            data-testid={`button-continue-${movement.id}`}
                          >
                            <PlayCircle className="h-3.5 w-3.5 mr-1" />
                            Continuar
                          </Button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/movements/${movement.id}`);
                        }}
                        data-testid={`button-details-footer-${movement.id}`}
                      >
                        Detalhes
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

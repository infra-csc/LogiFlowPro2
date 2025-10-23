import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Truck, PlayCircle, PauseCircle, CheckCircle2, Eye, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocation } from "wouter";
import { MovementDialog } from "@/components/movement-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Movement, LoadingOrder, Event, Dock } from "@shared/schema";

type MovementWithRelations = Movement & {
  loadingOrder?: LoadingOrder;
  event?: Event;
  dock?: Dock;
  events?: Event[];
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    created: "bg-chart-5 text-white",
    in_progress: "bg-primary text-primary-foreground",
    paused: "bg-chart-5 text-white",
    completed: "bg-chart-4 text-white",
    cancelled: "bg-destructive text-destructive-foreground",
  };
  return colors[status] || "bg-muted text-muted-foreground";
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    created: "Criada",
    in_progress: "Em Andamento",
    paused: "Pausada",
    completed: "Finalizada",
    cancelled: "Cancelada",
  };
  return labels[status] || status;
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    outbound_event: "Saída para Evento",
    inbound_event: "Retorno de Evento",
    inbound_purchase: "Entrada Produto Comprado",
    inbound_rental: "Entrada Produto Locado",
    outbound_rental_return: "Devolução Produto Locado",
    internal_transfer: "Transferência Interna",
    inventory_adjustment: "Ajuste de Inventário",
  };
  return labels[type] || type;
};

const formatDuration = (minutes?: number | null) => {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins}min`;
};

export default function Movements() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);

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

  // Aplicar filtros
  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      // Filtro por evento
      if (filterEventId && movement.loadingOrder?.eventId !== filterEventId) {
        return false;
      }

      // Filtro por período de carregamento
      if (filterStartDate && movement.startedAt) {
        const movementDate = new Date(movement.startedAt).toISOString().split('T')[0];
        if (movementDate < filterStartDate) {
          return false;
        }
      }
      if (filterEndDate && movement.startedAt) {
        const movementDate = new Date(movement.startedAt).toISOString().split('T')[0];
        if (movementDate > filterEndDate) {
          return false;
        }
      }

      // Filtro por status
      if (filterStatus && movement.status !== filterStatus) {
        return false;
      }

      // Filtro por tipo
      if (filterType && movement.type !== filterType) {
        return false;
      }

      // Filtro por placa do veículo
      if (filterVehiclePlate && !movement.vehiclePlate?.toLowerCase().includes(filterVehiclePlate.toLowerCase())) {
        return false;
      }

      // Filtro por doca
      if (filterDockId && movement.dockId !== filterDockId) {
        return false;
      }

      return true;
    });
  }, [movements, filterEventId, filterStartDate, filterEndDate, filterStatus, filterType, filterVehiclePlate, filterDockId]);

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
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            🚛 Carga e Descarga
          </h1>
          <p className="text-muted-foreground">
            Gerencie movimentações operacionais do armazém
          </p>
        </div>
        <MovementDialog>
          <Button data-testid="button-new-movement">
            <Plus className="h-4 w-4 mr-2" />
            Nova Movimentação
          </Button>
        </MovementDialog>
      </div>

      {/* Filtros */}
      <Card>
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="gap-2 p-0 hover:bg-transparent" data-testid="button-toggle-filters">
                  <Filter className="h-4 w-4" />
                  <CardTitle className="text-base">
                    Filtros
                    {activeFiltersCount > 0 && (
                      <Badge variant="default" className="ml-2">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </CardTitle>
                </Button>
              </CollapsibleTrigger>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="gap-2"
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Filtro de Evento */}
                <div className="space-y-2">
                  <Label htmlFor="filter-event">Evento</Label>
                  <Select value={filterEventId || undefined} onValueChange={(value) => setFilterEventId(value || "")}>
                    <SelectTrigger id="filter-event" data-testid="select-filter-event">
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

                {/* Filtro de Status */}
                <div className="space-y-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select value={filterStatus || undefined} onValueChange={(value) => setFilterStatus(value || "")}>
                    <SelectTrigger id="filter-status" data-testid="select-filter-status">
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

                {/* Filtro de Tipo de Movimentação */}
                <div className="space-y-2">
                  <Label htmlFor="filter-type">Tipo de Movimentação</Label>
                  <Select value={filterType || undefined} onValueChange={(value) => setFilterType(value || "")}>
                    <SelectTrigger id="filter-type" data-testid="select-filter-type">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound_event">Saída para Evento</SelectItem>
                      <SelectItem value="inbound_event">Retorno de Evento</SelectItem>
                      <SelectItem value="inbound_purchase">Entrada Produto Comprado</SelectItem>
                      <SelectItem value="inbound_rental">Entrada Produto Locado</SelectItem>
                      <SelectItem value="outbound_rental_return">Devolução Produto Locado</SelectItem>
                      <SelectItem value="internal_transfer">Transferência Interna</SelectItem>
                      <SelectItem value="inventory_adjustment">Ajuste de Inventário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Doca */}
                <div className="space-y-2">
                  <Label htmlFor="filter-dock">Doca</Label>
                  <Select value={filterDockId || undefined} onValueChange={(value) => setFilterDockId(value || "")}>
                    <SelectTrigger id="filter-dock" data-testid="select-filter-dock">
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

                {/* Filtro de Placa do Veículo */}
                <div className="space-y-2">
                  <Label htmlFor="filter-vehicle">Placa do Veículo</Label>
                  <Input
                    id="filter-vehicle"
                    placeholder="Digite a placa..."
                    value={filterVehiclePlate}
                    onChange={(e) => setFilterVehiclePlate(e.target.value)}
                    data-testid="input-filter-vehicle"
                  />
                </div>

                {/* Filtro de Data Início */}
                <div className="space-y-2">
                  <Label htmlFor="filter-start-date">Data Início</Label>
                  <Input
                    id="filter-start-date"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    data-testid="input-filter-start-date"
                  />
                </div>

                {/* Filtro de Data Fim */}
                <div className="space-y-2">
                  <Label htmlFor="filter-end-date">Data Fim</Label>
                  <Input
                    id="filter-end-date"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    data-testid="input-filter-end-date"
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Lista de Movimentações */}
      <div className="space-y-4">
        {filteredMovements.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma movimentação encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                {activeFiltersCount > 0 
                  ? "Tente ajustar os filtros para ver mais resultados" 
                  : "Crie uma nova movimentação para começar"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredMovements.map((movement) => (
            <Card key={movement.id} className="hover-elevate" data-testid={`card-movement-${movement.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(movement.status)}>
                        {getStatusLabel(movement.status)}
                      </Badge>
                      <h3 className="font-semibold text-lg" data-testid={`text-movement-name-${movement.id}`}>
                        {movement.movementNumber} | {movement.name}
                      </h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Tipo:</span> {getTypeLabel(movement.type)}
                      </div>
                      {movement.loadingOrder && (
                        <div>
                          <span className="font-medium">Ordem:</span> {movement.loadingOrder.orderNumber}
                        </div>
                      )}
                      {movement.vehiclePlate && (
                        <div>
                          <span className="font-medium">Veículo:</span> {movement.vehiclePlate}
                        </div>
                      )}
                      {movement.dock && (
                        <div>
                          <span className="font-medium">Doca:</span> {movement.dock.name}
                        </div>
                      )}
                      {movement.totalDuration && (
                        <div>
                          <span className="font-medium">Duração:</span> {formatDuration(movement.totalDuration)}
                        </div>
                      )}
                    </div>
                    
                    {movement.events && movement.events.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-muted-foreground">Eventos:</span>
                        {movement.events.map((event) => (
                          <Badge key={event.id} variant="outline" data-testid={`badge-movement-event-${event.id}`}>
                            {event.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {movement.status === "created" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          updateStatusMutation.mutate(
                            { id: movement.id, status: "in_progress" },
                            {
                              onSuccess: () => {
                                navigate(`/movements/${movement.id}`);
                              }
                            }
                          );
                        }}
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-start-${movement.id}`}
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Iniciar
                      </Button>
                    )}
                    {movement.status === "in_progress" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ id: movement.id, status: "paused" })}
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-pause-${movement.id}`}
                        >
                          <PauseCircle className="h-4 w-4 mr-1" />
                          Pausar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: movement.id, status: "completed" })}
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-finish-${movement.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Finalizar
                        </Button>
                      </>
                    )}
                    {movement.status === "paused" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: movement.id, status: "in_progress" })}
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-continue-${movement.id}`}
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Continuar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/movements/${movement.id}`)}
                      data-testid={`button-details-${movement.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Detalhes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

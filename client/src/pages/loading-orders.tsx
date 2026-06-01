import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Package, Edit, Eye, ArrowRight, ClipboardList, CheckCircle2, CircleDot, Truck, Clock, MapPin, CalendarDays, User, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { FilterBar } from "@/components/filter-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LoadingOrder, Event } from "@shared/schema";
import { LoadingOrderDialog } from "@/components/loading-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { PageHeader, PageLoading, EmptyState } from "@/components";
import { ActionBar } from "@/components/action-bar";

interface LoadingOrderWithRelations extends LoadingOrder {
  event?: Event;
  totalItems?: number;
  loadedItems?: number;
}

const statusHint: Record<string, string> = {
  draft: "Preparar ordem",
  ready: "Aguardando aprovação",
  approved: "Pronta para operação",
  in_progress: "Carregamento em andamento",
  completed: "Finalizada",
  cancelled: "Cancelada",
};

const statConfig = [
  { key: "total", label: "Total", icon: ClipboardList, statusVal: "", color: "text-primary", activeColor: "bg-primary/10 border-primary/30 text-primary" },
  { key: "draft", label: "Rascunhos", icon: CircleDot, statusVal: "draft", color: "text-muted-foreground", activeColor: "bg-muted border-border text-foreground" },
  { key: "ready", label: "Prontas", icon: CheckCircle2, statusVal: "ready", color: "text-chart-4", activeColor: "bg-chart-4/10 border-chart-4/30 text-chart-4" },
  { key: "inProgress", label: "Em Andamento", icon: Truck, statusVal: "in_progress", color: "text-chart-5", activeColor: "bg-chart-5/10 border-chart-5/30 text-chart-5" },
  { key: "completed", label: "Finalizadas", icon: CheckCircle, statusVal: "completed", color: "text-chart-4", activeColor: "bg-chart-4/10 border-chart-4/30 text-chart-4" },
] as const;

export default function LoadingOrders() {
  const [, navigate] = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<LoadingOrder | undefined>();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterEventId, setFilterEventId] = useState<string>("");
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);

  const { data: orders = [], isLoading } = useQuery<LoadingOrderWithRelations[]>({
    queryKey: ["/api/loading-orders"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const handleEdit = (order: LoadingOrder) => {
    setSelectedOrder(order);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedOrder(undefined);
    setShowDialog(false);
  };

  const stats = useMemo(() => {
    const total = orders.length;
    const draft = orders.filter(o => o.status === "draft").length;
    const ready = orders.filter(o => o.status === "ready").length;
    const inProgress = orders.filter(o => o.status === "in_progress").length;
    const completed = orders.filter(o => o.status === "completed").length;
    return { total, draft, ready, inProgress, completed };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filterStatus && order.status !== filterStatus) return false;
      if (filterEventId && order.eventId !== filterEventId) return false;
      return true;
    });
  }, [orders, filterStatus, filterEventId]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterStatus) count++;
    if (filterEventId) count++;
    return count;
  }, [filterStatus, filterEventId]);

  const clearFilters = () => {
    setFilterStatus("");
    setFilterEventId("");
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; onClear: () => void }> = [];
    if (filterStatus) {
      const statusLabels: Record<string, string> = {
        draft: "Rascunho", ready: "Pronta", in_progress: "Em Andamento",
        completed: "Finalizada", cancelled: "Cancelada",
      };
      chips.push({ label: `Status: ${statusLabels[filterStatus] || filterStatus}`, onClear: () => setFilterStatus("") });
    }
    if (filterEventId) {
      const eventName = events.find(e => e.id === filterEventId)?.name || filterEventId;
      chips.push({ label: `Evento: ${eventName}`, onClear: () => setFilterEventId("") });
    }
    return chips;
  }, [filterStatus, filterEventId, events]);

  if (isLoading) {
    return <PageLoading message="Carregando ordens..." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ordens de Carregamento"
        description="Gerencie listas consolidadas para picking e carregamento"
      >
        <ActionBar>
          {canWrite && (
            <Button onClick={() => setShowDialog(true)} data-testid="button-create-loading-order">
              <Plus className="h-4 w-4 mr-2" />
              Nova Ordem
            </Button>
          )}
        </ActionBar>
      </PageHeader>

      {/* Stats Bar — clickable filters */}
      <div className="flex flex-wrap gap-3">
        {statConfig.map(({ key, label, icon: Icon, statusVal, color, activeColor }) => {
          const isActive = statusVal === "" ? filterStatus === "" && filterEventId === "" : filterStatus === statusVal;
          return (
            <button
              key={key}
              onClick={() => {
                if (statusVal === "") {
                  clearFilters();
                } else {
                  setFilterStatus(filterStatus === statusVal ? "" : statusVal);
                }
              }}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors hover-elevate ${
                isActive
                  ? activeColor
                  : "bg-card border-border/60 text-muted-foreground"
              }`}
              data-testid={`stat-${key}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="font-medium">{stats[key as keyof typeof stats]}</span>
              <span className="text-xs">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearFilters : undefined}>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Status</label>
          <Select value={filterStatus || undefined} onValueChange={(value) => setFilterStatus(value || "")}>
            <SelectTrigger className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="ready">Pronta</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="completed">Finalizada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Evento</label>
          <Select value={filterEventId || undefined} onValueChange={(value) => setFilterEventId(value || "")}>
            <SelectTrigger className="h-9 bg-card border-border/60 rounded-md text-sm">
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
      </FilterBar>

      {/* Active filter chips */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilterChips.map((chip, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className="cursor-pointer"
              onClick={chip.onClear}
              data-testid={`filter-chip-${idx}`}
            >
              {chip.label} ×
            </Badge>
          ))}
        </div>
      )}

      {!filteredOrders || filteredOrders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhuma ordem de carregamento"
          description={activeFiltersCount > 0
            ? "Tente ajustar os filtros para ver mais resultados"
            : "Crie uma ordem consolidando requisições aprovadas"}
          action={activeFiltersCount > 0
            ? { label: "Limpar Filtros", onClick: clearFilters }
            : canWrite
            ? { label: "Nova Ordem", onClick: () => setShowDialog(true) }
            : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const totalItems = order.totalItems || 0;
            const loadedItems = order.loadedItems || 0;
            const progressPercent = totalItems > 0 ? Math.round((loadedItems / totalItems) * 100) : 0;
            const isExceeded = loadedItems > totalItems && totalItems > 0;
            const isComplete = loadedItems >= totalItems && totalItems > 0 && !isExceeded;
            const hint = statusHint[order.status] || "";

            return (
              <Card
                key={order.id}
                className="hover-elevate border-border/60 cursor-pointer"
                onClick={() => navigate(`/loading-orders/${order.id}`)}
                data-testid={`card-loading-order-${order.id}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/loading-orders/${order.id}`);
                  }
                }}
              >
                <CardContent className="p-4">
                  {/* Header: order number + status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base text-foreground truncate" data-testid={`order-number-${order.id}`}>
                        {order.orderNumber}
                      </h3>
                      {hint && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
                      )}
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs truncate">{order.event?.name || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs truncate">
                        {format(new Date(order.plannedStartTime), "dd MMM HH:mm", { locale: ptBR })} –{" "}
                        {format(new Date(order.plannedEndTime), "dd MMM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs truncate">{order.createdBy}</span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        Carregados: <span className="font-semibold text-foreground">{loadedItems}</span> / {totalItems}
                      </span>
                      <span className="font-medium tabular-nums">
                        {isExceeded ? (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {progressPercent}%
                          </span>
                        ) : isComplete ? (
                          <span className="text-chart-4 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {progressPercent}%
                          </span>
                        ) : (
                          <span className="text-foreground">{progressPercent}%</span>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isExceeded ? "bg-destructive" : isComplete ? "bg-chart-4" : progressPercent > 0 ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                    <div className="flex items-center gap-1">
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleEdit(order); }}
                          data-testid={`button-edit-${order.id}`}
                          title="Editar"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); navigate(`/loading-orders/${order.id}`); }}
                      data-testid={`button-details-${order.id}`}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
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

      <LoadingOrderDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) handleClose();
        }}
        order={selectedOrder}
      />
    </div>
  );
}

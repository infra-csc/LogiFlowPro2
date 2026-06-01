import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Package, Edit, Eye } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { FilterBar } from "@/components/filter-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import type { LoadingOrder, Event } from "@shared/schema";
import { LoadingOrderDialog } from "@/components/loading-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { PageHeader, PageLoading, EmptyState } from "@/components";

interface LoadingOrderWithRelations extends LoadingOrder {
  event?: Event;
}

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

  // Stats
  const stats = useMemo(() => {
    const total = orders.length;
    const draft = orders.filter(o => o.status === "draft").length;
    const ready = orders.filter(o => o.status === "ready").length;
    const inProgress = orders.filter(o => o.status === "in_progress").length;
    const completed = orders.filter(o => o.status === "completed").length;
    return { total, draft, ready, inProgress, completed };
  }, [orders]);

  // Apply filters
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Ordens de Carregamento"
          description="Gerencie listas consolidadas para picking e carregamento"
        />
        <PageLoading message="Carregando ordens..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de Carregamento"
        description="Gerencie listas consolidadas para picking e carregamento"
      >
        {canWrite && (
          <Button onClick={() => setShowDialog(true)} data-testid="button-create-loading-order">
            <Plus className="h-4 w-4 mr-2" />
            Nova Ordem
          </Button>
        )}
      </PageHeader>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card border-border/60">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <div>
            <div className="text-lg font-semibold leading-none text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card border-border/60">
          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          <div>
            <div className="text-lg font-semibold leading-none text-foreground">{stats.draft}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Rascunhos</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card border-border/60">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <div>
            <div className="text-lg font-semibold leading-none text-foreground">{stats.ready}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Prontas</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card border-border/60">
          <div className="h-2 w-2 rounded-full bg-chart-5" />
          <div>
            <div className="text-lg font-semibold leading-none text-foreground">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Em Andamento</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card border-border/60">
          <div className="h-2 w-2 rounded-full bg-chart-4" />
          <div>
            <div className="text-lg font-semibold leading-none text-foreground">{stats.completed}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Finalizadas</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearFilters : undefined}>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Status</label>
          <Select value={filterStatus || undefined} onValueChange={(value) => setFilterStatus(value || "")}>
            <SelectTrigger className="h-10 bg-card border-border/60 rounded-lg text-sm">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Criada</SelectItem>
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
            <SelectTrigger className="h-10 bg-card border-border/60 rounded-lg text-sm">
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

      {!filteredOrders || filteredOrders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhuma ordem de carregamento"
          description={activeFiltersCount > 0
            ? "Tente ajustar os filtros para ver mais resultados"
            : "Crie uma ordem consolidando requisições aprovadas"}
          action={canWrite && activeFiltersCount === 0 ? { label: "Nova Ordem", onClick: () => setShowDialog(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <Card
              key={order.id}
              className="hover-elevate border-border/60 cursor-pointer"
              onClick={() => navigate(`/loading-orders/${order.id}`)}
              data-testid={`card-loading-order-${order.id}`}
            >
              <CardContent className="p-4">
                {/* Header: status + number + actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={order.status} />
                      <span className="text-xs text-muted-foreground font-mono">{order.orderNumber}</span>
                    </div>
                    <h3 className="font-semibold text-base text-foreground mt-1">{order.orderNumber}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(order);
                        }}
                        data-testid={`button-edit-${order.id}`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/loading-orders/${order.id}`);
                      }}
                      data-testid={`button-details-${order.id}`}
                      title="Ver detalhes"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Evento:</span>{" "}
                    <span className="text-foreground font-medium">{order.event?.name || "—"}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Criado por:</span>{" "}
                    <span className="text-foreground font-medium">{order.createdBy || "—"}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Início:</span>{" "}
                    <span className="text-foreground font-medium">{format(new Date(order.plannedStartTime), "dd/MM HH:mm")}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Fim:</span>{" "}
                    <span className="text-foreground font-medium">{format(new Date(order.plannedEndTime), "dd/MM HH:mm")}</span>
                  </div>
                  {order.actualStartTime && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Início Real:</span>{" "}
                      <span className="text-foreground font-medium">{format(new Date(order.actualStartTime), "dd/MM HH:mm")}</span>
                    </div>
                  )}
                  {order.actualEndTime && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Fim Real:</span>{" "}
                      <span className="text-foreground font-medium">{format(new Date(order.actualEndTime), "dd/MM HH:mm")}</span>
                    </div>
                  )}
                </div>
                {order.notes && (
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <p className="text-xs text-muted-foreground">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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

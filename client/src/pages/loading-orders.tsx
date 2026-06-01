import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Package, Edit, Eye, ClipboardList, CheckCircle2, CircleDot, Truck, Clock, ArrowRight } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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

const statusBarColors: Record<string, string> = {
  draft: "border-l-muted-foreground",
  ready: "border-l-chart-4",
  in_progress: "border-l-chart-5",
  completed: "border-l-chart-4",
  cancelled: "border-l-destructive",
};

const statConfig = [
  { key: "total", label: "Total", icon: ClipboardList, color: "primary", borderColor: "border-l-primary" },
  { key: "draft", label: "Rascunhos", icon: CircleDot, color: "muted-foreground", borderColor: "border-l-muted-foreground" },
  { key: "ready", label: "Prontas", icon: CheckCircle2, color: "chart-4", borderColor: "border-l-chart-4" },
  { key: "inProgress", label: "Em Andamento", icon: Truck, color: "chart-5", borderColor: "border-l-chart-5" },
  { key: "completed", label: "Finalizadas", icon: Clock, color: "chart-4", borderColor: "border-l-chart-4" },
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
        <ActionBar>
          {canWrite && (
            <Button onClick={() => setShowDialog(true)} data-testid="button-create-loading-order">
              <Plus className="h-4 w-4 mr-2" />
              Nova Ordem
            </Button>
          )}
        </ActionBar>
      </PageHeader>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statConfig.map(({ key, label, icon: Icon, color, borderColor }) => (
          <div
            key={key}
            className={`bg-card border border-border/60 rounded-xl p-5 ${borderColor} border-l-4 hover-elevate cursor-default`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${color}/10 text-${color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
              {label}
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {stats[key as keyof typeof stats]}
            </p>
          </div>
        ))}
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
          action={activeFiltersCount > 0
            ? { label: "Limpar Filtros", onClick: clearFilters }
            : canWrite
            ? { label: "Nova Ordem", onClick: () => setShowDialog(true) }
            : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <Card
              key={order.id}
              className={`hover-elevate border-border/60 cursor-pointer overflow-hidden relative ${statusBarColors[order.status] || "border-l-muted-foreground"} border-l-4`}
              onClick={() => navigate(`/loading-orders/${order.id}`)}
              data-testid={`card-loading-order-${order.id}`}
            >
              <CardContent className="p-6">
                {/* Header: status + number */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">{order.orderNumber}</h3>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {/* Metadata */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-[20px]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"/><path d="m22 12-5.5-5.5a2.12 2.12 0 0 0-3 0L9 11"/><path d="m2 12 5.5-5.5a2.12 2.12 0 0 1 3 0L15 11"/></svg>
                    </span>
                    <span className="text-sm">{order.event?.name || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CalendarIcon className="h-5 w-5" />
                    <span className="text-sm">{format(new Date(order.plannedStartTime), "dd MMM - dd MMM, yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <UserIcon className="h-5 w-5" />
                    <span className="text-sm">Resp: {order.createdBy}</span>
                  </div>
                </div>

                {/* Quantidade de itens + progresso */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        Total: <span className="font-semibold text-foreground">{order.totalItems || 0}</span> itens
                      </span>
                      <span className="text-muted-foreground">
                        Carregados: <span className="font-semibold text-foreground">{order.loadedItems || 0}</span>
                      </span>
                    </div>
                    <span className="font-medium text-foreground">
                      {order.totalItems && order.totalItems > 0
                        ? Math.round(((order.loadedItems || 0) / order.totalItems) * 100) + "%"
                        : "0%"}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-full rounded-full ${
                        order.status === "completed" ? "bg-chart-4" :
                        order.status === "in_progress" ? "bg-primary" :
                        order.status === "ready" ? "bg-chart-4" :
                        "bg-muted-foreground"
                      }`}
                      style={{ width: `${order.totalItems && order.totalItems > 0 ? Math.min(((order.loadedItems || 0) / order.totalItems) * 100, 100) : 10}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(order);
                        }}
                        data-testid={`button-edit-${order.id}`}
                        title="Editar"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1 text-sm font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/loading-orders/${order.id}`);
                    }}
                    data-testid={`button-details-${order.id}`}
                    title="Ver detalhes"
                  >
                    Detalhes
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/>
      <path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>
      <path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

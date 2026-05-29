import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Package, Calendar, FileText, Edit } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import type { LoadingOrder, Event } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { LoadingOrderDialog } from "@/components/loading-order-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

interface LoadingOrderWithRelations extends LoadingOrder {
  event?: Event;
}

export default function LoadingOrders() {
  const [, navigate] = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<LoadingOrder | undefined>();
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);

  const { data: orders, isLoading } = useQuery<LoadingOrderWithRelations[]>({
    queryKey: ["/api/loading-orders"],
  });

  const handleEdit = (order: LoadingOrder) => {
    setSelectedOrder(order);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedOrder(undefined);
    setShowDialog(false);
  };

  if (isLoading) {
    return (
      <PageLoading message="Carregando ordens..." />
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

      {!orders || orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhuma ordem de carregamento"
          description="Crie uma ordem consolidando requisições aprovadas"
          action={canWrite ? { label: "Nova Ordem", onClick: () => setShowDialog(true) } : undefined}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card 
              key={order.id}
              className="hover-elevate cursor-pointer"
              onClick={() => navigate(`/loading-orders/${order.id}`)}
              data-testid={`card-loading-order-${order.id}`}
            >
              <CardContent className="p-4">
                {/* Header: status + título + ações */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={order.status} />
                      <span className="text-xs text-muted-foreground font-mono">
                        {order.orderNumber}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {order.orderNumber}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {canWrite && (
                      <Button
                        size="icon"
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
                  </div>
                </div>

                {/* Metadados */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border/40">
                  <div>
                    <p className="text-xs text-muted-foreground">Evento</p>
                    <p className="text-sm font-medium">{order.event?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Criado por</p>
                    <p className="text-sm font-medium">{order.createdBy || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Início Planejado</p>
                    <p className="text-sm font-medium">
                      {format(new Date(order.plannedStartTime), "dd/MM HH:mm")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fim Planejado</p>
                    <p className="text-sm font-medium">
                      {format(new Date(order.plannedEndTime), "dd/MM HH:mm")}
                    </p>
                  </div>
                </div>
                {order.actualStartTime && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Início Real</p>
                      <p className="text-sm font-medium">
                        {format(new Date(order.actualStartTime), "dd/MM HH:mm")}
                      </p>
                    </div>
                    {order.actualEndTime && (
                      <div>
                        <p className="text-xs text-muted-foreground">Fim Real</p>
                        <p className="text-sm font-medium">
                          {format(new Date(order.actualEndTime), "dd/MM HH:mm")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
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

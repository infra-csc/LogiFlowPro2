import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Package, Calendar, FileText } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import type { LoadingOrder, Event } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface LoadingOrderWithRelations extends LoadingOrder {
  event?: Event;
}

export default function LoadingOrders() {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<LoadingOrder | undefined>();

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
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando ordens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Ordens de Carregamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie listas consolidadas para picking e carregamento</p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-loading-order">
          <Plus className="h-4 w-4 mr-2" />
          Nova Ordem
        </Button>
      </div>

      {!orders || orders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma ordem de carregamento</h3>
              <p className="mt-2 text-sm text-muted-foreground">Crie uma ordem consolidando requisições aprovadas</p>
              <Button onClick={() => setShowDialog(true)} className="mt-4" data-testid="button-create-first-order">
                <Plus className="h-4 w-4 mr-2" />
                Nova Ordem
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card 
              key={order.id}
              className="hover-elevate cursor-pointer"
              onClick={() => handleEdit(order)}
              data-testid={`card-loading-order-${order.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {order.orderNumber}
                  </CardTitle>
                  <StatusBadge status={order.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

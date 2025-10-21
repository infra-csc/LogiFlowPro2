import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, FileText, Calendar } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { LoadingOrder, Event, MaterialRequest } from "@shared/schema";

type LoadingOrderItem = {
  id: string;
  loadingOrderId: string;
  productId: string;
  consolidatedQuantity: number;
  sourceRequests: Array<{
    requestId: string;
    area: string;
    quantity: number;
  }>;
  product?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
};

type LoadingOrderWithRelations = LoadingOrder & {
  event?: Event;
};

export default function LoadingOrderDetails() {
  const { id } = useParams();
  const [, navigate] = useLocation();

  const { data: order, isLoading: orderLoading } = useQuery<LoadingOrderWithRelations>({
    queryKey: [`/api/loading-orders/${id}`],
    enabled: !!id,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<LoadingOrderItem[]>({
    queryKey: [`/api/loading-orders/${id}/items`],
    enabled: !!id,
  });

  const { data: requests = [] } = useQuery<MaterialRequest[]>({
    queryKey: [`/api/loading-orders/${id}/requests`],
    enabled: !!id,
  });

  if (orderLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-muted-foreground">Ordem de carregamento não encontrada</div>
        <Button onClick={() => navigate("/loading-orders")} data-testid="button-back">
          Voltar para ordens
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/loading-orders")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-order-number">
            {order.orderNumber}
          </h1>
          <p className="text-muted-foreground">
            {order.event?.name || "Evento não encontrado"}
          </p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Informações da Ordem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Início Planejado</div>
              <div className="font-medium" data-testid="text-planned-start">
                {format(new Date(order.plannedStartTime), "dd/MM/yyyy, HH:mm")}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Fim Planejado</div>
              <div className="font-medium" data-testid="text-planned-end">
                {format(new Date(order.plannedEndTime), "dd/MM/yyyy, HH:mm")}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Criado por</div>
              <div className="font-medium" data-testid="text-created-by">
                {order.createdBy}
              </div>
            </div>
            {order.notes && (
              <div>
                <div className="text-sm text-muted-foreground">Observações</div>
                <div className="text-sm" data-testid="text-notes">{order.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Requisições Incluídas ({requests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma requisição vinculada
              </p>
            ) : (
              <div className="space-y-2">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-2 rounded border"
                    data-testid={`request-${request.id}`}
                  >
                    <div>
                      <div className="font-medium text-sm">{request.area}</div>
                      <div className="text-xs text-muted-foreground">
                        #{request.id.slice(0, 8)}
                      </div>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Itens Consolidados ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {itemsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando itens...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum item consolidado
            </p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4"
                  data-testid={`item-${item.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-semibold text-lg" data-testid={`item-name-${item.id}`}>
                        {item.product?.name || "Produto não encontrado"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        SKU: {item.product?.sku || "N/A"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" data-testid={`item-quantity-${item.id}`}>
                        {item.consolidatedQuantity}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.product?.unit || "un"}
                      </div>
                    </div>
                  </div>

                  {item.sourceRequests && item.sourceRequests.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">
                        Origem:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.sourceRequests.map((source, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs"
                            data-testid={`source-${item.id}-${idx}`}
                          >
                            {source.area}: {source.quantity} {item.product?.unit || "un"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useParams, useLocation } from "wouter";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, FileText, Calendar, CheckCircle, XCircle, TruckIcon, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LoadingOrder, Event, MaterialRequest, Movement, MovementItem } from "@shared/schema";
import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  userCanApproveLoadingOrder,
  userCanMarkLoadingOrderReady,
} from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

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
  const { toast } = useToast();
  const { user } = useAuth();
  const canMarkReady = userCanMarkLoadingOrderReady(user);
  const canApprove = userCanApproveLoadingOrder(user);

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

  const { data: movements = [] } = useQuery<Movement[]>({
    queryKey: [`/api/loading-orders/${id}/movements`],
    enabled: !!id,
  });

  // Fetch items for each movement using useQueries (compliant with Rules of Hooks)
  const movementItemsQueries = useQueries({
    queries: movements.map(movement => ({
      queryKey: [`/api/movements/${movement.id}/items`],
      queryFn: async () => {
        const res = await fetch(`/api/movements/${movement.id}/items`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch movement items");
        return res.json() as Promise<MovementItem[]>;
      },
      enabled: !!movement.id,
    })),
  });

  // Calculate progress by product across all movements
  const productProgress = useMemo(() => {
    const progressMap = new Map<string, {
      productId: string;
      productName: string;
      productSku: string;
      expectedQuantity: number;
      loadedQuantity: number;
    }>();

    // Initialize with loading order items and accumulate expected quantities for duplicate products
    items.forEach(item => {
      if (item.product) {
        const existing = progressMap.get(item.productId);
        if (existing) {
          // Accumulate expected quantity for duplicate products
          existing.expectedQuantity += item.consolidatedQuantity;
        } else {
          progressMap.set(item.productId, {
            productId: item.productId,
            productName: item.product.name,
            productSku: item.product.sku,
            expectedQuantity: item.consolidatedQuantity,
            loadedQuantity: 0,
          });
        }
      }
    });

    // Aggregate loaded quantities from all movements
    movementItemsQueries.forEach(query => {
      if (query.data) {
        query.data.forEach(movementItem => {
          const existing = progressMap.get(movementItem.productId);
          if (existing) {
            existing.loadedQuantity += movementItem.quantity;
          }
        });
      }
    });

    return Array.from(progressMap.values());
  }, [items, movementItemsQueries]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loading-orders/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/loading-orders/${id}`] });
      toast({
        title: "Ordem aprovada",
        description: "A ordem de carregamento foi aprovada para carga.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao aprovar",
        description: "Não foi possível aprovar a ordem de carregamento.",
        variant: "destructive",
      });
    },
  });

  const disapproveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loading-orders/${id}/disapprove`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/loading-orders/${id}`] });
      toast({
        title: "Ordem desaprovada",
        description: "A ordem de carregamento voltou para rascunho.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao desaprovar",
        description: "Não foi possível desaprovar a ordem de carregamento.",
        variant: "destructive",
      });
    },
  });

  const markAsReadyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loading-orders/${id}/mark-ready`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/loading-orders/${id}`] });
      toast({
        title: "Ordem marcada como pronta",
        description: "A ordem de carregamento agora pode ser aprovada para carga.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao marcar como pronta",
        description: "Não foi possível marcar a ordem de carregamento como pronta.",
        variant: "destructive",
      });
    },
  });

  if (orderLoading) {
    return (
      <PageLoading message="Carregando ordem..." />
    );
  }

  if (!order) {
    return (
      <EmptyState
        icon={Package}
        title="Ordem não encontrada"
        description="A ordem de carregamento solicitada não existe"
        action={{
          label: "Voltar para ordens",
          onClick: () => navigate("/loading-orders"),
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.orderNumber}
        description={order.event?.name || "Evento não encontrado"}
      >
        <div className="flex items-center gap-2">
          {order.status === "ready" && canApprove && (
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid="button-approve"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprovar para Carga
            </Button>
          )}
          {order.status === "approved" && canApprove && (
            <Button
              variant="outline"
              onClick={() => disapproveMutation.mutate()}
              disabled={disapproveMutation.isPending}
              data-testid="button-disapprove"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Desaprovar
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="font-semibold text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Informações da Ordem
            </div>
            <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Início:</span>
                <span className="font-medium" data-testid="text-planned-start">
                  {format(new Date(order.plannedStartTime), "dd/MM/yyyy, HH:mm")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Fim:</span>
                <span className="font-medium" data-testid="text-planned-end">
                  {format(new Date(order.plannedEndTime), "dd/MM/yyyy, HH:mm")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Criado por:</span>
                <span className="font-medium" data-testid="text-created-by">
                  {order.createdBy}
                </span>
              </div>
              <StatusBadge status={order.status} />
            </div>
            {order.notes && (
              <div className="mt-2 pt-2 border-t border-border/40">
                <div className="text-sm text-muted-foreground">Observações</div>
                <div className="text-sm mt-1" data-testid="text-notes">{order.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="font-semibold text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Requisições Incluídas ({requests.length})
            </div>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma requisição vinculada
              </p>
            ) : (
              <div className="space-y-2">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="border rounded-lg p-3 hover-elevate cursor-pointer"
                    onClick={() => navigate(`/requests/${request.id}`)}
                    data-testid={`request-${request.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{request.area}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          #{request.id.slice(0, 8)}
                        </span>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="font-semibold text-base flex items-center gap-2">
            <Package className="h-5 w-5" />
            Itens Consolidados ({items.length})
          </div>
          <div className="mt-3 pt-3 border-t border-border/40">
          {itemsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando itens...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum item consolidado
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-3 hover-elevate"
                  data-testid={`item-${item.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-base" data-testid={`item-name-${item.id}`}>
                        {item.product?.name || "Produto não encontrado"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        SKU: {item.product?.sku || "N/A"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold" data-testid={`item-quantity-${item.id}`}>
                        {item.consolidatedQuantity}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.product?.unit || "un"}
                      </div>
                    </div>
                  </div>

                  {item.sourceRequests && item.sourceRequests.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <div className="text-sm font-medium text-muted-foreground">
                        Origem:
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
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
          </div>
        </CardContent>
      </Card>

      {/* Seção de Movimentações e Progresso */}
      {movements.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-6">
            <div className="font-semibold text-base flex items-center gap-2">
              <TruckIcon className="h-5 w-5" />
              Movimentações e Progresso ({movements.length})
            </div>
            {/* Resumo de Progresso por Produto */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                Progresso por Produto
              </h3>
              <div className="space-y-3">
                {productProgress.map((progress) => {
                  const percentage = progress.expectedQuantity > 0
                    ? Math.round((progress.loadedQuantity / progress.expectedQuantity) * 100)
                    : 0;
                  const isComplete = progress.loadedQuantity >= progress.expectedQuantity;
                  const isExceeded = progress.loadedQuantity > progress.expectedQuantity;

                  return (
                    <div
                      key={progress.productId}
                      className="border rounded-lg p-4 space-y-2"
                      data-testid={`product-progress-${progress.productId}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{progress.productName}</p>
                          <p className="text-sm text-muted-foreground">SKU: {progress.productSku}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">
                            {progress.loadedQuantity} / {progress.expectedQuantity}
                          </div>
                          <div className="text-xs text-muted-foreground">{percentage}%</div>
                        </div>
                      </div>
                      <Progress
                        value={Math.min(percentage, 100)}
                        className={`h-2 ${isExceeded ? "[&>div]:bg-destructive" : isComplete ? "[&>div]:bg-chart-4" : ""}`}
                      />
                      {isExceeded && (
                        <div className="flex items-center gap-1 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          <span>Excedido em {progress.loadedQuantity - progress.expectedQuantity} unidades</span>
                        </div>
                      )}
                      {isComplete && !isExceeded && (
                        <div className="flex items-center gap-1 text-sm text-chart-4">
                          <CheckCircle className="h-4 w-4" />
                          <span>Completo</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lista de Movimentações */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                Histórico de Movimentações
              </h3>
              <div className="space-y-2">
                {movements.map((movement, idx) => {
                  const movementItems = movementItemsQueries[idx]?.data || [];
                  const totalItems = movementItems.reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <div
                      key={movement.id}
                      className="border rounded-lg p-4 hover-elevate cursor-pointer"
                      onClick={() => navigate(`/movements/${movement.id}`)}
                      data-testid={`movement-${movement.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{movement.type || "Movimentação"}</p>
                            <StatusBadge status={movement.status} />
                          </div>
                          {movement.vehiclePlate && (
                            <p className="text-sm text-muted-foreground">
                              Veículo: {movement.vehiclePlate}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(movement.createdAt), "dd/MM/yyyy, HH:mm")}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{totalItems}</div>
                          <div className="text-xs text-muted-foreground">itens carregados</div>
                        </div>
                      </div>
                      {movementItems.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs text-muted-foreground mb-1">Itens:</div>
                          <div className="flex flex-wrap gap-1">
                            {movementItems.slice(0, 3).map((item, itemIdx) => {
                              const product = items.find(i => i.productId === item.productId)?.product;
                              return (
                                <Badge key={itemIdx} variant="secondary" className="text-xs">
                                  {product?.name || "Produto"}: {item.quantity}
                                </Badge>
                              );
                            })}
                            {movementItems.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{movementItems.length - 3} mais
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

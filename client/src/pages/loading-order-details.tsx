import { useParams, useLocation } from "wouter";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Package, FileText, Calendar, CheckCircle, XCircle, Truck,
  AlertCircle, Edit, User, ClipboardList, Layers, Info, ArrowRight,
  ChevronRight, CircleDot, Clock, MapPin
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LoadingOrder, Event, MaterialRequest, Movement, MovementItem } from "@shared/schema";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  userCanApproveLoadingOrder,
  userCanMarkLoadingOrderReady,
  userCanWriteLogistics,
} from "@/lib/authz";
import { PageHeader, PageLoading, EmptyState } from "@/components";
import { ActionBar } from "@/components/action-bar";
import { LoadingOrderDialog } from "@/components/loading-order-dialog";

type LoadingOrderItem = {
  id: string;
  loadingOrderId: string;
  productId: string;
  consolidatedQuantity: number;
  pickedQuantity?: number;
  loadedQuantity?: number;
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

const statusBarColors: Record<string, string> = {
  draft: "border-l-muted-foreground",
  ready: "border-l-chart-4",
  in_progress: "border-l-chart-5",
  completed: "border-l-chart-4",
  cancelled: "border-l-destructive",
};

export default function LoadingOrderDetails() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const canMarkReady = userCanMarkLoadingOrderReady(user);
  const canApprove = userCanApproveLoadingOrder(user);
  const canWrite = userCanWriteLogistics(user);
  const [showDialog, setShowDialog] = useState(false);

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

  const productProgress = useMemo(() => {
    const progressMap = new Map<string, {
      productId: string;
      productName: string;
      productSku: string;
      expectedQuantity: number;
      loadedQuantity: number;
    }>();

    items.forEach(item => {
      if (item.product) {
        const existing = progressMap.get(item.productId);
        if (existing) {
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
      toast({ title: "Ordem aprovada", description: "A ordem de carregamento foi aprovada para carga." });
    },
    onError: () => {
      toast({ title: "Erro ao aprovar", description: "Não foi possível aprovar a ordem.", variant: "destructive" });
    },
  });

  const disapproveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loading-orders/${id}/disapprove`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/loading-orders/${id}`] });
      toast({ title: "Ordem desaprovada", description: "A ordem voltou para rascunho." });
    },
    onError: () => {
      toast({ title: "Erro ao desaprovar", description: "Não foi possível desaprovar a ordem.", variant: "destructive" });
    },
  });

  const markAsReadyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loading-orders/${id}/mark-ready`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/loading-orders/${id}`] });
      toast({ title: "Ordem marcada como pronta", description: "A ordem agora pode ser aprovada para carga." });
    },
    onError: () => {
      toast({ title: "Erro ao marcar como pronta", description: "Não foi possível marcar a ordem como pronta.", variant: "destructive" });
    },
  });

  if (orderLoading) {
    return <PageLoading message="Carregando ordem..." />;
  }

  if (!order) {
    return (
      <EmptyState
        icon={Package}
        title="Ordem não encontrada"
        description="A ordem de carregamento solicitada não existe"
        action={{ label: "Voltar para ordens", onClick: () => navigate("/loading-orders") }}
      />
    );
  }

  const statusBorder = statusBarColors[order.status] || "border-l-muted-foreground";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={order.orderNumber}
        description={order.event?.name || "Evento não encontrado"}
      >
        <ActionBar className="flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/loading-orders")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDialog(true)}
              data-testid="button-edit"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {order.status === "draft" && canMarkReady && (
            <Button
              size="sm"
              onClick={() => markAsReadyMutation.mutate()}
              disabled={markAsReadyMutation.isPending}
              data-testid="button-mark-ready"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {markAsReadyMutation.isPending ? "Marcando..." : "Marcar como Pronta"}
            </Button>
          )}
          {order.status === "ready" && canApprove && (
            <Button
              size="sm"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              data-testid="button-approve"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {approveMutation.isPending ? "Aprovando..." : "Aprovar para Carga"}
            </Button>
          )}
          {order.status === "approved" && canApprove && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => disapproveMutation.mutate()}
              disabled={disapproveMutation.isPending}
              data-testid="button-disapprove"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {disapproveMutation.isPending ? "Desaprovando..." : "Desaprovar"}
            </Button>
          )}
        </ActionBar>
      </PageHeader>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Informações da Ordem */}
        <Card className={`border-border/60 overflow-hidden ${statusBorder} border-l-4`}>
          <CardContent className="p-5">
            <div className="font-semibold text-base flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ClipboardList className="h-4 w-4" />
              </div>
              Informações da Ordem
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CircleDot className="h-4 w-4" />
                  <span>Status</span>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Início</span>
                </div>
                <span className="font-medium" data-testid="text-planned-start">
                  {format(new Date(order.plannedStartTime), "dd MMM, HH:mm")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Fim</span>
                </div>
                <span className="font-medium" data-testid="text-planned-end">
                  {format(new Date(order.plannedEndTime), "dd MMM, HH:mm")}
                </span>
              </div>
              {order.loadingDate && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Truck className="h-4 w-4" />
                    <span>Carregamento</span>
                  </div>
                  <span className="font-medium">
                    {format(new Date(order.loadingDate), "dd MMM, HH:mm")}
                  </span>
                </div>
              )}
              {order.unloadingDate && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>Descarregamento</span>
                  </div>
                  <span className="font-medium">
                    {format(new Date(order.unloadingDate), "dd MMM, HH:mm")}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Responsável</span>
                </div>
                <span className="font-medium" data-testid="text-created-by">{order.createdBy}</span>
              </div>
              {order.notes && (
                <div className="pt-2 border-t border-border/40">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Info className="h-4 w-4" />
                    <span>Observações</span>
                  </div>
                  <p className="text-sm text-foreground" data-testid="text-notes">{order.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Requisições Incluídas */}
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-5">
            <div className="font-semibold text-base flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-4/10 text-chart-4">
                <FileText className="h-4 w-4" />
              </div>
              Requisições Incluídas ({requests.length})
            </div>
            {requests.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhuma requisição"
                description="Nenhuma requisição vinculada a esta ordem"
                compact
              />
            ) : (
              <div className="space-y-2">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover-elevate cursor-pointer bg-card/50"
                    onClick={() => navigate(`/requests/${request.id}`)}
                    data-testid={`request-${request.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{request.area}</p>
                        <p className="text-xs text-muted-foreground font-mono">#{request.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={request.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Itens Consolidados */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-5">
          <div className="font-semibold text-base flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-5/10 text-chart-5">
              <Layers className="h-4 w-4" />
            </div>
            Itens Consolidados ({items.length})
          </div>
          <div className="mt-3 pt-3 border-t border-border/40">
            {itemsLoading ? (
              <PageLoading message="Carregando itens..." compact />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nenhum item consolidado"
                description="Esta ordem ainda não possui itens consolidados"
                compact
              />
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover-elevate bg-card/50"
                    data-testid={`item-${item.id}`}
                  >
                    {/* Item header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-base" data-testid={`item-name-${item.id}`}>
                            {item.product?.name || "Produto não encontrado"}
                          </div>
                          <div className="text-sm text-muted-foreground font-mono">
                            SKU: {item.product?.sku || "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-bold" data-testid={`item-quantity-${item.id}`}>
                          {item.consolidatedQuantity}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.product?.unit || "un"}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">
                          {item.loadedQuantity || 0} / {item.consolidatedQuantity}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(((item.loadedQuantity || 0) / item.consolidatedQuantity) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Quantidades operacionais */}
                    <div className="flex flex-wrap gap-3 text-sm mb-2">
                      {item.pickedQuantity !== undefined && (
                        <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1">
                          <span className="text-muted-foreground">Separado:</span>
                          <span className="font-medium">{item.pickedQuantity}</span>
                        </div>
                      )}
                      {item.loadedQuantity !== undefined && (
                        <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1">
                          <span className="text-muted-foreground">Carregado:</span>
                          <span className="font-medium">{item.loadedQuantity}</span>
                        </div>
                      )}
                    </div>

                    {/* Origens */}
                    {item.sourceRequests && item.sourceRequests.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/40">
                        <div className="text-xs text-muted-foreground mb-1.5 font-medium">Origens:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.sourceRequests.map((source, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs font-normal"
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

      {/* Progresso de Carregamento */}
      {productProgress.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-5">
            <div className="font-semibold text-base flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-4/10 text-chart-4">
                <Truck className="h-4 w-4" />
              </div>
              Progresso de Carregamento
            </div>
            <div className="space-y-4">
              {productProgress.map((progress) => {
                const percentage = progress.expectedQuantity > 0
                  ? Math.round((progress.loadedQuantity / progress.expectedQuantity) * 100)
                  : 0;
                const isComplete = progress.loadedQuantity >= progress.expectedQuantity && progress.expectedQuantity > 0;
                const isExceeded = progress.loadedQuantity > progress.expectedQuantity;

                return (
                  <div
                    key={progress.productId}
                    className="border rounded-lg p-4 space-y-3 bg-card/50"
                    data-testid={`product-progress-${progress.productId}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{progress.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">SKU: {progress.productSku}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold">
                          {progress.loadedQuantity} / {progress.expectedQuantity}
                        </div>
                        <div className="text-xs text-muted-foreground">{percentage}%</div>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(percentage, 100)}
                      className={`h-2 ${
                        isExceeded
                          ? "[&>div]:bg-destructive"
                          : isComplete
                          ? "[&>div]:bg-chart-4"
                          : "[&>div]:bg-primary"
                      }`}
                    />
                    {isExceeded && (
                      <div className="flex items-center gap-1.5 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>Excedido em {progress.loadedQuantity - progress.expectedQuantity} unidades</span>
                      </div>
                    )}
                    {isComplete && !isExceeded && (
                      <div className="flex items-center gap-1.5 text-sm text-chart-4">
                        <CheckCircle className="h-4 w-4" />
                        <span>Completo</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Movimentações - Timeline */}
      {movements.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-5">
            <div className="font-semibold text-base flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-5/10 text-chart-5">
                <Truck className="h-4 w-4" />
              </div>
              Movimentações ({movements.length})
            </div>
            <div className="space-y-0">
              {movements.map((movement, idx) => {
                const movementItems = movementItemsQueries[idx]?.data || [];
                const totalItems = movementItems.reduce((sum, item) => sum + item.quantity, 0);
                const isLast = idx === movements.length - 1;

                return (
                  <div key={movement.id} className="flex gap-4">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Truck className="h-4 w-4" />
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 bg-border/60 my-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-5">
                      <div
                        className="border rounded-lg p-4 hover-elevate cursor-pointer bg-card/50"
                        onClick={() => navigate(`/movements/${movement.id}`)}
                        data-testid={`movement-${movement.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm">{movement.type || "Movimentação"}</span>
                              <StatusBadge status={movement.status} />
                            </div>
                            {movement.vehiclePlate && (
                              <p className="text-sm text-muted-foreground">
                                Veículo: {movement.vehiclePlate}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3.5 w-3.5" />
                              {format(new Date(movement.createdAt), "dd MMM, HH:mm")}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold">{totalItems}</div>
                            <div className="text-xs text-muted-foreground">itens</div>
                          </div>
                        </div>
                        {movementItems.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/40">
                            <div className="flex flex-wrap gap-1">
                              {movementItems.slice(0, 3).map((item, itemIdx) => {
                                const product = items.find(i => i.productId === item.productId)?.product;
                                return (
                                  <Badge key={itemIdx} variant="secondary" className="text-xs font-normal">
                                    {product?.name || "Produto"}: {item.quantity}
                                  </Badge>
                                );
                              })}
                              {movementItems.length > 3 && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                  +{movementItems.length - 3} mais
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <LoadingOrderDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        order={order}
      />
    </div>
  );
}

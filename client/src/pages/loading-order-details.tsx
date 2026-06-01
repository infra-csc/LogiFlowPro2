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
import { ptBR } from "date-fns/locale";
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

function movementTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    outbound_event: "Saída para evento",
    inbound_return: "Retorno / Devolução",
    inbound_event: "Entrada de evento",
    outbound_return: "Saída para retorno",
    transfer: "Transferência",
    adjustment: "Ajuste",
    inventory: "Inventário",
    other: "Outro",
  };
  return labels[type || ""] || type || "Movimentação";
}

export default function LoadingOrderDetails() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const canMarkReady = userCanMarkLoadingOrderReady(user);
  const canApprove = userCanApproveLoadingOrder(user);
  const canWrite = userCanWriteLogistics(user);
  const [showDialog, setShowDialog] = useState(false);

  // Buscar da lista de orders para obter nome do usuário e evento já resolvidos
  const { data: allOrders = [], isLoading: orderLoading } = useQuery<LoadingOrderWithRelations[]>({
    queryKey: ["/api/loading-orders"],
    enabled: !!id,
  });

  const order = useMemo(() => allOrders.find((o) => o.id === id), [allOrders, id]);

  const { data: items = [], isLoading: itemsLoading } = useQuery<LoadingOrderItem[]>({
    queryKey: [`/api/loading-orders/${id}/items`],
    enabled: !!id,
  });

  const { data: requests = [] } = useQuery<MaterialRequest[]>({
    queryKey: [`/api/loading-orders/${id}/requests`],
    enabled: !!id,
  });

  const { data: allRequestsForMap = [] } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/requests"],
    enabled: !!id,
  });

  const reqNumericIdMap = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...allRequestsForMap].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    sorted.forEach((req, idx) => map.set(req.id, String(idx + 1).padStart(3, "0")));
    return map;
  }, [allRequestsForMap]);

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

  // Progress summary
  const progressSummary = useMemo(() => {
    const totalExpected = productProgress.reduce((sum, p) => sum + p.expectedQuantity, 0);
    const totalLoaded = productProgress.reduce((sum, p) => sum + p.loadedQuantity, 0);
    const overallPercentage = totalExpected > 0 ? Math.round((totalLoaded / totalExpected) * 100) : 0;
    const exceededCount = productProgress.filter(p => p.loadedQuantity > p.expectedQuantity).length;
    return { totalExpected, totalLoaded, overallPercentage, exceededCount };
  }, [productProgress]);

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


  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={order.orderNumber}
        description={order.event?.name || undefined}
      >
        <ActionBar>
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

      {/* Alerta se evento não encontrado */}
      {!order.event && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Evento não encontrado — dados de referência podem estar incompletos
        </div>
      )}

      {/* Resumo compacto */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CircleDot className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Status</span>
            </div>
            <StatusBadge status={order.status} />
          </CardContent>
        </Card>
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Requisições</span>
            </div>
            <div className="text-sm font-medium">{requests.length} incluída{requests.length !== 1 ? 's' : ''}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Layers className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Itens</span>
            </div>
            <div className="text-sm font-medium">{items.length} consolidado{items.length !== 1 ? 's' : ''}</div>
          </CardContent>
        </Card>
      </div>

      {/* Informações da Ordem */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-4">
          <div className="font-semibold text-base flex items-center gap-2 mb-3 pb-3 border-b border-border/20">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ClipboardList className="h-3.5 w-3.5" />
            </div>
            Informações da Ordem
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Início</span>
              <span className="font-medium" data-testid="text-planned-start">
                {format(new Date(order.plannedStartTime), "dd MMM, HH:mm", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Fim</span>
              <span className="font-medium" data-testid="text-planned-end">
                {format(new Date(order.plannedEndTime), "dd MMM, HH:mm", { locale: ptBR })}
              </span>
            </div>
            {order.loadingDate && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Carregamento</span>
                <span className="font-medium">
                  {format(new Date(order.loadingDate), "dd MMM, HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
            {order.unloadingDate && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Descarregamento</span>
                <span className="font-medium">
                  {format(new Date(order.unloadingDate), "dd MMM, HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Responsável</span>
              <span className="font-medium" data-testid="text-created-by">{order.createdBy || "Não informado"}</span>
            </div>
            {order.event && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Evento</span>
                <span className="font-medium">{order.event.name}</span>
              </div>
            )}
          </div>
          {order.notes && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Info className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Observações</span>
              </div>
              <p className="text-sm text-foreground" data-testid="text-notes">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Requisições Incluídas */}
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-4">
            <div className="font-semibold text-base flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-4/10 text-chart-4">
                <FileText className="h-3.5 w-3.5" />
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
                    className="flex items-center justify-between p-3 rounded-md border border-border/60 hover-elevate cursor-pointer bg-card/50"
                    onClick={() => navigate(`/requests/${request.id}`)}
                    data-testid={`request-${request.id}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/requests/${request.id}`);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{request.area}</p>
                        <p className="text-xs text-muted-foreground font-mono">REQ-{reqNumericIdMap.get(request.id) || request.id.slice(0, 6).toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={request.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Itens Consolidados */}
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-4">
            <div className="font-semibold text-base flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-5/10 text-chart-5">
                <Layers className="h-3.5 w-3.5" />
              </div>
              Itens Consolidados ({items.length})
            </div>
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
              <div className="space-y-2 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-md p-3 hover-elevate bg-card/50"
                    data-testid={`item-${item.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                          <Package className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate" data-testid={`item-name-${item.id}`}>
                            {item.product?.name || "Produto não encontrado"}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            SKU: {item.product?.sku || "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-semibold" data-testid={`item-quantity-${item.id}`}>
                          {item.consolidatedQuantity}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.product?.unit || "un"}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">
                          {item.loadedQuantity || 0} / {item.consolidatedQuantity}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(((item.loadedQuantity || 0) / item.consolidatedQuantity) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Quantidades operacionais */}
                    <div className="flex flex-wrap gap-2 text-xs mb-2">
                      {item.pickedQuantity !== undefined && item.pickedQuantity > 0 && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Separado: {item.pickedQuantity}
                        </Badge>
                      )}
                      {item.loadedQuantity !== undefined && item.loadedQuantity > 0 && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Carregado: {item.loadedQuantity}
                        </Badge>
                      )}
                    </div>

                    {/* Origens */}
                    {item.sourceRequests && item.sourceRequests.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/40">
                        <div className="flex flex-wrap gap-1">
                          {item.sourceRequests.map((source, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs font-normal"
                              data-testid={`source-${item.id}-${idx}`}
                            >
                              {source.area}: {source.quantity}
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

      {/* Progresso de Carregamento */}
      {productProgress.length > 0 && (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-4">
            <div className="font-semibold text-base flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-4/10 text-chart-4">
                <Truck className="h-3.5 w-3.5" />
              </div>
              Progresso de Carregamento
            </div>

            {/* Resumo do progresso */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Total esperado</span>
                  <span className="font-semibold">{progressSummary.totalExpected}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Total carregado</span>
                  <span className="font-semibold">{progressSummary.totalLoaded}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Percentual</span>
                  <span className="font-semibold">{progressSummary.overallPercentage}%</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Excedidos</span>
                  <span className={`font-semibold ${progressSummary.exceededCount > 0 ? 'text-destructive' : ''}`}>
                    {progressSummary.exceededCount > 0 ? `${progressSummary.exceededCount} itens` : 'Nenhum'}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <Progress value={Math.min(progressSummary.overallPercentage, 100)} className="h-2" />
              </div>
            </div>

            <div className="space-y-3">
              {productProgress.map((progress) => {
                const percentage = progress.expectedQuantity > 0
                  ? Math.round((progress.loadedQuantity / progress.expectedQuantity) * 100)
                  : 0;
                const isComplete = progress.loadedQuantity >= progress.expectedQuantity && progress.expectedQuantity > 0;
                const isExceeded = progress.loadedQuantity > progress.expectedQuantity;

                return (
                  <div
                    key={progress.productId}
                    className="border rounded-md p-3 space-y-2 bg-card/50"
                    data-testid={`product-progress-${progress.productId}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                          <Package className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{progress.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">SKU: {progress.productSku}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-semibold">
                          {progress.loadedQuantity} / {progress.expectedQuantity}
                        </div>
                        <div className="text-xs text-muted-foreground">{percentage}%</div>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(percentage, 100)}
                      className={`h-1.5 ${
                        isExceeded
                          ? "[&>div]:bg-destructive"
                          : isComplete
                          ? "[&>div]:bg-chart-4"
                          : "[&>div]:bg-primary"
                      }`}
                    />
                    {isExceeded && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Excedido em {progress.loadedQuantity - progress.expectedQuantity} unidades</span>
                      </div>
                    )}
                    {isComplete && !isExceeded && (
                      <div className="flex items-center gap-1.5 text-xs text-chart-4">
                        <CheckCircle className="h-3.5 w-3.5" />
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
          <CardContent className="p-4">
            <div className="font-semibold text-base flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-5/10 text-chart-5">
                <Truck className="h-3.5 w-3.5" />
              </div>
              Movimentações ({movements.length})
            </div>
            <div className="space-y-0">
              {movements.map((movement, idx) => {
                const movementItems = movementItemsQueries[idx]?.data || [];
                const totalItems = movementItems.reduce((sum, item) => sum + item.quantity, 0);
                const isLast = idx === movements.length - 1;

                return (
                  <div key={movement.id} className="flex gap-3">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Truck className="h-3.5 w-3.5" />
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 bg-border/60 my-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div
                        className="border rounded-md p-3 hover-elevate cursor-pointer bg-card/50"
                        onClick={() => navigate(`/movements/${movement.id}`)}
                        data-testid={`movement-${movement.id}`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/movements/${movement.id}`);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm">{movementTypeLabel(movement.type)}</span>
                              <StatusBadge status={movement.status} />
                            </div>
                            {movement.vehiclePlate && (
                              <p className="text-xs text-muted-foreground">
                                Veículo: {movement.vehiclePlate}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(movement.createdAt), "dd MMM, HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-base font-semibold">{totalItems}</div>
                            <div className="text-xs text-muted-foreground">itens</div>
                          </div>
                        </div>
                        {movementItems.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/40">
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

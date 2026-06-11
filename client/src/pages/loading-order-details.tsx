import { useParams, useLocation } from "wouter";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Package, FileText, Calendar, CheckCircle, XCircle, Truck,
  AlertCircle, Edit, User, ClipboardList, Layers, Info, ArrowRight,
  ChevronRight, CircleDot, Clock, MapPin, TrendingDown, TrendingUp,
  BarChart3, Activity, Hash, AlertTriangle
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    ready: "Pronta",
    approved: "Aprovada",
    in_progress: "Em Andamento",
    completed: "Concluída",
    cancelled: "Cancelada",
  };
  return labels[status] || status;
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
  const [activeTab, setActiveTab] = useState("items");

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
      productUnit: string;
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
            productUnit: item.product.unit,
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

  const progressSummary = useMemo(() => {
    const totalExpected = productProgress.reduce((sum, p) => sum + p.expectedQuantity, 0);
    const totalLoaded = productProgress.reduce((sum, p) => sum + p.loadedQuantity, 0);
    const overallPercentage = totalExpected > 0 ? Math.round((totalLoaded / totalExpected) * 100) : 0;
    const exceededCount = productProgress.filter(p => p.loadedQuantity > p.expectedQuantity).length;
    const shortCount = productProgress.filter(p => p.loadedQuantity < p.expectedQuantity).length;
    const completeCount = productProgress.filter(p => p.loadedQuantity === p.expectedQuantity && p.expectedQuantity > 0).length;
    const divergenceCount = exceededCount + shortCount;
    return { totalExpected, totalLoaded, overallPercentage, exceededCount, shortCount, completeCount, divergenceCount };
  }, [productProgress]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loading-orders/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loading-orders"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/loading-orders"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/loading-orders"] });
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

  const alertBanner = (() => {
    if (order.status === "draft" && requests.length === 0) {
      return {
        type: "warning" as const,
        icon: AlertTriangle,
        message: "Nenhuma requisição vinculada — adicione requisições antes de marcar como pronta.",
      };
    }
    if (order.status === "ready" && canApprove) {
      return {
        type: "info" as const,
        icon: CheckCircle,
        message: "Ordem pronta para aprovação — revise os itens consolidados e aprove para iniciar a carga.",
      };
    }
    if (progressSummary.exceededCount > 0 && (order.status === "approved" || order.status === "in_progress")) {
      return {
        type: "error" as const,
        icon: AlertCircle,
        message: `${progressSummary.exceededCount} produto${progressSummary.exceededCount > 1 ? "s" : ""} com quantidade excedida — revise as movimentações.`,
      };
    }
    if (order.status === "approved" && progressSummary.totalLoaded === 0 && items.length > 0) {
      return {
        type: "info" as const,
        icon: Truck,
        message: "Ordem aprovada — nenhum item carregado ainda. Inicie as movimentações para registrar o progresso.",
      };
    }
    return null;
  })();

  const alertColorMap = {
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    info: "border-primary/30 bg-primary/10 text-primary",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-5">
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

      {/* Alert Banner */}
      {alertBanner && (
        <div className={`rounded-lg border p-3 text-sm flex items-center gap-2.5 ${alertColorMap[alertBanner.type]}`}>
          <alertBanner.icon className="h-4 w-4 shrink-0" />
          <span>{alertBanner.message}</span>
        </div>
      )}

      {!order.event && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Evento não encontrado — dados de referência podem estar incompletos
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Status */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
              <CircleDot className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Status</span>
            </div>
            <StatusBadge status={order.status} />
          </CardContent>
        </Card>

        {/* Requisições */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Requisições</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{requests.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {requests.length === 1 ? "incluída" : "incluídas"}
            </div>
          </CardContent>
        </Card>

        {/* Itens */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
              <Layers className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Itens</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{items.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {items.length === 1 ? "consolidado" : "consolidados"}
            </div>
          </CardContent>
        </Card>

        {/* Progresso */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Progresso</span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${
              progressSummary.overallPercentage === 100
                ? "text-chart-4"
                : progressSummary.overallPercentage >= 50
                ? "text-amber-400"
                : "text-foreground"
            }`}>
              {progressSummary.overallPercentage}%
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {progressSummary.totalLoaded}/{progressSummary.totalExpected} un
            </div>
          </CardContent>
        </Card>

        {/* Divergências */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Divergências</span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${
              progressSummary.divergenceCount > 0 ? "text-destructive" : "text-chart-4"
            }`}>
              {progressSummary.divergenceCount}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {progressSummary.divergenceCount === 0 ? "sem divergências" : "produto(s) com desvio"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start border-b border-border/60 bg-transparent rounded-none pb-0 h-auto gap-0 mb-0">
          <TabsTrigger
            value="items"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1"
            data-testid="tab-items"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Itens
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {items.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="progress"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1"
            data-testid="tab-progress"
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Progresso
            {progressSummary.divergenceCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-xs">
                {progressSummary.divergenceCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="movements"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1"
            data-testid="tab-movements"
          >
            <Truck className="h-3.5 w-3.5 mr-1.5" />
            Movimentações
            {movements.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {movements.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="info"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1"
            data-testid="tab-info"
          >
            <Info className="h-3.5 w-3.5 mr-1.5" />
            Informações
          </TabsTrigger>
        </TabsList>

        {/* ── ABA ITENS ── */}
        <TabsContent value="items" className="mt-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Requisições Incluídas */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="font-semibold text-base flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-4/10 text-chart-4">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  Requisições Incluídas
                  <Badge variant="secondary" className="ml-auto font-normal">
                    {requests.length}
                  </Badge>
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
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 text-muted-foreground shrink-0">
                            <FileText className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{request.area}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              REQ-{reqNumericIdMap.get(request.id) || request.id.slice(0, 6).toUpperCase()}
                            </p>
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
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="font-semibold text-base flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-5/10 text-chart-5">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  Itens Consolidados
                  <Badge variant="secondary" className="ml-auto font-normal">
                    {items.length}
                  </Badge>
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
                  <div className="space-y-2 max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {items.map((item) => {
                      const loaded = item.loadedQuantity || 0;
                      const expected = item.consolidatedQuantity;
                      const pct = expected > 0 ? (loaded / expected) * 100 : 0;
                      const isExceeded = loaded > expected;
                      const isComplete = loaded === expected && expected > 0;
                      return (
                        <div
                          key={item.id}
                          className="border border-border/60 rounded-md p-3 bg-card/50"
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
                              <div className="text-lg font-semibold tabular-nums" data-testid={`item-quantity-${item.id}`}>
                                {expected}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.product?.unit || "un"}
                              </div>
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Carregado</span>
                              <span className={`font-medium tabular-nums ${isExceeded ? "text-destructive" : isComplete ? "text-chart-4" : ""}`}>
                                {loaded} / {expected}
                              </span>
                            </div>
                            {isExceeded ? (
                              <div className="w-full bg-muted rounded-full h-1.5 flex overflow-hidden">
                                <div className="h-full bg-chart-4" style={{ width: `${(expected / loaded) * 100}%` }} />
                                <div className="h-full bg-destructive" style={{ width: `${((loaded - expected) / loaded) * 100}%` }} />
                              </div>
                            ) : (
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div
                                  className={`h-full rounded-full ${isComplete ? "bg-chart-4" : pct >= 50 ? "bg-amber-500" : pct > 0 ? "bg-destructive" : "bg-muted-foreground/30"}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Source badges */}
                          {item.sourceRequests && item.sourceRequests.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/40">
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ABA PROGRESSO ── */}
        <TabsContent value="progress" className="mt-5 space-y-4">
          {/* Barra geral */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="font-semibold text-base flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-4/10 text-chart-4">
                  <BarChart3 className="h-3.5 w-3.5" />
                </div>
                Resumo de Carregamento
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">{progressSummary.totalExpected}</div>
                  <div className="text-xs text-muted-foreground">esperado</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold tabular-nums ${
                    progressSummary.totalLoaded === progressSummary.totalExpected && progressSummary.totalExpected > 0
                      ? "text-chart-4"
                      : ""
                  }`}>{progressSummary.totalLoaded}</div>
                  <div className="text-xs text-muted-foreground">carregado</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold tabular-nums ${progressSummary.overallPercentage === 100 ? "text-chart-4" : ""}`}>
                    {progressSummary.overallPercentage}%
                  </div>
                  <div className="text-xs text-muted-foreground">conclusão</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold tabular-nums ${progressSummary.divergenceCount > 0 ? "text-destructive" : "text-chart-4"}`}>
                    {progressSummary.divergenceCount}
                  </div>
                  <div className="text-xs text-muted-foreground">divergências</div>
                </div>
              </div>
              <Progress value={Math.min(progressSummary.overallPercentage, 100)} className="h-2" />
            </CardContent>
          </Card>

          {/* Progresso por produto */}
          {productProgress.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Nenhum dado de progresso"
              description="Inicie movimentações vinculadas a esta ordem para ver o progresso de carregamento"
            />
          ) : (
            <div className="space-y-3">
              {productProgress.map((progress) => {
                const percentage = progress.expectedQuantity > 0
                  ? Math.round((progress.loadedQuantity / progress.expectedQuantity) * 100)
                  : 0;
                const isComplete = progress.loadedQuantity >= progress.expectedQuantity && progress.expectedQuantity > 0;
                const isExceeded = progress.loadedQuantity > progress.expectedQuantity;
                const isPending = progress.loadedQuantity === 0;

                return (
                  <Card
                    key={progress.productId}
                    className="border-border/60"
                    data-testid={`product-progress-${progress.productId}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${
                            isExceeded
                              ? "bg-destructive/10 text-destructive"
                              : isComplete
                              ? "bg-chart-4/10 text-chart-4"
                              : isPending
                              ? "bg-muted/50 text-muted-foreground"
                              : "bg-amber-500/10 text-amber-500"
                          }`}>
                            {isExceeded ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : isComplete ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Package className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{progress.productName}</p>
                            <p className="text-xs text-muted-foreground font-mono">SKU: {progress.productSku}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-base font-bold tabular-nums">
                            {progress.loadedQuantity}
                            <span className="text-muted-foreground font-normal text-sm"> / {progress.expectedQuantity}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{progress.productUnit}</div>
                        </div>
                      </div>

                      {isExceeded ? (
                        <div className="w-full bg-muted rounded-full h-2 flex overflow-hidden mb-2">
                          <div className="h-full bg-chart-4 rounded-l-full" style={{ width: `${(progress.expectedQuantity / progress.loadedQuantity) * 100}%` }} />
                          <div className="h-full bg-destructive rounded-r-full" style={{ width: `${((progress.loadedQuantity - progress.expectedQuantity) / progress.loadedQuantity) * 100}%` }} />
                        </div>
                      ) : (
                        <div className="w-full bg-muted rounded-full h-2 mb-2">
                          <div
                            className={`h-full rounded-full ${isComplete ? "bg-chart-4" : percentage >= 50 ? "bg-amber-500" : percentage > 0 ? "bg-destructive" : "bg-muted-foreground/30"}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {isExceeded && (
                            <div className="flex items-center gap-1 text-xs text-destructive">
                              <TrendingUp className="h-3 w-3" />
                              <span>Excedido em {progress.loadedQuantity - progress.expectedQuantity} un</span>
                            </div>
                          )}
                          {isComplete && !isExceeded && (
                            <div className="flex items-center gap-1 text-xs text-chart-4">
                              <CheckCircle className="h-3 w-3" />
                              <span>Completo</span>
                            </div>
                          )}
                          {isPending && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Pendente</span>
                            </div>
                          )}
                          {!isComplete && !isExceeded && !isPending && (
                            <div className="flex items-center gap-1 text-xs text-amber-500">
                              <TrendingDown className="h-3 w-3" />
                              <span>Faltam {progress.expectedQuantity - progress.loadedQuantity} un</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-xs font-medium tabular-nums ${
                          isExceeded ? "text-destructive" : isComplete ? "text-chart-4" : "text-muted-foreground"
                        }`}>
                          {percentage}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── ABA MOVIMENTAÇÕES ── */}
        <TabsContent value="movements" className="mt-5">
          {movements.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Nenhuma movimentação"
              description="Nenhuma movimentação vinculada a esta ordem de carregamento"
            />
          ) : (
            <div className="space-y-0">
              {movements.map((movement, idx) => {
                const movementItems = movementItemsQueries[idx]?.data || [];
                const totalItems = movementItems.reduce((sum, item) => sum + item.quantity, 0);
                const isLast = idx === movements.length - 1;

                return (
                  <div key={movement.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                        movement.status === "completed"
                          ? "bg-chart-4/15 text-chart-4"
                          : movement.status === "in_progress"
                          ? "bg-primary/15 text-primary"
                          : movement.status === "cancelled"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-muted/50 text-muted-foreground"
                      }`}>
                        <Truck className="h-3.5 w-3.5" />
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 bg-border/60 my-1.5 min-h-[16px]" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <Card
                        className="border-border/60 hover-elevate cursor-pointer"
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
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-sm">{movementTypeLabel(movement.type)}</span>
                                <StatusBadge status={movement.status} />
                              </div>
                              {movement.vehiclePlate && (
                                <p className="text-xs text-muted-foreground">
                                  Veículo: <span className="font-mono">{movement.vehiclePlate}</span>
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(movement.createdAt), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 flex items-center gap-2">
                              <div>
                                <div className="text-base font-semibold tabular-nums">{totalItems}</div>
                                <div className="text-xs text-muted-foreground">itens</div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          {movementItems.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-border/40">
                              <div className="flex flex-wrap gap-1">
                                {movementItems.slice(0, 4).map((item, itemIdx) => {
                                  const product = items.find(i => i.productId === item.productId)?.product;
                                  return (
                                    <Badge key={itemIdx} variant="secondary" className="text-xs font-normal">
                                      {product?.name || "Produto"}: {item.quantity}
                                    </Badge>
                                  );
                                })}
                                {movementItems.length > 4 && (
                                  <Badge variant="secondary" className="text-xs font-normal">
                                    +{movementItems.length - 4} mais
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── ABA INFORMAÇÕES ── */}
        <TabsContent value="info" className="mt-5">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="font-semibold text-base flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ClipboardList className="h-3.5 w-3.5" />
                </div>
                Informações da Ordem
              </div>

              <div className="space-y-0">
                {/* Identificação */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 pb-4 border-b border-border/40">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Número da Ordem</div>
                    <div className="text-sm font-medium font-mono">{order.orderNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Status</div>
                    <StatusBadge status={order.status} />
                  </div>
                  {order.event && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Evento</div>
                      <div className="text-sm font-medium">{order.event.name}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Responsável</div>
                    <div className="text-sm font-medium">{order.createdBy || "Não informado"}</div>
                  </div>
                </div>

                {/* Datas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 py-4 border-b border-border/40">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Início planejado</div>
                    <div className="text-sm font-medium" data-testid="text-planned-start">
                      {format(new Date(order.plannedStartTime), "dd 'de' MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Fim planejado</div>
                    <div className="text-sm font-medium" data-testid="text-planned-end">
                      {format(new Date(order.plannedEndTime), "dd 'de' MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                  {order.loadingDate && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Data de carregamento</div>
                      <div className="text-sm font-medium">
                        {format(new Date(order.loadingDate), "dd 'de' MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  )}
                  {order.unloadingDate && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Data de descarregamento</div>
                      <div className="text-sm font-medium">
                        {format(new Date(order.unloadingDate), "dd 'de' MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progresso resumido */}
                <div className="py-4 border-b border-border/40">
                  <div className="text-xs text-muted-foreground mb-2">Progresso de carregamento</div>
                  <div className="flex items-center gap-3">
                    <Progress value={Math.min(progressSummary.overallPercentage, 100)} className="h-2 flex-1" />
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${
                      progressSummary.overallPercentage === 100 ? "text-chart-4" : ""
                    }`}>
                      {progressSummary.overallPercentage}%
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{progressSummary.totalLoaded} de {progressSummary.totalExpected} unidades carregadas</span>
                    {progressSummary.completeCount > 0 && (
                      <span className="text-chart-4">{progressSummary.completeCount} completo(s)</span>
                    )}
                    {progressSummary.divergenceCount > 0 && (
                      <span className="text-destructive">{progressSummary.divergenceCount} com divergência</span>
                    )}
                  </div>
                </div>

                {/* Observações */}
                {order.notes && (
                  <div className="pt-4">
                    <div className="text-xs text-muted-foreground mb-1.5">Observações</div>
                    <p className="text-sm text-foreground leading-relaxed" data-testid="text-notes">
                      {order.notes}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LoadingOrderDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        order={order}
      />
    </div>
  );
}

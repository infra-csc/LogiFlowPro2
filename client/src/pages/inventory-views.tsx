import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/filter-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import {
  Package, MapPin, Activity, Search, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Layers, BarChart3, Clock, Truck,
  AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Product, Movement, LoadingOrder } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = "physical" | "availability" | "allocations" | "movements" | "projections";

interface InventoryFilters {
  search: string;
  location: string;
  category: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStockStatus(p: Product): "ok" | "low" | "critical" | "zero" {
  const stock = p.currentStock ?? 0;
  const min = Number(p.minimumStock ?? 0);
  if (stock === 0) return "zero";
  if (min > 0 && stock <= min * 0.2) return "critical";
  if (min > 0 && stock < min) return "low";
  return "ok";
}

const STOCK_STATUS_STYLE = {
  ok:       { label: "Adequado",     class: "bg-chart-4/15 text-chart-4 border-chart-4/30",       bar: "bg-chart-4"   },
  low:      { label: "Baixo",        class: "bg-amber-500/15 text-amber-500 border-amber-500/30",  bar: "bg-amber-500" },
  critical: { label: "Crítico",      class: "bg-chart-5/15 text-chart-5 border-chart-5/30",       bar: "bg-chart-5"   },
  zero:     { label: "Sem estoque",  class: "bg-destructive/15 text-destructive border-destructive/30", bar: "bg-destructive" },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function InventoryViews() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("physical");
  const [filters, setFilters] = useState<InventoryFilters>({
    search: "", location: "", category: "", status: "",
  });

  const setFilter = (key: keyof InventoryFilters, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const resetFilters = () =>
    setFilters({ search: "", location: "", category: "", status: "" });

  // groupBy driven by tab
  const groupBy =
    activeTab === "physical"      ? "location" :
    activeTab === "availability"  ? "status"   : "product";

  const { data: overview, isLoading: overviewLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory/overview", { ...filters, groupBy }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search)   params.append("search", filters.search);
      if (filters.location) params.append("location", filters.location);
      if (filters.category) params.append("category", filters.category);
      if (filters.status)   params.append("status", filters.status);
      params.append("groupBy", groupBy);
      const res = await fetch(`/api/inventory/overview?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch overview");
      return res.json();
    },
    enabled: ["physical", "availability"].includes(activeTab),
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: activeTab === "projections",
  });

  const { data: movements, isLoading: movementsLoading } = useQuery<Movement[]>({
    queryKey: ["/api/movements"],
    enabled: activeTab === "movements",
  });

  const { data: loadingOrders, isLoading: ordersLoading } = useQuery<LoadingOrder[]>({
    queryKey: ["/api/loading-orders"],
    enabled: activeTab === "allocations",
  });

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.location ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visões de Estoque"
        description="Análise analítica por localização, disponibilidade, alocações, movimentações e projeções"
      />

      {/* Filters */}
      <FilterBar
        badgeCount={activeFilterCount}
        onClear={activeFilterCount > 0 ? resetFilters : undefined}
      >
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Busca</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="SKU, nome..."
              value={filters.search}
              onChange={e => setFilter("search", e.target.value)}
              className="pl-9 h-9 bg-card border-border/60 text-sm"
              data-testid="input-search"
            />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Localização</p>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Galpão A, Em trânsito..."
              value={filters.location}
              onChange={e => setFilter("location", e.target.value)}
              className="pl-9 h-9 bg-card border-border/60 text-sm"
              data-testid="input-location"
            />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Categoria</p>
          <Input
            placeholder="Estrutura, Iluminação..."
            value={filters.category}
            onChange={e => setFilter("category", e.target.value)}
            className="h-9 bg-card border-border/60 text-sm"
            data-testid="input-category"
          />
        </div>
      </FilterBar>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as ActiveTab)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="physical" data-testid="tab-physical">
            <MapPin className="h-3.5 w-3.5 mr-1.5 hidden sm:block" />
            Físico
          </TabsTrigger>
          <TabsTrigger value="availability" data-testid="tab-availability">
            <Activity className="h-3.5 w-3.5 mr-1.5 hidden sm:block" />
            Disponível
          </TabsTrigger>
          <TabsTrigger value="allocations" data-testid="tab-allocations">
            <Layers className="h-3.5 w-3.5 mr-1.5 hidden sm:block" />
            Alocações
          </TabsTrigger>
          <TabsTrigger value="movements" data-testid="tab-movements">
            <Truck className="h-3.5 w-3.5 mr-1.5 hidden sm:block" />
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="projections" data-testid="tab-projections">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5 hidden sm:block" />
            Projeções
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Estoque Físico ── */}
        <TabsContent value="physical" className="mt-6">
          <OverviewGroupList
            data={overview ?? []}
            isLoading={overviewLoading}
            dimension="physical"
            emptyTitle="Nenhum dado de localização"
            emptyDesc="Produtos com localização aparecerão aqui"
          />
        </TabsContent>

        {/* ── Tab 2: Disponibilidade ── */}
        <TabsContent value="availability" className="mt-6">
          <OverviewGroupList
            data={overview ?? []}
            isLoading={overviewLoading}
            dimension="status"
            emptyTitle="Nenhum dado de disponibilidade"
            emptyDesc="Movimentações gerarão dados aqui"
          />
        </TabsContent>

        {/* ── Tab 3: Alocações ── */}
        <TabsContent value="allocations" className="mt-6">
          <AllocationsTab data={loadingOrders} isLoading={ordersLoading} />
        </TabsContent>

        {/* ── Tab 4: Movimentações ── */}
        <TabsContent value="movements" className="mt-6">
          <MovementsTab data={movements} isLoading={movementsLoading} filters={filters} />
        </TabsContent>

        {/* ── Tab 5: Projeções ── */}
        <TabsContent value="projections" className="mt-6">
          <ProjectionsTab data={products} isLoading={productsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Overview group list (tabs 1 & 2) ─────────────────────────────────────────

interface OverviewGroupListProps {
  data: any[];
  isLoading: boolean;
  dimension: string;
  emptyTitle: string;
  emptyDesc: string;
}

function OverviewGroupList({ data, isLoading, emptyTitle, emptyDesc }: OverviewGroupListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title={emptyTitle}
        description={emptyDesc}
      />
    );
  }

  return (
    <div className="space-y-4">
      {data.map((group: any) => (
        <InventoryGroupCard key={group.groupKey} group={group} />
      ))}
    </div>
  );
}

function InventoryGroupCard({ group }: { group: any }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="border-border/60">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="p-0 h-auto hover:bg-transparent"
                data-testid={`group-toggle-${group.groupKey}`}
              >
                <div className="flex items-center gap-2">
                  {expanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-semibold text-base">{group.groupLabel}</span>
                  <span className="text-xs text-muted-foreground">
                    ({group.products?.length ?? 0} produto{group.products?.length !== 1 ? "s" : ""})
                  </span>
                </div>
              </Button>
            </CollapsibleTrigger>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-chart-4" />
                  <span>Entradas: <strong className="text-foreground">{group.totalInbound}</strong></span>
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span>Saídas: <strong className="text-foreground">{group.totalOutbound}</strong></span>
                </span>
              </div>
              <div className="text-right pl-4 border-l border-border/40">
                <p className="text-xl font-bold">{group.totalBalance}</p>
                <p className="text-[10px] text-muted-foreground">Saldo</p>
              </div>
            </div>
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {group.products?.map((product: any) => (
              <ProductOverviewRow key={product.productId} product={product} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ProductOverviewRow({ product }: { product: any }) {
  const [showMov, setShowMov] = useState(false);

  const statusKey: "ok" | "low" | "critical" | "zero" =
    product.balance < 0 ? "zero" :
    product.balance === 0 ? "zero" :
    "ok";

  return (
    <div className="border border-border/60 rounded-md p-3 hover-elevate space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-10 w-10 rounded object-cover flex-shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-base">{product.name}</p>
            {product.category && <Badge variant="outline" className="text-[10px]">{product.category}</Badge>}
            {product.balance < 0 ? (
              <Badge variant="destructive" className="text-[10px]">FALTA</Badge>
            ) : product.balance === 0 ? (
              <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-500 border-amber-500/30">CRÍTICO</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-chart-4/15 text-chart-4 border-chart-4/30">ADEQUADO</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <div className="text-center min-w-[60px]">
            <p className="text-xs text-muted-foreground">Entradas</p>
            <p className="text-base font-semibold text-chart-4">{product.inbound}</p>
          </div>
          <div className="text-center min-w-[60px]">
            <p className="text-xs text-muted-foreground">Saídas</p>
            <p className="text-base font-semibold text-destructive">{product.outbound}</p>
          </div>
          <div className="text-center min-w-[60px]">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="text-xl font-bold">{product.balance}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMov(!showMov)}
            data-testid={`button-show-movements-${product.productId}`}
          >
            {showMov ? "Ocultar" : "Ver"} movimentações
          </Button>
        </div>
      </div>

      {showMov && product.movements && product.movements.length > 0 && (
        <div className="pt-2 border-t border-border/40 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Histórico recente</p>
          {product.movements.slice(0, 8).map((m: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-muted/40">
              <div className="flex items-center gap-2">
                <Badge
                  variant={m.direction === "in" ? "default" : "destructive"}
                  className="text-[10px] no-default-hover-elevate"
                >
                  {m.direction === "in" ? "Entrada" : "Saída"}
                </Badge>
                <span className="text-muted-foreground">
                  {m.date ? format(new Date(m.date), "dd/MM/yy", { locale: ptBR }) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {m.location && <span className="text-muted-foreground">{m.location}</span>}
                <span className="font-medium">{m.quantity} un</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Alocações ──────────────────────────────────────────────────────────

function AllocationsTab({ data, isLoading }: { data?: LoadingOrder[]; isLoading: boolean }) {
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!statusFilter) return data;
    return data.filter(o => o.status === statusFilter);
  }, [data, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Nenhuma ordem de carregamento"
        description="Ordens de carregamento criarão alocações de estoque"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mini filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 w-48 bg-card border-border/60 text-sm" data-testid="select-alloc-status">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="ready">Pronto</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{filtered.length} ordem{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="space-y-3">
        {filtered.map(order => (
          <Card key={order.id} className="border-border/60 hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-base">
                      {(order as any).name || `Ordem #${String(order.id).slice(0, 8)}`}
                    </p>
                    <StatusBadge status={order.status} />
                  </div>
                  {(order as any).eventId && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      Evento vinculado
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Criado</p>
                    <p className="font-medium text-xs">
                      {order.createdAt ? format(new Date(order.createdAt), "dd/MM/yy", { locale: ptBR }) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Tab 4: Movimentações ──────────────────────────────────────────────────────

function MovementsTab({
  data, isLoading, filters,
}: {
  data?: Movement[]; isLoading: boolean; filters: InventoryFilters;
}) {
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter(m => {
      if (statusFilter && m.status !== statusFilter) return false;
      return true;
    });
  }, [data, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="Nenhuma movimentação registrada"
        description="Movimentações de estoque aparecerão aqui"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mini filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 w-48 bg-card border-border/60 text-sm" data-testid="select-mov-status">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="created">Criada</SelectItem>
            <SelectItem value="in_progress">Em progresso</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="paused">Pausada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{filtered.length} movimentaç{filtered.length !== 1 ? "ões" : "ão"}</p>
      </div>

      <div className="space-y-3">
        {filtered.slice(0, 50).map(movement => (
          <Card key={movement.id} className="border-border/60 hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-base">
                      {(movement as any).name || `Movimentação #${String(movement.id).slice(0, 8)}`}
                    </p>
                    <StatusBadge status={movement.status} />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap border-t border-border/40 pt-1 mt-1">
                    {movement.createdAt && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(movement.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </span>
                    )}
                    {(movement as any).movementTypeName && (
                      <span className="text-xs text-muted-foreground">
                        Tipo: {(movement as any).movementTypeName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length > 50 && (
          <p className="text-center text-sm text-muted-foreground py-2">
            Exibindo 50 de {filtered.length} movimentações
          </p>
        )}
      </div>
    </div>
  );
}

// ── Tab 5: Projeções ──────────────────────────────────────────────────────────

function ProjectionsTab({ data, isLoading }: { data?: Product[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-4">
              <Skeleton className="h-5 w-48 mb-3" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem dados para projeção"
        description="Produtos com estoque mínimo configurado gerarão projeções"
      />
    );
  }

  // Compute groups
  const byStatus = {
    ok:       data.filter(p => getStockStatus(p) === "ok"),
    low:      data.filter(p => getStockStatus(p) === "low"),
    critical: data.filter(p => getStockStatus(p) === "critical"),
    zero:     data.filter(p => getStockStatus(p) === "zero"),
  };

  const total = data.length;

  const groups = [
    { key: "ok"       as const, icon: CheckCircle2, color: "text-chart-4",   bg: "bg-chart-4"   },
    { key: "low"      as const, icon: TrendingDown,  color: "text-amber-500", bg: "bg-amber-500" },
    { key: "critical" as const, icon: AlertTriangle, color: "text-chart-5",   bg: "bg-chart-5"   },
    { key: "zero"     as const, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive" },
  ];

  return (
    <div className="space-y-6">
      {/* Saúde geral */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <p className="font-semibold text-base">Saúde do Estoque</p>
            <p className="text-xs text-muted-foreground ml-auto">{total} produtos</p>
          </div>

          {/* Summary bar */}
          <div className="space-y-2">
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              {groups.map(g => {
                const pct = total > 0 ? (byStatus[g.key].length / total) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={g.key}
                    className={cn("h-full transition-all", g.bg)}
                    style={{ width: `${pct}%` }}
                    title={`${STOCK_STATUS_STYLE[g.key].label}: ${byStatus[g.key].length}`}
                  />
                );
              })}
            </div>
            <div className="flex gap-4 flex-wrap">
              {groups.map(g => (
                <div key={g.key} className="flex items-center gap-1.5 text-xs">
                  <div className={cn("h-2 w-2 rounded-full", g.bg)} />
                  <span className="text-muted-foreground">{STOCK_STATUS_STYLE[g.key].label}</span>
                  <span className={cn("font-semibold", g.color)}>{byStatus[g.key].length}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Health score */}
          {(() => {
            const score = total > 0
              ? Math.round(((byStatus.ok.length * 1 + byStatus.low.length * 0.5) / total) * 100)
              : 0;
            const label =
              score >= 80 ? "Excelente" :
              score >= 60 ? "Boa" :
              score >= 40 ? "Atenção" : "Crítica";
            const color =
              score >= 80 ? "text-chart-4" :
              score >= 60 ? "text-primary" :
              score >= 40 ? "text-amber-500" : "text-destructive";
            return (
              <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                <p className="text-xs text-muted-foreground">Índice de saúde:</p>
                <p className={cn("text-2xl font-bold", color)}>{score}%</p>
                <Badge variant="outline" className={cn("text-[10px]", color.replace("text-", "border-").replace("text-", "bg-") + "/10")}>
                  {label}
                </Badge>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Items needing attention */}
      {(byStatus.zero.length > 0 || byStatus.critical.length > 0) && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="font-semibold text-base">Itens que Precisam de Ação</p>
            </div>
            {[...byStatus.zero, ...byStatus.critical].slice(0, 10).map(p => {
              const s = getStockStatus(p);
              const cfg = STOCK_STATUS_STYLE[s];
              const stock = p.currentStock ?? 0;
              const min = Number(p.minimumStock ?? 0);
              return (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-md bg-background/60">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Atual / Mínimo</p>
                    <p className="text-sm font-semibold">
                      <span className={cfg.label === "Sem estoque" || cfg.label === "Crítico" ? "text-destructive" : "text-amber-500"}>
                        {stock}
                      </span>
                      {min > 0 && <span className="text-muted-foreground"> / {min}</span>}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] flex-shrink-0 no-default-hover-elevate", cfg.class)}>
                    {cfg.label}
                  </Badge>
                </div>
              );
            })}
            {(byStatus.zero.length + byStatus.critical.length) > 10 && (
              <p className="text-xs text-center text-muted-foreground">
                +{(byStatus.zero.length + byStatus.critical.length) - 10} itens adicionais
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Products with minimumStock — full list */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <p className="font-semibold text-base">Todos os Produtos — Status Atual</p>
          {data
            .sort((a, b) => {
              const order = { zero: 0, critical: 1, low: 2, ok: 3 };
              return order[getStockStatus(a)] - order[getStockStatus(b)];
            })
            .map(p => {
              const s = getStockStatus(p);
              const cfg = STOCK_STATUS_STYLE[s];
              const stock = p.currentStock ?? 0;
              const min = Number(p.minimumStock ?? 0);
              const barPct = min > 0
                ? Math.min((stock / (min * 1.5)) * 100, 100)
                : stock > 0 ? 75 : 0;

              return (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", cfg.bar)} />
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.category && (
                        <Badge variant="outline" className="text-[10px] hidden sm:inline-flex no-default-hover-elevate">
                          {p.category}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-semibold">{stock} {p.unit || "un"}</span>
                      {min > 0 && <span className="text-xs text-muted-foreground hidden sm:inline">mín: {min}</span>}
                    </div>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", cfg.bar)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}

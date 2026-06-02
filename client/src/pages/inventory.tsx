import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package, TrendingDown, Warehouse, AlertTriangle,
  CheckCircle2, Search, MapPin, Package2, ShieldOff, XCircle,
} from "lucide-react";
import type { Product } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

// ── Types ────────────────────────────────────────────────────────────────────

type StockStatus = "all" | "ok" | "low" | "critical" | "zero";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStockStatus(product: Product): "ok" | "low" | "critical" | "zero" {
  const stock = product.currentStock ?? 0;
  const min = Number(product.minimumStock ?? 0);
  if (stock === 0) return "zero";
  if (min > 0 && stock <= min * 0.2) return "critical";
  if (min > 0 && stock < min) return "low";
  return "ok";
}

const STATUS_CONFIG: Record<
  "ok" | "low" | "critical" | "zero",
  { label: string; badgeClass: string; barClass: string; dotClass: string }
> = {
  ok: {
    label: "Adequado",
    badgeClass: "bg-chart-4/15 text-chart-4 border-chart-4/30",
    barClass: "bg-chart-4",
    dotClass: "bg-chart-4",
  },
  low: {
    label: "Estoque Baixo",
    badgeClass: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    barClass: "bg-amber-500",
    dotClass: "bg-amber-500",
  },
  critical: {
    label: "Crítico",
    badgeClass: "bg-chart-5/15 text-chart-5 border-chart-5/30",
    barClass: "bg-chart-5",
    dotClass: "bg-chart-5",
  },
  zero: {
    label: "Sem Estoque",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
    barClass: "bg-destructive",
    dotClass: "bg-destructive",
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function Inventory() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<StockStatus>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    if (!products) return null;
    const statuses = products.map(getStockStatus);
    const ok       = statuses.filter(s => s === "ok").length;
    const low      = statuses.filter(s => s === "low").length;
    const critical = statuses.filter(s => s === "critical").length;
    const zero     = statuses.filter(s => s === "zero").length;
    const totalUnits = products.reduce((sum, p) => sum + (p.currentStock ?? 0), 0);
    return { total: products.length, ok, low, critical, zero, totalUnits };
  }, [products]);

  // ── Categories ────────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort() as string[];
  }, [products]);

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      if (statusFilter === "critical") {
        // "critical" KPI card shows critical+zero together
        if (getStockStatus(p) !== "critical" && getStockStatus(p) !== "zero") return false;
      } else if (statusFilter !== "all" && getStockStatus(p) !== statusFilter) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      }
      if (categoryFilter && p.category !== categoryFilter) return false;
      return true;
    });
  }, [products, statusFilter, search, categoryFilter]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (search ? 1 : 0) +
    (categoryFilter ? 1 : 0);

  // ── Sort: zero → critical → low → ok ─────────────────────────────────────

  const sortedProducts = useMemo(() => {
    const order = { zero: 0, critical: 1, low: 2, ok: 3 };
    return [...filteredProducts].sort(
      (a, b) => order[getStockStatus(a)] - order[getStockStatus(b)]
    );
  }, [filteredProducts]);

  if (isLoading) return <PageLoading message="Carregando estoque..." />;

  // ── KPI cards config ──────────────────────────────────────────────────────

  const kpiCards = [
    {
      label: "Total de Produtos",
      value: kpis?.total ?? 0,
      icon: Package2,
      color: "text-primary",
      bg: "bg-primary/10",
      filter: "all" as StockStatus,
      testId: "kpi-total",
    },
    {
      label: "Unidades em Estoque",
      value: kpis?.totalUnits ?? 0,
      icon: Warehouse,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
      filter: "all" as StockStatus,
      testId: "kpi-units",
    },
    {
      label: "Adequados",
      value: kpis?.ok ?? 0,
      icon: CheckCircle2,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
      filter: "ok" as StockStatus,
      testId: "kpi-ok",
    },
    {
      label: "Estoque Baixo",
      value: kpis?.low ?? 0,
      icon: TrendingDown,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      filter: "low" as StockStatus,
      testId: "kpi-low",
    },
    {
      label: "Críticos / Zerados",
      value: (kpis?.critical ?? 0) + (kpis?.zero ?? 0),
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      filter: "critical" as StockStatus,
      testId: "kpi-critical",
    },
  ];

  const hasAlerts = kpis && (kpis.zero > 0 || kpis.critical > 0 || kpis.low > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Estoque"
        description="Monitore níveis, alertas e disponibilidade de materiais"
      />

      {/* ── KPI cards ── */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((kpi) => {
          const isActive = statusFilter === kpi.filter && kpi.filter !== "all";
          return (
            <button
              key={kpi.testId}
              type="button"
              onClick={() =>
                setStatusFilter(prev => (prev === kpi.filter && kpi.filter !== "all") ? "all" : kpi.filter)
              }
              data-testid={kpi.testId}
              className="text-left"
            >
              <Card
                className={cn(
                  "hover-elevate border-border/60 cursor-pointer h-full",
                  isActive && "border-primary/40 ring-1 ring-primary/20"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs text-muted-foreground leading-tight">{kpi.label}</p>
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0", kpi.bg)}>
                      <kpi.icon className={cn("h-3.5 w-3.5", kpi.color)} />
                    </div>
                  </div>
                  <p className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* ── Operational alerts ── */}
      {hasAlerts && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">Alertas Operacionais</span>
            <Badge variant="outline" className="ml-auto text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
              {(kpis?.zero ?? 0) + (kpis?.critical ?? 0) + (kpis?.low ?? 0)} alert{((kpis?.zero ?? 0) + (kpis?.critical ?? 0) + (kpis?.low ?? 0)) !== 1 ? "as" : "a"}
            </Badge>
          </div>
          {kpis!.zero > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              <span>
                <span className="text-destructive font-medium">{kpis!.zero} produto{kpis!.zero > 1 ? "s" : ""}</span>
                <span className="text-muted-foreground"> com estoque zerado — reposição imediata necessária</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs text-muted-foreground px-2"
                onClick={() => setStatusFilter("zero")}
              >
                Ver itens
              </Button>
            </div>
          )}
          {kpis!.critical > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <ShieldOff className="h-3.5 w-3.5 text-chart-5 flex-shrink-0" />
              <span>
                <span className="text-chart-5 font-medium">{kpis!.critical} produto{kpis!.critical > 1 ? "s" : ""}</span>
                <span className="text-muted-foreground"> em nível crítico (abaixo de 20% do mínimo)</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs text-muted-foreground px-2"
                onClick={() => setStatusFilter("critical")}
              >
                Ver itens
              </Button>
            </div>
          )}
          {kpis!.low > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingDown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <span>
                <span className="text-amber-500 font-medium">{kpis!.low} produto{kpis!.low > 1 ? "s" : ""}</span>
                <span className="text-muted-foreground"> abaixo do estoque mínimo configurado</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs text-muted-foreground px-2"
                onClick={() => setStatusFilter("low")}
              >
                Ver itens
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Filters ── */}
      <FilterBar
        badgeCount={activeFilterCount}
        onClear={activeFilterCount > 0 ? () => { setStatusFilter("all"); setSearch(""); setCategoryFilter(""); } : undefined}
      >
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Busca</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 bg-card border-border/60 text-sm"
              data-testid="input-search-inventory"
            />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Status</p>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StockStatus)}>
            <SelectTrigger className="h-9 bg-card border-border/60 text-sm" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ok">Adequado</SelectItem>
              <SelectItem value="low">Estoque Baixo</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="zero">Sem Estoque</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Categoria</p>
          <Select
            value={categoryFilter || "all"}
            onValueChange={v => setCategoryFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-9 bg-card border-border/60 text-sm" data-testid="select-category-filter">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {/* ── Result count ── */}
      {activeFilterCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {sortedProducts.length} produto{sortedProducts.length !== 1 ? "s" : ""} encontrado{sortedProducts.length !== 1 ? "s" : ""}
          {statusFilter !== "all" && (
            <span> com status <strong>{STATUS_CONFIG[statusFilter === "critical" ? "critical" : statusFilter as Exclude<StockStatus, "all" | "critical">]?.label ?? "Crítico/Zerado"}</strong></span>
          )}
        </p>
      )}

      {/* ── Product grid ── */}
      {sortedProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title={!products || products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum resultado"}
          description={
            !products || products.length === 0
              ? "Produtos aparecerão aqui quando cadastrados no sistema"
              : "Tente ajustar os filtros para ver resultados"
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProducts.map(product => {
            const status = getStockStatus(product);
            const cfg = STATUS_CONFIG[status];
            const stock = product.currentStock ?? 0;
            const min = Number(product.minimumStock ?? 0);
            // bar: 0=empty, filled relative to 1.5× minimum (or 100% if no min)
            const barPct = min > 0
              ? Math.min((stock / (min * 1.5)) * 100, 100)
              : stock > 0 ? 75 : 0;

            return (
              <Card
                key={product.id}
                className="hover-elevate border-border/60"
                data-testid={`card-product-${product.id}`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Package className="h-4 w-4 text-primary/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base leading-tight truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("flex-shrink-0 text-[10px] no-default-hover-elevate", cfg.badgeClass)}
                    >
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Stock values */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Atual</p>
                      <p className={cn("text-lg font-bold leading-none", status === "zero" ? "text-destructive" : status === "critical" ? "text-chart-5" : status === "low" ? "text-amber-500" : "text-chart-4")}>
                        {stock}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{product.unit || "un"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Mínimo</p>
                      <p className="text-lg font-bold leading-none text-muted-foreground">{min > 0 ? min : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{product.unit || "un"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Unidade</p>
                      <p className="text-lg font-bold leading-none text-muted-foreground">
                        {product.unit || "un"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">medida</p>
                    </div>
                  </div>

                  {/* Stock bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", cfg.barClass)}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    {min > 0 && (
                      <p className="text-[10px] text-muted-foreground text-right">
                        {stock >= min
                          ? `+${stock - min} acima do mínimo`
                          : `${min - stock} abaixo do mínimo`}
                      </p>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-border/40 text-xs text-muted-foreground">
                    {product.category && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {product.category}
                      </span>
                    )}
                    {product.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {product.location}
                      </span>
                    )}
                    {!product.category && !product.location && (
                      <span className="text-border">Sem categoria ou localização</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-6 text-xs px-2"
                      onClick={() => navigate("/products")}
                      data-testid={`button-view-product-${product.id}`}
                    >
                      Ver produto
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

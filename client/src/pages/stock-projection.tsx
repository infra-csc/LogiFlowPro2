import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Filter,
  Search,
  CalendarRange,
  LayoutGrid,
  ListChecks,
  AlertCircle,
  Truck,
  Package,
  X,
  Info,
  CheckCircle2,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  BarChart3,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import type {
  StockProjectionResult,
  StockProjectionParams,
  ProjectionDayStatus,
  ProjectionDayCell,
  ProjectionProduct,
  ProjectionConflict,
} from "@shared/stock-projection";
import { ProjectionMatrix } from "@/components/stock-projection/projection-matrix";
import { ProjectionDayView } from "@/components/stock-projection/projection-day-view";
import { ProjectionConflicts } from "@/components/stock-projection/projection-conflicts";
import { ProjectionMovements } from "@/components/stock-projection/projection-movements";
import { ProjectionByProduct } from "@/components/stock-projection/projection-by-product";
import {
  ProjectionDetailDrawer,
  type DetailTarget,
} from "@/components/stock-projection/projection-detail-drawer";
import { KPI_TOOLTIPS } from "@/components/stock-projection/projection-utils";

// ─── helpers ──────────────────────────────────────────────────────────────────

const SOURCE_SHORT: Record<keyof SourceFlags, string> = {
  loadingOrders: "Ordens",
  requests: "Requisições",
  movements: "Movimentações",
  trips: "Viagens",
};

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function daysBetween(start: string, end: string): number {
  const ms =
    new Date(end + "T12:00:00Z").getTime() -
    new Date(start + "T12:00:00Z").getTime();
  return Math.round(ms / 86400000) + 1;
}

type KpiAccent = "primary" | "destructive" | "warn" | "success" | "neutral";

const ACCENT: Record<
  KpiAccent,
  { border: string; bg: string; icon: string; value: string; ring: string }
> = {
  primary: {
    border: "border-primary/40",
    bg: "bg-primary/10",
    icon: "text-primary",
    value: "text-foreground",
    ring: "ring-primary/40",
  },
  destructive: {
    border: "border-destructive/40",
    bg: "bg-destructive/10",
    icon: "text-destructive",
    value: "text-destructive",
    ring: "ring-destructive/50",
  },
  warn: {
    border: "border-chart-5/40",
    bg: "bg-chart-5/10",
    icon: "text-chart-5",
    value: "text-chart-5",
    ring: "ring-chart-5/50",
  },
  success: {
    border: "border-chart-4/40",
    bg: "bg-chart-4/10",
    icon: "text-chart-4",
    value: "text-chart-4",
    ring: "ring-chart-4/50",
  },
  neutral: {
    border: "border-border/60",
    bg: "bg-muted",
    icon: "text-muted-foreground",
    value: "text-foreground",
    ring: "ring-primary/40",
  },
};

function KpiCard({
  icon: Icon,
  value,
  label,
  tooltip,
  accent,
  active,
  onClick,
  testId,
}: {
  icon: typeof Package;
  value: number;
  label: string;
  tooltip: string;
  accent: KpiAccent;
  active?: boolean;
  onClick?: () => void;
  testId: string;
}) {
  const a = ACCENT[accent];
  const inner = (
    <Card
      className={`${a.border} h-full ${onClick ? "hover-elevate" : ""} ${active ? `ring-1 ${a.ring}` : ""}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0 ${a.bg}`}
          >
            <Icon className={`w-4 h-4 ${a.icon}`} />
          </span>
          <div className="min-w-0">
            <div
              className={`text-xl font-bold tabular-nums leading-none ${a.value}`}
            >
              {value}
            </div>
            <div className="text-xs text-muted-foreground mt-1 truncate">
              {label}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  const trigger = onClick ? (
    <button onClick={onClick} className="text-left w-full" data-testid={testId}>
      {inner}
    </button>
  ) : (
    <div data-testid={testId}>{inner}</div>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ─── Context bar ──────────────────────────────────────────────────────────────

function ContextBar({
  result,
  isGenerating,
  onOpenFilters,
  onRefresh,
}: {
  result: StockProjectionResult;
  isGenerating: boolean;
  onOpenFilters: () => void;
  onRefresh: () => void;
}) {
  const f = result.filters;
  const days = daysBetween(f.startDate, f.endDate);
  const inc = f.include ?? {};
  const sourceCount = [
    inc.loadingOrders,
    inc.requests,
    inc.movements,
    inc.trips,
  ].filter(Boolean).length;
  const eventCount = f.eventIds?.length ?? 0;
  const productCount = f.productIds?.length ?? 0;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-4 py-3"
      data-testid="context-bar"
    >
      <CalendarRange className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm font-medium">
        {fmtDate(f.startDate)} – {fmtDate(f.endDate)}
      </span>
      <Badge variant="secondary" className="text-xs">
        {days} {days === 1 ? "dia" : "dias"}
      </Badge>
      <Badge variant="secondary" className="text-xs">
        {sourceCount === 4 ? "Todas as fontes" : `${sourceCount} fonte(s)`}
      </Badge>
      {eventCount > 0 ? (
        <Badge variant="secondary" className="text-xs">
          {eventCount} evento(s)
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="text-xs text-muted-foreground border-dashed"
        >
          Todos os eventos
        </Badge>
      )}
      {productCount > 0 ? (
        <Badge variant="secondary" className="text-xs">
          {productCount} produto(s)
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="text-xs text-muted-foreground border-dashed"
        >
          Todos os produtos
        </Badge>
      )}
      {f.onlyShortages && (
        <Badge variant="secondary" className="text-xs">
          Apenas em falta
        </Badge>
      )}
      {f.onlyImpacted && (
        <Badge variant="secondary" className="text-xs">
          Apenas impactados
        </Badge>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenFilters}
          data-testid="button-context-filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
          Alterar filtros
        </Button>
        <Button
          size="sm"
          onClick={onRefresh}
          disabled={isGenerating}
          data-testid="button-context-refresh"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1.5 ${isGenerating ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </div>
    </div>
  );
}

// ─── Rich empty state ─────────────────────────────────────────────────────────

function RichEmptyState({
  onGenerate,
  isGenerating,
  onOpenFilters,
}: {
  onGenerate: () => void;
  isGenerating: boolean;
  onOpenFilters: () => void;
}) {
  const cards = [
    {
      icon: ArrowUpRight,
      label: "Saídas previstas",
      desc: "Material comprometido em requisições e ordens de carregamento",
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      icon: ArrowDownLeft,
      label: "Entradas e retornos",
      desc: "Devoluções programadas e reposições de estoque",
      color: "text-chart-4",
      bg: "bg-chart-4/10",
    },
    {
      icon: Lock,
      label: "Reservas",
      desc: "Material alocado aguardando expedição",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: AlertTriangle,
      label: "Conflitos e alertas",
      desc: "Dias com saldo negativo e dados incompletos",
      color: "text-chart-5",
      bg: "bg-chart-5/10",
    },
  ];

  return (
    <div
      className="flex flex-col items-center gap-8 py-12"
      data-testid="empty-state-rich"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
        <BarChart3 className="w-8 h-8 text-primary" />
      </div>

      <div className="text-center max-w-lg">
        <h2 className="text-xl font-semibold mb-2">
          Pronto para simular o estoque
        </h2>
        <p className="text-sm text-muted-foreground">
          A projeção considera requisições aprovadas, ordens de carregamento,
          movimentações e planos de viagem para calcular o saldo disponível dia
          a dia.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
        {cards.map((item) => (
          <Card key={item.label} className="border-border/60">
            <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
              <span
                className={`flex items-center justify-center w-9 h-9 rounded-md ${item.bg}`}
              >
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </span>
              <div>
                <div className="text-sm font-medium leading-tight">
                  {item.label}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {item.desc}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          size="lg"
          data-testid="button-generate-empty"
        >
          <Zap className="w-4 h-4 mr-2" />
          {isGenerating ? "Gerando..." : "Gerar projeção dos próximos 30 dias"}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onOpenFilters}
          data-testid="button-filters-empty"
        >
          <Filter className="w-4 h-4 mr-2" />
          Personalizar filtros
        </Button>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceFlags {
  loadingOrders: boolean;
  requests: boolean;
  movements: boolean;
  trips: boolean;
}

type StatusFilter = ProjectionDayStatus | null;

const DEFAULT_START = format(new Date(), "yyyy-MM-dd");
const DEFAULT_END = format(
  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  "yyyy-MM-dd",
);

const DEFAULT_SOURCES: SourceFlags = {
  loadingOrders: true,
  requests: true,
  movements: true,
  trips: false,
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function StockProjection() {
  // filter state (edited in the drawer)
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(DEFAULT_END);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [sources, setSources] = useState<SourceFlags>(DEFAULT_SOURCES);
  const [onlyShortages, setOnlyShortages] = useState(false);
  const [onlyImpacted, setOnlyImpacted] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  // UI state
  const [result, setResult] = useState<StockProjectionResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEverGenerated, setHasEverGenerated] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [activeTab, setActiveTab] = useState("matrix");
  const [focusProductId, setFocusProductId] = useState<string | undefined>(
    undefined,
  );
  const [detail, setDetail] = useState<DetailTarget | null>(null);

  const { data: events } = useQuery<any[]>({ queryKey: ["/api/events"] });
  const { data: products } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const dateError = !!(startDate && endDate && startDate > endDate);
  const anySource =
    sources.loadingOrders ||
    sources.requests ||
    sources.movements ||
    sources.trips;
  const canGenerate = !dateError && !!startDate && !!endDate && anySource;

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!eventSearch.trim()) return events;
    const q = eventSearch.toLowerCase();
    return events.filter(
      (e: any) =>
        e.name?.toLowerCase().includes(q) ||
        e.client?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q),
    );
  }, [events, eventSearch]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p: any) =>
        p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q),
    );
  }, [products, productSearch]);

  const displayResult = useMemo(() => {
    if (!result) return null;
    if (!statusFilter) return result;
    return {
      ...result,
      products: result.products.filter((p) => p.worstStatus === statusFilter),
    };
  }, [result, statusFilter]);

  const incompleteWarnings = useMemo(
    () => (result ? result.conflicts.filter((c) => c.kind === "missing_data") : []),
    [result],
  );

  async function handleGenerate() {
    if (!canGenerate) return;
    try {
      setIsGenerating(true);
      setError(null);
      const payload: StockProjectionParams = {
        startDate,
        endDate,
        eventIds: selectedEventIds,
        productIds: selectedProductIds,
        include: {
          loadingOrders: sources.loadingOrders,
          requests: sources.requests,
          movements: sources.movements,
          trips: sources.trips,
        },
        onlyShortages,
        onlyImpacted,
      };
      const response = await apiRequest(
        "POST",
        "/api/reports/stock-projection",
        payload,
      );
      const data = (await response.json()) as StockProjectionResult;
      setResult(data);
      setHasEverGenerated(true);
      setStatusFilter(null);
      setFocusProductId(undefined);
    } catch (err: any) {
      setError(err?.message || "Erro ao gerar projeção");
    } finally {
      setIsGenerating(false);
    }
  }

  // Auto-generate on mount with default filters
  useEffect(() => {
    handleGenerate(); // eslint-disable-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleApplyFilters() {
    setFiltersOpen(false);
    handleGenerate();
  }

  function handleClearAllFilters() {
    setStartDate(DEFAULT_START);
    setEndDate(DEFAULT_END);
    setSelectedEventIds([]);
    setSelectedProductIds([]);
    setSources(DEFAULT_SOURCES);
    setOnlyShortages(false);
    setOnlyImpacted(false);
    setEventSearch("");
    setProductSearch("");
  }

  function handleClear() {
    handleClearAllFilters();
    setResult(null);
    setError(null);
    setStatusFilter(null);
    setFocusProductId(undefined);
    setActiveTab("matrix");
    setHasEverGenerated(false);
  }

  const toggleEvent = (id: string) =>
    setSelectedEventIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  const toggleProduct = (id: string) =>
    setSelectedProductIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  const toggleStatusFilter = (s: ProjectionDayStatus) =>
    setStatusFilter((prev) => (prev === s ? null : s));

  const openProduct = (id: string) => {
    setFocusProductId(id);
    setActiveTab("by-product");
    setDetail(null);
  };
  const handleSelectDay = () => setActiveTab("day");
  const openCellDetail = (product: ProjectionProduct, cell: ProjectionDayCell) =>
    setDetail({ kind: "cell", product, cell });
  const openProductDetail = (product: ProjectionProduct) =>
    setDetail({ kind: "product", product });
  const openConflictDetail = (conflict: ProjectionConflict) =>
    setDetail({ kind: "conflict", conflict });

  // Date shortcuts
  const dateShortcuts = [
    { label: "7 dias", days: 7 },
    { label: "15 dias", days: 15 },
    { label: "30 dias", days: 30 },
    { label: "60 dias", days: 60 },
  ];

  function applyShortcut(days: number) {
    const s = format(new Date(), "yyyy-MM-dd");
    const e = format(new Date(Date.now() + days * 86400000), "yyyy-MM-dd");
    setStartDate(s);
    setEndDate(e);
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <PageHeader
        title="Projeção de Estoque"
        description="Saldo projetado dia a dia considerando requisições, ordens, movimentações e viagens."
      >
        {result && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            data-testid="button-clear-projection"
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Limpar
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen(true)}
          data-testid="button-open-filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
          Filtros avançados
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          size="sm"
          data-testid="button-generate"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1.5 ${isGenerating ? "animate-spin" : ""}`}
          />
          {isGenerating
            ? "Gerando..."
            : hasEverGenerated
              ? "Atualizar projeção"
              : "Gerar projeção"}
        </Button>
      </PageHeader>

      {/* ── Context bar (after first generation) ── */}
      {result && (
        <ContextBar
          result={result}
          isGenerating={isGenerating}
          onOpenFilters={() => setFiltersOpen(true)}
          onRefresh={handleGenerate}
        />
      )}

      {/* ── Error ── */}
      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* ── Loading (initial, no result yet) ── */}
      {isGenerating && !result && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Calculando projeção de estoque...
          </p>
        </div>
      )}

      {/* ── Rich empty state ── */}
      {!result && !isGenerating && (
        <RichEmptyState
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      )}

      {/* ── Results ── */}
      {result && (
        <>
          {/* KPIs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Resumo da Projeção
              </h2>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Clique num card de status para filtrar a análise
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <KpiCard
                icon={Package}
                value={result.summary.totalProducts}
                label="Produtos"
                tooltip={KPI_TOOLTIPS.totalProducts}
                accent="primary"
                active={statusFilter === null}
                onClick={() => setStatusFilter(null)}
                testId="kpi-total"
              />
              <KpiCard
                icon={AlertTriangle}
                value={result.summary.productsShortage}
                label="Em falta"
                tooltip={KPI_TOOLTIPS.productsShortage}
                accent="destructive"
                active={statusFilter === "shortage"}
                onClick={() => toggleStatusFilter("shortage")}
                testId="kpi-shortage"
              />
              <KpiCard
                icon={TrendingDown}
                value={result.summary.productsLow}
                label="Abaixo do mín."
                tooltip={KPI_TOOLTIPS.productsLow}
                accent="warn"
                active={statusFilter === "low"}
                onClick={() => toggleStatusFilter("low")}
                testId="kpi-low"
              />
              <KpiCard
                icon={CheckCircle2}
                value={result.summary.productsOk}
                label="Adequados"
                tooltip={KPI_TOOLTIPS.productsOk}
                accent="success"
                active={statusFilter === "ok"}
                onClick={() => toggleStatusFilter("ok")}
                testId="kpi-ok"
              />
              <KpiCard
                icon={ArrowUpRight}
                value={result.summary.totalOutbound}
                label="Total saídas"
                tooltip={KPI_TOOLTIPS.totalOutbound}
                accent="destructive"
                testId="kpi-outbound"
              />
              <KpiCard
                icon={ArrowDownLeft}
                value={result.summary.totalInbound}
                label="Total entradas"
                tooltip={KPI_TOOLTIPS.totalInbound}
                accent="success"
                testId="kpi-inbound"
              />
              <KpiCard
                icon={Lock}
                value={result.summary.totalReserved}
                label="Pico reservado"
                tooltip={KPI_TOOLTIPS.totalReserved}
                accent="neutral"
                testId="kpi-reserved"
              />
              <KpiCard
                icon={MapPin}
                value={result.summary.totalInEvent}
                label="Pico em evento"
                tooltip={KPI_TOOLTIPS.totalInEvent}
                accent="neutral"
                testId="kpi-inevent"
              />
            </div>
          </div>

          {/* Incomplete data alert */}
          {incompleteWarnings.length > 0 && (
            <Card className="border-chart-5/40">
              <CardContent className="p-4">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-chart-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-chart-5">
                    Dados incompletos encontrados ({incompleteWarnings.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {incompleteWarnings.slice(0, 3).map((c, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      • {c.message}
                    </p>
                  ))}
                </div>
                {incompleteWarnings.length > 3 && (
                  <button
                    className="mt-2 text-xs text-primary hover-elevate rounded"
                    onClick={() => setActiveTab("conflicts")}
                    data-testid="button-see-all-incomplete"
                  >
                    Ver todos no painel de Conflitos →
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {/* System warnings */}
          {result.warnings.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {result.warnings.map((w, i) => (
                      <p
                        key={i}
                        className="text-xs text-muted-foreground"
                        data-testid={`warning-${i}`}
                      >
                        {w}
                      </p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status filter chip */}
          {statusFilter && (
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="text-xs gap-1"
                data-testid="chip-status-filter"
              >
                {statusFilter === "shortage"
                  ? "Em falta"
                  : statusFilter === "low"
                    ? "Abaixo do mínimo"
                    : "Adequados"}
                <button
                  onClick={() => setStatusFilter(null)}
                  className="hover-elevate rounded-sm"
                  data-testid="button-clear-status-filter"
                  aria-label="Limpar filtro de status"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
              <span className="text-xs text-muted-foreground">
                Aplica-se à Matriz, Visão por Dia e Por Produto.
              </span>
            </div>
          )}

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="matrix" data-testid="tab-matrix">
                <LayoutGrid className="w-4 h-4 mr-1.5" />
                Matriz por Dia
              </TabsTrigger>
              <TabsTrigger value="day" data-testid="tab-day">
                <ListChecks className="w-4 h-4 mr-1.5" />
                Visão por Dia
              </TabsTrigger>
              <TabsTrigger value="by-product" data-testid="tab-by-product">
                <Package className="w-4 h-4 mr-1.5" />
                Por Produto
              </TabsTrigger>
              <TabsTrigger value="conflicts" data-testid="tab-conflicts">
                <AlertCircle className="w-4 h-4 mr-1.5" />
                Conflitos
                {result.conflicts.length > 0 && (
                  <span className="ml-1.5 text-xs rounded-full bg-destructive/15 text-destructive px-1.5">
                    {result.conflicts.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="movements" data-testid="tab-movements">
                <Truck className="w-4 h-4 mr-1.5" />
                O que entra no cálculo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matrix" className="mt-4">
              <ProjectionMatrix
                result={displayResult!}
                onOpenCell={openCellDetail}
                onOpenProduct={openProductDetail}
                onSelectDay={handleSelectDay}
              />
            </TabsContent>
            <TabsContent value="day" className="mt-4">
              <ProjectionDayView
                result={displayResult!}
                onSelectProduct={openProduct}
              />
            </TabsContent>
            <TabsContent value="by-product" className="mt-4">
              <ProjectionByProduct
                result={displayResult!}
                selectedProductId={focusProductId}
                onSelectProduct={setFocusProductId}
              />
            </TabsContent>
            <TabsContent value="conflicts" className="mt-4">
              <ProjectionConflicts
                result={result}
                onOpenDetail={openConflictDetail}
              />
            </TabsContent>
            <TabsContent value="movements" className="mt-4">
              <ProjectionMovements result={result} />
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground">
            {result.calculationBase} Gerado em{" "}
            {new Date(result.generatedAt).toLocaleString("pt-BR")}.
          </p>
        </>
      )}

      {/* ── Advanced Filters Sheet ── */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          className="w-full sm:max-w-md flex flex-col"
          data-testid="filters-sheet"
        >
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Filtros Avançados
            </SheetTitle>
            <SheetDescription>
              Defina o período, as fontes e os itens da projeção
            </SheetDescription>
          </SheetHeader>

          <div
            className="flex-1 overflow-y-auto py-4 space-y-5 projection-scroll"
            style={{ scrollbarWidth: "thin" }}
          >
            {/* Seção 1 — Período */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-primary/70" />
                Período
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-start">Data início</Label>
                  <Input
                    id="filter-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={dateError ? "border-destructive" : ""}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-end">Data fim</Label>
                  <Input
                    id="filter-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={dateError ? "border-destructive" : ""}
                    data-testid="input-end-date"
                  />
                </div>
              </div>
              {dateError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  Data de início deve ser anterior à data fim
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {dateShortcuts.map(({ label, days }) => {
                  const s = format(new Date(), "yyyy-MM-dd");
                  const e = format(
                    new Date(Date.now() + days * 86400000),
                    "yyyy-MM-dd",
                  );
                  const isActive = startDate === s && endDate === e;
                  return (
                    <Button
                      key={label}
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      className="h-7 text-xs px-2.5"
                      onClick={() => applyShortcut(days)}
                      data-testid={`shortcut-${days}`}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Período máximo de 90 dias.
              </p>
            </section>

            <Separator />

            {/* Seção 2 — Fontes */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary/70" />
                O que entra no cálculo
                {!anySource && (
                  <span className="text-xs text-destructive font-normal">
                    (selecione ao menos 1)
                  </span>
                )}
              </h3>
              <div className="space-y-0.5">
                {(
                  [
                    {
                      key: "loadingOrders" as const,
                      label: "Ordens de carregamento",
                      id: "src-loading",
                    },
                    {
                      key: "requests" as const,
                      label: "Requisições aprovadas",
                      id: "src-requests",
                    },
                    {
                      key: "movements" as const,
                      label: "Movimentações",
                      id: "src-movements",
                    },
                    {
                      key: "trips" as const,
                      label: "Planos de Viagens avulsos",
                      id: "src-trips",
                    },
                  ] as const
                ).map((s) => (
                  <label
                    key={s.key}
                    htmlFor={s.id}
                    className="flex items-center gap-2.5 rounded px-2 py-2 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      id={s.id}
                      checked={sources[s.key]}
                      onCheckedChange={(v) =>
                        setSources((prev) => ({ ...prev, [s.key]: !!v }))
                      }
                      data-testid={`checkbox-source-${s.key}`}
                    />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <Separator />

            {/* Seção 3 — Eventos */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Eventos
                  {selectedEventIds.length > 0 && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({selectedEventIds.length})
                    </span>
                  )}
                </h3>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() =>
                      setSelectedEventIds(
                        (events || []).map((e: any) => e.id),
                      )
                    }
                    data-testid="button-select-all-events"
                  >
                    Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setSelectedEventIds([])}
                    disabled={selectedEventIds.length === 0}
                    data-testid="button-clear-events"
                  >
                    Limpar
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Sem seleção: analisaremos todos os eventos do período.
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar evento..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  data-testid="input-event-search"
                />
              </div>
              <div
                className="border border-border/60 rounded-md p-2 max-h-48 overflow-y-auto space-y-0.5 projection-scroll"
                style={{ scrollbarWidth: "thin" }}
              >
                {filteredEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {!events?.length
                      ? "Nenhum evento disponível"
                      : "Nenhum resultado"}
                  </p>
                ) : (
                  filteredEvents.map((event: any) => (
                    <label
                      key={event.id}
                      htmlFor={`ev-${event.id}`}
                      className={`flex items-start gap-2.5 rounded px-2 py-1.5 cursor-pointer transition-colors ${
                        selectedEventIds.includes(event.id)
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        id={`ev-${event.id}`}
                        checked={selectedEventIds.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                        className="mt-0.5"
                        data-testid={`checkbox-event-${event.id}`}
                      />
                      <div className="min-w-0">
                        <div className="text-sm leading-tight truncate">
                          {event.name}
                        </div>
                        {event.eventDate && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(event.eventDate).toLocaleDateString(
                              "pt-BR",
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </section>

            <Separator />

            {/* Seção 4 — Produtos */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Produtos
                  {selectedProductIds.length > 0 && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({selectedProductIds.length})
                    </span>
                  )}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => setSelectedProductIds([])}
                  disabled={selectedProductIds.length === 0}
                  data-testid="button-clear-products"
                >
                  Limpar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sem seleção: analisaremos todos os produtos impactados no
                período.
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  data-testid="input-product-search"
                />
              </div>
              <div
                className="border border-border/60 rounded-md p-2 max-h-48 overflow-y-auto space-y-0.5 projection-scroll"
                style={{ scrollbarWidth: "thin" }}
              >
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {!products?.length
                      ? "Nenhum produto disponível"
                      : "Nenhum resultado"}
                  </p>
                ) : (
                  filteredProducts.slice(0, 200).map((product: any) => (
                    <label
                      key={product.id}
                      htmlFor={`pr-${product.id}`}
                      className={`flex items-start gap-2.5 rounded px-2 py-1.5 cursor-pointer transition-colors ${
                        selectedProductIds.includes(product.id)
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        id={`pr-${product.id}`}
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={() => toggleProduct(product.id)}
                        className="mt-0.5"
                        data-testid={`checkbox-product-${product.id}`}
                      />
                      <div className="min-w-0">
                        <div className="text-sm leading-tight truncate">
                          {product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {product.sku}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </section>

            <Separator />

            {/* Seção 5 — Opções */}
            <section className="space-y-1">
              <h3 className="text-sm font-semibold mb-2">Exibição</h3>
              <label
                htmlFor="only-shortages"
                className="flex items-center gap-2.5 rounded px-1 py-2 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  id="only-shortages"
                  checked={onlyShortages}
                  onCheckedChange={(v) => setOnlyShortages(!!v)}
                  data-testid="checkbox-only-shortages"
                />
                <span className="text-sm">Mostrar apenas produtos em falta</span>
              </label>
              <label
                htmlFor="only-impacted"
                className="flex items-center gap-2.5 rounded px-1 py-2 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  id="only-impacted"
                  checked={onlyImpacted}
                  onCheckedChange={(v) => setOnlyImpacted(!!v)}
                  data-testid="checkbox-only-impacted"
                />
                <span className="text-sm">
                  Mostrar apenas produtos impactados
                </span>
              </label>
            </section>
          </div>

          <SheetFooter className="flex-shrink-0 flex gap-2 border-t border-border/60 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClearAllFilters}
              data-testid="button-clear-filters"
            >
              Limpar filtros
            </Button>
            <Button
              className="flex-1"
              onClick={handleApplyFilters}
              disabled={!canGenerate || isGenerating}
              data-testid="button-apply-filters"
            >
              {isGenerating ? "Gerando..." : "Aplicar filtros"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ProjectionDetailDrawer
        target={detail}
        onClose={() => setDetail(null)}
        onGoToProduct={openProduct}
      />
    </div>
  );
}

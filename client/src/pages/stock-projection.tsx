import { useState, useMemo } from "react";
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
  ChevronLeft,
  Info,
  CheckCircle2,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
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

const SOURCE_SHORT: Record<keyof SourceFlags, string> = {
  loadingOrders: "Ordens",
  requests: "Requisições",
  movements: "Movimentações",
  trips: "Viagens",
};

function fmtChipDate(d: string): string {
  const parts = d.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
}

type KpiAccent = "primary" | "destructive" | "warn" | "success" | "neutral";

const ACCENT: Record<KpiAccent, { border: string; bg: string; icon: string; value: string; ring: string }> = {
  primary: { border: "border-primary/40", bg: "bg-primary/10", icon: "text-primary", value: "text-foreground", ring: "ring-primary/40" },
  destructive: { border: "border-destructive/40", bg: "bg-destructive/10", icon: "text-destructive", value: "text-destructive", ring: "ring-destructive/50" },
  warn: { border: "border-chart-5/40", bg: "bg-chart-5/10", icon: "text-chart-5", value: "text-chart-5", ring: "ring-chart-5/50" },
  success: { border: "border-chart-4/40", bg: "bg-chart-4/10", icon: "text-chart-4", value: "text-chart-4", ring: "ring-chart-4/50" },
  neutral: { border: "border-border/60", bg: "bg-muted", icon: "text-muted-foreground", value: "text-foreground", ring: "ring-primary/40" },
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
    <Card className={`${a.border} h-full ${onClick ? "hover-elevate" : ""} ${active ? `ring-1 ${a.ring}` : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0 ${a.bg}`}>
            <Icon className={`w-4 h-4 ${a.icon}`} />
          </span>
          <div className="min-w-0">
            <div className={`text-xl font-bold tabular-nums leading-none ${a.value}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1 truncate">{label}</div>
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

const DEFAULT_START = format(new Date(), "yyyy-MM-dd");
const DEFAULT_END = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

interface SourceFlags {
  loadingOrders: boolean;
  requests: boolean;
  movements: boolean;
  trips: boolean;
}

const DEFAULT_SOURCES: SourceFlags = {
  loadingOrders: true,
  requests: true,
  movements: true,
  trips: false,
};

type StatusFilter = ProjectionDayStatus | null;

export default function StockProjection() {
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(DEFAULT_END);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [eventSearch, setEventSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [sources, setSources] = useState<SourceFlags>(DEFAULT_SOURCES);
  const [onlyShortages, setOnlyShortages] = useState(false);
  const [onlyImpacted, setOnlyImpacted] = useState(false);

  const [result, setResult] = useState<StockProjectionResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [activeTab, setActiveTab] = useState("matrix");
  const [focusProductId, setFocusProductId] = useState<string | undefined>(undefined);
  const [detail, setDetail] = useState<DetailTarget | null>(null);

  const { data: events } = useQuery<any[]>({ queryKey: ["/api/events"] });
  const { data: products } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const dateError = startDate && endDate && startDate > endDate;
  const anySource = sources.loadingOrders || sources.requests || sources.movements || sources.trips;
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
      (p: any) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q),
    );
  }, [products, productSearch]);

  const displayResult = useMemo(() => {
    if (!result) return null;
    if (!statusFilter) return result;
    return { ...result, products: result.products.filter((p) => p.worstStatus === statusFilter) };
  }, [result, statusFilter]);

  const activeSourceLabels = useMemo(() => {
    const inc = result?.filters.include;
    if (!inc) return [] as string[];
    return (["loadingOrders", "requests", "movements", "trips"] as (keyof SourceFlags)[])
      .filter((k) => inc[k])
      .map((k) => SOURCE_SHORT[k]);
  }, [result]);

  const handleGenerate = async () => {
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
      const response = await apiRequest("POST", "/api/reports/stock-projection", payload);
      const data = (await response.json()) as StockProjectionResult;
      setResult(data);
      setStatusFilter(null);
      setFocusProductId(undefined);
    } catch (err: any) {
      console.error("Error generating projection:", err);
      setError(err?.message || "Erro ao gerar projeção");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    setSelectedEventIds([]);
    setSelectedProductIds([]);
    setStartDate(DEFAULT_START);
    setEndDate(DEFAULT_END);
    setSources(DEFAULT_SOURCES);
    setOnlyShortages(false);
    setOnlyImpacted(false);
    setEventSearch("");
    setProductSearch("");
    setResult(null);
    setError(null);
    setStatusFilter(null);
    setFocusProductId(undefined);
    setActiveTab("matrix");
  };

  const toggleEvent = (id: string) =>
    setSelectedEventIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleProduct = (id: string) =>
    setSelectedProductIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleStatusFilter = (s: ProjectionDayStatus) =>
    setStatusFilter((prev) => (prev === s ? null : s));

  const openProduct = (id: string) => {
    setFocusProductId(id);
    setActiveTab("by-product");
    setDetail(null);
  };

  const openCellDetail = (product: ProjectionProduct, cell: ProjectionDayCell) =>
    setDetail({ kind: "cell", product, cell });
  const openProductDetail = (product: ProjectionProduct) => setDetail({ kind: "product", product });
  const openConflictDetail = (conflict: ProjectionConflict) => setDetail({ kind: "conflict", conflict });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projeção de Estoque"
        description="Saldo projetado dia a dia, considerando requisições, ordens de carregamento, movimentações e viagens."
      >
        {result && (
          <Button variant="outline" size="sm" onClick={handleClear} data-testid="button-clear-projection">
            <X className="w-4 h-4 mr-1.5" />
            Limpar
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Filtros ── */}
        {filtersOpen ? (
          <div className="w-full lg:w-[300px] lg:flex-shrink-0 lg:sticky lg:top-4 space-y-4">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Filter className="w-4 h-4 text-primary/70" />
                      <p className="font-semibold text-base">Filtros</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Defina o período e as fontes da projeção</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hidden lg:flex"
                    onClick={() => setFiltersOpen(false)}
                    data-testid="button-collapse-filters"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>

                {/* Datas */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate">Data Início</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={dateError ? "border-destructive" : ""}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endDate">Data Fim</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={dateError ? "border-destructive" : ""}
                      data-testid="input-end-date"
                    />
                  </div>
                  {dateError && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Data de início deve ser anterior à data fim
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Período máximo: 90 dias.</p>
                </div>

                {/* Fontes */}
                <div className="space-y-2">
                  <Label>
                    Fontes consideradas
                    {!anySource && <span className="ml-1.5 text-xs text-destructive">(selecione 1)</span>}
                  </Label>
                  <div className="border border-border/60 rounded-md p-2 space-y-0.5">
                    {[
                      { key: "loadingOrders" as const, label: "Ordens de carregamento", id: "src-loading" },
                      { key: "requests" as const, label: "Requisições aprovadas", id: "src-requests" },
                      { key: "movements" as const, label: "Movimentações", id: "src-movements" },
                      { key: "trips" as const, label: "Viagens avulsas", id: "src-trips" },
                    ].map((s) => (
                      <label
                        key={s.key}
                        htmlFor={s.id}
                        className="flex items-center gap-2.5 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          id={s.id}
                          checked={sources[s.key]}
                          onCheckedChange={(v) => setSources((prev) => ({ ...prev, [s.key]: !!v }))}
                          data-testid={`checkbox-source-${s.key}`}
                        />
                        <span className="text-sm">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Eventos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>
                      Eventos
                      {selectedEventIds.length > 0 && (
                        <span className="ml-1.5 text-muted-foreground font-normal">({selectedEventIds.length})</span>
                      )}
                    </Label>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEventIds((events || []).map((e: any) => e.id))}
                        className="h-6 text-xs px-2"
                        data-testid="button-select-all-events"
                      >
                        Todos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEventIds([])}
                        disabled={selectedEventIds.length === 0}
                        className="h-6 text-xs px-2"
                        data-testid="button-clear-events"
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Vazio = todos os eventos do período.</p>
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
                    className="border border-border/60 rounded-md p-2 max-h-44 overflow-y-auto space-y-0.5 projection-scroll"
                    style={{ scrollbarWidth: "thin" }}
                  >
                    {filteredEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {!events?.length ? "Nenhum evento disponível" : "Nenhum resultado"}
                      </p>
                    ) : (
                      filteredEvents.map((event: any) => (
                        <label
                          key={event.id}
                          htmlFor={`ev-${event.id}`}
                          className={`flex items-start gap-2.5 rounded px-2 py-1.5 cursor-pointer transition-colors ${
                            selectedEventIds.includes(event.id) ? "bg-primary/10" : "hover:bg-muted/50"
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
                            <div className="text-sm leading-tight truncate">{event.name}</div>
                            {event.eventDate && (
                              <div className="text-xs text-muted-foreground">
                                {new Date(event.eventDate).toLocaleDateString("pt-BR")}
                              </div>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Produtos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>
                      Produtos
                      {selectedProductIds.length > 0 && (
                        <span className="ml-1.5 text-muted-foreground font-normal">({selectedProductIds.length})</span>
                      )}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedProductIds([])}
                      disabled={selectedProductIds.length === 0}
                      className="h-6 text-xs px-2"
                      data-testid="button-clear-products"
                    >
                      Limpar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Vazio = todos os produtos envolvidos.</p>
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
                    className="border border-border/60 rounded-md p-2 max-h-44 overflow-y-auto space-y-0.5 projection-scroll"
                    style={{ scrollbarWidth: "thin" }}
                  >
                    {filteredProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {!products?.length ? "Nenhum produto disponível" : "Nenhum resultado"}
                      </p>
                    ) : (
                      filteredProducts.slice(0, 200).map((product: any) => (
                        <label
                          key={product.id}
                          htmlFor={`pr-${product.id}`}
                          className={`flex items-start gap-2.5 rounded px-2 py-1.5 cursor-pointer transition-colors ${
                            selectedProductIds.includes(product.id) ? "bg-primary/10" : "hover:bg-muted/50"
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
                            <div className="text-sm leading-tight truncate">{product.name}</div>
                            <div className="text-xs text-muted-foreground">{product.sku}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Opções */}
                <div className="space-y-1">
                  <label htmlFor="only-shortages" className="flex items-center gap-2.5 rounded px-1 py-1 cursor-pointer">
                    <Checkbox
                      id="only-shortages"
                      checked={onlyShortages}
                      onCheckedChange={(v) => setOnlyShortages(!!v)}
                      data-testid="checkbox-only-shortages"
                    />
                    <span className="text-sm">Mostrar apenas produtos em falta</span>
                  </label>
                  <label htmlFor="only-impacted" className="flex items-center gap-2.5 rounded px-1 py-1 cursor-pointer">
                    <Checkbox
                      id="only-impacted"
                      checked={onlyImpacted}
                      onCheckedChange={(v) => setOnlyImpacted(!!v)}
                      data-testid="checkbox-only-impacted"
                    />
                    <span className="text-sm">Mostrar apenas produtos impactados</span>
                  </label>
                </div>

                {/* Ações */}
                <div className="space-y-2 sticky bottom-0 bg-card pt-2">
                  <Button
                    className="w-full"
                    onClick={handleGenerate}
                    disabled={!canGenerate || isGenerating}
                    data-testid="button-generate"
                  >
                    {isGenerating ? "Gerando..." : "Gerar Projeção"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={handleClear} data-testid="button-clear-filters">
                    Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="hidden lg:flex lg:sticky lg:top-4"
            onClick={() => setFiltersOpen(true)}
            data-testid="button-expand-filters"
          >
            <Filter className="w-4 h-4 mr-1.5" />
            Filtros
          </Button>
        )}

        {/* ── Resultados ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {error && (
            <Card className="border-destructive/40">
              <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </CardContent>
            </Card>
          )}

          {!result && !isGenerating && (
            <EmptyState
              icon={CalendarRange}
              title="Gere uma projeção"
              description="Selecione o período e as fontes, depois clique em Gerar Projeção para ver o saldo dia a dia."
            />
          )}

          {result && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
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

              {result.warnings.length > 0 && (
                <Card className="border-chart-5/40">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-chart-5 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        {result.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-muted-foreground" data-testid={`warning-${i}`}>
                            {w}
                          </p>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active filter chips */}
              <div className="flex flex-wrap items-center gap-1.5" data-testid="active-filter-chips">
                <span className="text-xs text-muted-foreground mr-0.5">Filtros:</span>
                <Badge variant="outline" className="text-xs gap-1">
                  <CalendarRange className="w-3 h-3" />
                  {fmtChipDate(result.filters.startDate)} – {fmtChipDate(result.filters.endDate)}
                </Badge>
                {activeSourceLabels.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {activeSourceLabels.length === 4 ? "Todas as fontes" : activeSourceLabels.join(" · ")}
                  </Badge>
                )}
                {(result.filters.eventIds?.length ?? 0) > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {result.filters.eventIds!.length} evento(s)
                  </Badge>
                )}
                {(result.filters.productIds?.length ?? 0) > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {result.filters.productIds!.length} produto(s)
                  </Badge>
                )}
                {result.filters.onlyShortages && (
                  <Badge variant="outline" className="text-xs">
                    Apenas em falta
                  </Badge>
                )}
                {result.filters.onlyImpacted && (
                  <Badge variant="outline" className="text-xs">
                    Apenas impactados
                  </Badge>
                )}
                {statusFilter && (
                  <Badge variant="secondary" className="text-xs gap-1" data-testid="chip-status-filter">
                    {statusFilter === "shortage" ? "Em falta" : statusFilter === "low" ? "Abaixo do mínimo" : "Adequados"}
                    <button
                      onClick={() => setStatusFilter(null)}
                      className="hover-elevate rounded-sm"
                      data-testid="button-clear-status-filter"
                      aria-label="Limpar filtro de status"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
              </div>
              {statusFilter && (
                <p className="text-xs text-muted-foreground -mt-2">
                  O filtro de status aplica-se a Matriz, Visão por Dia e Por Produto (não afeta Conflitos e Movimentações).
                </p>
              )}

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
                    Movimentações
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="matrix" className="mt-4">
                  <ProjectionMatrix
                    result={displayResult!}
                    onOpenCell={openCellDetail}
                    onOpenProduct={openProductDetail}
                  />
                </TabsContent>
                <TabsContent value="day" className="mt-4">
                  <ProjectionDayView result={displayResult!} onSelectProduct={openProduct} />
                </TabsContent>
                <TabsContent value="by-product" className="mt-4">
                  <ProjectionByProduct
                    result={displayResult!}
                    selectedProductId={focusProductId}
                    onSelectProduct={setFocusProductId}
                  />
                </TabsContent>
                <TabsContent value="conflicts" className="mt-4">
                  <ProjectionConflicts result={result} onOpenDetail={openConflictDetail} />
                </TabsContent>
                <TabsContent value="movements" className="mt-4">
                  <ProjectionMovements result={result} />
                </TabsContent>
              </Tabs>

              <p className="text-xs text-muted-foreground">
                {result.calculationBase} Gerado em {new Date(result.generatedAt).toLocaleString("pt-BR")}.
              </p>
            </>
          )}
        </div>
      </div>

      <ProjectionDetailDrawer target={detail} onClose={() => setDetail(null)} onGoToProduct={openProduct} />
    </div>
  );
}

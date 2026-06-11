import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
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
  Clock,
  Calendar,
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

// ─── Types & constants ────────────────────────────────────────────────────────

interface SourceFlags {
  loadingOrders: boolean;
  requests: boolean;
  movements: boolean;
  trips: boolean;
}

interface GenerateParams {
  startDate: string;
  endDate: string;
  eventIds: string[];
  productIds: string[];
  sources: SourceFlags;
  onlyShortages: boolean;
  onlyImpacted: boolean;
}

type StatusFilter = ProjectionDayStatus | null;

const DEFAULT_START = format(new Date(), "yyyy-MM-dd");
const DEFAULT_END = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
const DEFAULT_SOURCES: SourceFlags = {
  loadingOrders: true,
  requests: true,
  movements: true,
  trips: false,
};

const DEFAULT_PARAMS: GenerateParams = {
  startDate: DEFAULT_START,
  endDate: DEFAULT_END,
  eventIds: [],
  productIds: [],
  sources: DEFAULT_SOURCES,
  onlyShortages: false,
  onlyImpacted: false,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function fmtDateFull(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function daysBetween(start: string, end: string): number {
  const ms =
    new Date(end + "T12:00:00Z").getTime() -
    new Date(start + "T12:00:00Z").getTime();
  return Math.round(ms / 86400000) + 1;
}

// ─── Diagnostic banner ────────────────────────────────────────────────────────

function DiagnosticBanner({ result }: { result: StockProjectionResult }) {
  const { summary, conflicts, products } = result;

  const warnCount = useMemo(
    () => conflicts.filter((c) => c.severity === "warning").length,
    [conflicts],
  );

  const firstRiskDate = useMemo(() => {
    if (summary.productsShortage === 0) return null;
    let earliest: string | null = null;
    for (const p of products) {
      for (const d of p.days) {
        if (d.status === "shortage") {
          if (!earliest || d.date < earliest) earliest = d.date;
          break;
        }
      }
    }
    return earliest;
  }, [summary.productsShortage, products]);

  if (summary.productsShortage > 0) {
    return (
      <Card className="border-destructive/40 bg-destructive/5" data-testid="diagnostic-risk">
        <CardContent className="p-3 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm">
            <span className="font-semibold text-destructive">Atenção: </span>
            <span className="text-muted-foreground">
              {summary.productsShortage} produto(s) entram em falta no período
              {firstRiskDate ? `. Primeiro risco em ${fmtDateFull(firstRiskDate)}.` : "."}
            </span>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (summary.productsLow > 0 || warnCount > 0) {
    return (
      <Card className="border-chart-5/40 bg-chart-5/5" data-testid="diagnostic-warning">
        <CardContent className="p-3 flex items-center gap-2.5">
          <Info className="w-4 h-4 text-chart-5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Nenhum conflito de saldo detectado.
            {summary.productsLow > 0 && (
              <>{" "}<span className="font-medium text-chart-5">{summary.productsLow} produto(s) abaixo do mínimo.</span></>
            )}
            {warnCount > 0 && (
              <>{" "}<span className="font-medium text-chart-5">Existem {warnCount} aviso(s) para revisar.</span></>
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-chart-4/40 bg-chart-4/5" data-testid="diagnostic-healthy">
      <CardContent className="p-3 flex items-center gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-chart-4 flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-chart-4">Projeção saudável: </span>
          {summary.totalProducts} produto(s) analisado(s), nenhum item em falta
          {warnCount > 0 ? ` e ${warnCount} aviso(s) para revisar.` : "."}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Recommended actions ──────────────────────────────────────────────────────

function RecommendedActions({ result }: { result: StockProjectionResult }) {
  const actions = useMemo(() => {
    const list: string[] = [];
    const { summary, conflicts } = result;

    if (summary.productsShortage > 0) {
      list.push(`Planejar reposição urgente para ${summary.productsShortage} produto(s) em falta no período.`);
    }
    if (summary.productsLow > 0) {
      list.push(`Revisar reposição para ${summary.productsLow} produto(s) abaixo do estoque mínimo.`);
    }
    const hasAmbiguous = conflicts.some((c) => c.kind === "ambiguous");
    const hasMissingData = conflicts.some((c) => c.kind === "missing_data");
    const hasMultiTrip = conflicts.some(
      (c) => c.links && c.links.length > 1 && c.links.some((l) => l.type === "trip"),
    );

    if (hasAmbiguous) {
      list.push("Validar origens ambíguas antes de usar a projeção como definitiva.");
    }
    if (hasMissingData) {
      list.push("Configurar estoque mínimo para produtos sem mínimo definido.");
    }
    if (hasMultiTrip) {
      list.push("Revisar ordens com vínculo múltiplo de viagens.");
    }
    return list;
  }, [result]);

  if (actions.length === 0) return null;

  return (
    <Card className="border-chart-5/30 bg-chart-5/5" data-testid="recommended-actions">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-chart-5 flex-shrink-0" />
          <p className="text-sm font-semibold text-chart-5">Ações recomendadas</p>
        </div>
        <ul className="space-y-1.5">
          {actions.map((action, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="flex-shrink-0 text-chart-5 font-bold leading-5">·</span>
              {action}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

type KpiAccent = "primary" | "destructive" | "warn" | "success" | "neutral";
const ACCENT_MAP: Record<
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
    bg: "bg-muted/60",
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
  const a = ACCENT_MAP[accent];
  const inner = (
    <Card
      className={`${a.border} h-full ${onClick ? "hover-elevate cursor-pointer" : ""} ${active ? `ring-1 ${a.ring}` : ""}`}
    >
      <CardContent className="p-2.5">
        <div className="flex items-center gap-2">
          <span className={`flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 ${a.bg}`}>
            <Icon className={`w-3.5 h-3.5 ${a.icon}`} />
          </span>
          <div className="min-w-0">
            <div className={`text-lg font-bold tabular-nums leading-none ${a.value}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate leading-tight">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div onClick={onClick} data-testid={testId} className={onClick ? "cursor-pointer" : undefined}>
          {inner}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ─── KPI skeleton ─────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <Card className="border-border/60 h-full animate-pulse">
      <CardContent className="p-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-muted flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-5 w-10 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function StatusBar({
  result,
  isGenerating,
  lastGeneratedAt,
}: {
  result: StockProjectionResult;
  isGenerating: boolean;
  lastGeneratedAt: Date | null;
}) {
  const f = result.filters;
  const days = daysBetween(f.startDate, f.endDate);
  const inc = f.include ?? {};
  const sourceCount = [inc.loadingOrders, inc.requests, inc.movements, inc.trips].filter(Boolean).length;
  const eventCount = f.eventIds?.length ?? 0;
  const productCount = f.productIds?.length ?? 0;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-4 py-2.5"
      data-testid="status-bar"
    >
      <CalendarRange className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm font-medium">
        {fmtDateFull(f.startDate)} → {fmtDateFull(f.endDate)}
      </span>
      <span className="text-muted-foreground/40 mx-0.5">·</span>
      <Badge variant="secondary" className="text-xs">
        {days} {days === 1 ? "dia" : "dias"}
      </Badge>
      <Badge variant="secondary" className="text-xs">
        {sourceCount === 4 ? "4 fontes ativas" : `${sourceCount} fonte(s) ativa(s)`}
      </Badge>
      {eventCount > 0 ? (
        <Badge variant="secondary" className="text-xs">
          {eventCount} evento(s) selecionado(s)
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">
          Todos os eventos
        </Badge>
      )}
      {productCount > 0 ? (
        <Badge variant="secondary" className="text-xs">
          {productCount} produto(s) selecionado(s)
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">
          Todos os produtos impactados
        </Badge>
      )}
      {f.onlyShortages && <Badge variant="secondary" className="text-xs">Apenas em falta</Badge>}
      {f.onlyImpacted && <Badge variant="secondary" className="text-xs">Apenas impactados</Badge>}

      <div className="ml-auto flex items-center gap-1.5 text-xs">
        {isGenerating ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
            <span className="text-primary font-medium">Recalculando projeção...</span>
          </>
        ) : lastGeneratedAt ? (
          <>
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Projeção calculada às {fmtTime(lastGeneratedAt)}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Rich empty state (before first generation) ───────────────────────────────

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
    { icon: ArrowUpRight, label: "Saídas previstas", desc: "Requisições e ordens de carregamento", color: "text-destructive", bg: "bg-destructive/10" },
    { icon: ArrowDownLeft, label: "Entradas e retornos", desc: "Devoluções e reposições programadas", color: "text-chart-4", bg: "bg-chart-4/10" },
    { icon: Lock, label: "Reservas", desc: "Material alocado aguardando expedição", color: "text-primary", bg: "bg-primary/10" },
    { icon: AlertTriangle, label: "Conflitos", desc: "Dias com saldo negativo e dados incompletos", color: "text-chart-5", bg: "bg-chart-5/10" },
  ];
  return (
    <div className="flex flex-col items-center gap-8 py-12" data-testid="empty-state-rich">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
        <BarChart3 className="w-8 h-8 text-primary" />
      </div>
      <div className="text-center max-w-lg">
        <h2 className="text-xl font-semibold mb-2">Central de Controle de Estoque</h2>
        <p className="text-sm text-muted-foreground">
          A projeção considera requisições aprovadas, ordens de carregamento, movimentações e
          planos de viagem para calcular o saldo disponível dia a dia.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
        {cards.map((item) => (
          <Card key={item.label} className="border-border/60">
            <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
              <span className={`flex items-center justify-center w-9 h-9 rounded-md ${item.bg}`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </span>
              <div>
                <div className="text-sm font-medium leading-tight">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button onClick={onGenerate} disabled={isGenerating} size="lg" data-testid="button-generate-empty">
          <Zap className="w-4 h-4 mr-2" />
          {isGenerating ? "Calculando..." : "Gerar projeção dos próximos 30 dias"}
        </Button>
        <Button variant="outline" size="lg" onClick={onOpenFilters} data-testid="button-filters-empty">
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Personalizar filtros
        </Button>
      </div>
    </div>
  );
}

// ─── No data state (generation succeeded, 0 products) ────────────────────────

function NoDataState({
  onExpandPeriod,
  onOpenFilters,
}: {
  onExpandPeriod: () => void;
  onOpenFilters: () => void;
}) {
  return (
    <Card className="border-border/60" data-testid="no-data-state">
      <CardContent className="p-8 text-center space-y-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mx-auto">
          <Calendar className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-base">Nenhum impacto encontrado no período</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Não encontramos requisições, ordens, movimentações ou viagens que alterem o estoque no
          intervalo e filtros selecionados.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onExpandPeriod} data-testid="button-expand-period">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Ampliar para 60 dias
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenFilters} data-testid="button-adjust-filters">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
            Ajustar filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StockProjection() {
  // filter state
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
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [hasEverLoaded, setHasEverLoaded] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [activeTab, setActiveTab] = useState("matrix");
  const [focusProductId, setFocusProductId] = useState<string | undefined>(undefined);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [selectedDayForNav, setSelectedDayForNav] = useState<string | undefined>(undefined);

  const { data: events } = useQuery<any[]>({ queryKey: ["/api/events"] });
  const { data: products } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const dateError = !!(startDate && endDate && startDate > endDate);
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
    return {
      ...result,
      products: result.products.filter((p) => p.worstStatus === statusFilter),
    };
  }, [result, statusFilter]);

  const incompleteWarnings = useMemo(
    () => (result ? result.conflicts.filter((c) => c.kind === "missing_data") : []),
    [result],
  );

  const hasData = result && result.products.length > 0;

  // ── Core generate function (accepts explicit params — no state deps) ─────────
  async function generateWith(params: GenerateParams) {
    const anySrc =
      params.sources.loadingOrders ||
      params.sources.requests ||
      params.sources.movements ||
      params.sources.trips;
    if (!params.startDate || !params.endDate || params.startDate > params.endDate || !anySrc) return;
    try {
      setIsGenerating(true);
      setError(null);
      const payload: StockProjectionParams = {
        startDate: params.startDate,
        endDate: params.endDate,
        eventIds: params.eventIds,
        productIds: params.productIds,
        include: params.sources,
        onlyShortages: params.onlyShortages,
        onlyImpacted: params.onlyImpacted,
      };
      const response = await apiRequest("POST", "/api/reports/stock-projection", payload);
      const data = (await response.json()) as StockProjectionResult;
      setResult(data);
      setLastGeneratedAt(new Date());
      setHasEverLoaded(true);
      setStatusFilter(null);
      setFocusProductId(undefined);
    } catch (err: any) {
      setError(err?.message || "Erro ao gerar projeção");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleGenerate() {
    generateWith({ startDate, endDate, eventIds: selectedEventIds, productIds: selectedProductIds, sources, onlyShortages, onlyImpacted });
  }

  function handleApplyFilters() {
    setFiltersOpen(false);
    handleGenerate();
  }

  function resetFilterState() {
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

  function handleClearAllFilters() {
    resetFilterState();
  }

  function handleClear() {
    resetFilterState();
    setError(null);
    setStatusFilter(null);
    setFocusProductId(undefined);
    setActiveTab("matrix");
    setLastGeneratedAt(null);
    setSelectedDayForNav(undefined);
    setHasEverLoaded(false);
    setResult(null);
    // Recalculate immediately with defaults
    generateWith(DEFAULT_PARAMS);
  }

  // Auto-generate on mount
  useEffect(() => {
    generateWith(DEFAULT_PARAMS); // eslint-disable-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const handleSelectDay = (date: string) => {
    setSelectedDayForNav(date);
    setActiveTab("day");
  };
  const openCellDetail = (product: ProjectionProduct, cell: ProjectionDayCell) =>
    setDetail({ kind: "cell", product, cell });
  const openProductDetail = (product: ProjectionProduct) =>
    setDetail({ kind: "product", product });
  const openConflictDetail = (conflict: ProjectionConflict) =>
    setDetail({ kind: "conflict", conflict });

  const dateShortcuts = [
    { label: "7 dias", days: 7 },
    { label: "15 dias", days: 15 },
    { label: "30 dias", days: 30 },
    { label: "60 dias", days: 60 },
  ];
  function applyShortcut(days: number) {
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate(format(new Date(Date.now() + days * 86400000), "yyyy-MM-dd"));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <PageHeader
        title="Projeção de Estoque"
        description="Saldo projetado dia a dia com base nas fontes e filtros aplicados."
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          data-testid="button-clear-projection"
        >
          <X className="w-3.5 h-3.5 mr-1.5" />
          Limpar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen(true)}
          data-testid="button-open-filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
          Filtros avançados
        </Button>
      </PageHeader>

      {/* ── Status bar ── */}
      {result && (
        <StatusBar result={result} isGenerating={isGenerating} lastGeneratedAt={lastGeneratedAt} />
      )}

      {/* ── Error ── */}
      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Initial loading (first load, no result yet) ── */}
      {isGenerating && !result && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-40 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          </div>
          <Card className="border-border/60 animate-pulse">
            <CardContent className="p-4 h-48 flex items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm">Calculando projeção de estoque...</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Rich empty state (never loaded, not loading) ── */}
      {!result && !isGenerating && !hasEverLoaded && (
        <RichEmptyState
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      )}

      {/* ── No data state (loaded but 0 products) ── */}
      {result && !hasData && !isGenerating && (
        <NoDataState
          onExpandPeriod={() => {
            applyShortcut(60);
            generateWith({ ...DEFAULT_PARAMS, startDate: format(new Date(), "yyyy-MM-dd"), endDate: format(new Date(Date.now() + 60 * 86400000), "yyyy-MM-dd") });
          }}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      )}

      {/* ── Results (with opacity overlay while recalculating) ── */}
      {result && hasData && (
        <div className={`space-y-4 transition-opacity duration-300 ${isGenerating ? "opacity-40 pointer-events-none select-none" : "opacity-100"}`}>
          {/* ── Diagnostic banner ── */}
          <DiagnosticBanner result={result} />

          {/* ── Recommended actions ── */}
          <RecommendedActions result={result} />

          {/* ── KPIs ── */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Risco de estoque
                <span className="ml-2 font-normal normal-case">· clique para filtrar</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard icon={Package} value={result.summary.totalProducts} label="Produtos analisados" tooltip={KPI_TOOLTIPS.totalProducts} accent="primary" active={statusFilter === null} onClick={() => setStatusFilter(null)} testId="kpi-total" />
                <KpiCard icon={AlertTriangle} value={result.summary.productsShortage} label="Em falta" tooltip={KPI_TOOLTIPS.productsShortage} accent="destructive" active={statusFilter === "shortage"} onClick={() => toggleStatusFilter("shortage")} testId="kpi-shortage" />
                <KpiCard icon={TrendingDown} value={result.summary.productsLow} label="Abaixo do mínimo" tooltip={KPI_TOOLTIPS.productsLow} accent="warn" active={statusFilter === "low"} onClick={() => toggleStatusFilter("low")} testId="kpi-low" />
                <KpiCard icon={CheckCircle2} value={result.summary.productsOk} label="Adequados" tooltip={KPI_TOOLTIPS.productsOk} accent="success" active={statusFilter === "ok"} onClick={() => toggleStatusFilter("ok")} testId="kpi-ok" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Volume operacional
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard icon={ArrowUpRight} value={result.summary.totalOutbound} label="Total saídas" tooltip={KPI_TOOLTIPS.totalOutbound} accent="neutral" testId="kpi-outbound" />
                <KpiCard icon={ArrowDownLeft} value={result.summary.totalInbound} label="Total entradas" tooltip={KPI_TOOLTIPS.totalInbound} accent="neutral" testId="kpi-inbound" />
                <KpiCard icon={Lock} value={result.summary.totalReserved} label="Pico reservado" tooltip={KPI_TOOLTIPS.totalReserved} accent="neutral" testId="kpi-reserved" />
                <KpiCard icon={MapPin} value={result.summary.totalInEvent} label="Pico em evento" tooltip={KPI_TOOLTIPS.totalInEvent} accent="neutral" testId="kpi-inevent" />
              </div>
            </div>
          </div>

          {/* Dados incompletos */}
          {incompleteWarnings.length > 0 && (
            <Card className="border-chart-5/40">
              <CardContent className="p-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-chart-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-chart-5">
                    Dados incompletos ({incompleteWarnings.length})
                  </p>
                </div>
                <div className="space-y-1">
                  {incompleteWarnings.slice(0, 3).map((c, i) => (
                    <p key={i} className="text-xs text-muted-foreground">• {c.message}</p>
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

          {result.warnings.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-muted-foreground" data-testid={`warning-${i}`}>{w}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {statusFilter && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs gap-1" data-testid="chip-status-filter">
                {statusFilter === "shortage" ? "Em falta" : statusFilter === "low" ? "Abaixo do mínimo" : "Adequados"}
                <button onClick={() => setStatusFilter(null)} className="hover-elevate rounded-sm" data-testid="button-clear-status-filter" aria-label="Limpar filtro">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
              <span className="text-xs text-muted-foreground">Aplica-se à Matriz, Visão por Dia e Por Produto.</span>
            </div>
          )}

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="matrix" data-testid="tab-matrix">
                <LayoutGrid className="w-4 h-4 mr-1.5" /> Matriz por Dia
              </TabsTrigger>
              <TabsTrigger value="day" data-testid="tab-day">
                <ListChecks className="w-4 h-4 mr-1.5" /> Visão por Dia
              </TabsTrigger>
              <TabsTrigger value="by-product" data-testid="tab-by-product">
                <Package className="w-4 h-4 mr-1.5" /> Por Produto
              </TabsTrigger>
              <TabsTrigger value="conflicts" data-testid="tab-conflicts">
                <AlertCircle className="w-4 h-4 mr-1.5" />
                {(() => {
                  const errCount = result.conflicts.filter((c) => c.severity === "error").length;
                  const warnCount = result.conflicts.filter((c) => c.severity === "warning").length;
                  if (errCount > 0)
                    return (
                      <>
                        Conflitos
                        <span className="ml-1.5 text-xs rounded-full bg-destructive/15 text-destructive px-1.5">
                          {errCount}
                        </span>
                      </>
                    );
                  if (warnCount > 0)
                    return (
                      <>
                        Avisos
                        <span className="ml-1.5 text-xs rounded-full bg-chart-5/20 text-chart-5 px-1.5">
                          {warnCount}
                        </span>
                      </>
                    );
                  return <>Conflitos</>;
                })()}
              </TabsTrigger>
              <TabsTrigger value="movements" data-testid="tab-movements">
                <Truck className="w-4 h-4 mr-1.5" /> Fontes da projeção
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matrix" className="mt-4">
              <ProjectionMatrix result={displayResult!} onOpenCell={openCellDetail} onOpenProduct={openProductDetail} onSelectDay={handleSelectDay} />
            </TabsContent>
            <TabsContent value="day" className="mt-4">
              <ProjectionDayView result={displayResult!} onSelectProduct={openProduct} initialDay={selectedDayForNav} />
            </TabsContent>
            <TabsContent value="by-product" className="mt-4">
              <ProjectionByProduct result={displayResult!} selectedProductId={focusProductId} onSelectProduct={setFocusProductId} />
            </TabsContent>
            <TabsContent value="conflicts" className="mt-4">
              <ProjectionConflicts result={result} onOpenDetail={openConflictDetail} onGoToSources={() => setActiveTab("movements")} />
            </TabsContent>
            <TabsContent value="movements" className="mt-4">
              <ProjectionMovements result={result} />
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground">
            {result.calculationBase} Gerado em {new Date(result.generatedAt).toLocaleString("pt-BR")}.
          </p>
        </div>
      )}

      {/* ── Advanced Filters Sheet ── */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col projection-scroll" data-testid="filters-sheet">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Filtros Avançados
            </SheetTitle>
            <SheetDescription>Defina o período, as fontes e os itens da projeção</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-5 projection-scroll" style={{ scrollbarWidth: "thin" }}>
            {/* Período */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-primary/70" /> Período
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-start">Data início</Label>
                  <Input id="filter-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={dateError ? "border-destructive" : ""} data-testid="input-start-date" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-end">Data fim</Label>
                  <Input id="filter-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={dateError ? "border-destructive" : ""} data-testid="input-end-date" />
                </div>
              </div>
              {dateError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Data de início deve ser anterior à data fim
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {dateShortcuts.map(({ label, days }) => {
                  const s = format(new Date(), "yyyy-MM-dd");
                  const e = format(new Date(Date.now() + days * 86400000), "yyyy-MM-dd");
                  const isActive = startDate === s && endDate === e;
                  return (
                    <Button key={label} size="sm" variant={isActive ? "default" : "outline"} className="h-7 text-xs px-2.5" onClick={() => applyShortcut(days)} data-testid={`shortcut-${days}`}>
                      {label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Período máximo de 90 dias.</p>
            </section>

            <Separator />

            {/* Fontes */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary/70" /> Fontes da projeção
                {!anySource && <span className="text-xs text-destructive font-normal">(selecione ao menos 1)</span>}
              </h3>
              {([
                { key: "loadingOrders" as const, label: "Ordens de carregamento", id: "src-loading" },
                { key: "requests" as const, label: "Requisições aprovadas", id: "src-requests" },
                { key: "movements" as const, label: "Movimentações", id: "src-movements" },
                { key: "trips" as const, label: "Planos de Viagens avulsos", id: "src-trips" },
              ] as const).map((s) => (
                <label key={s.key} htmlFor={s.id} className="flex items-center gap-2.5 rounded px-2 py-2 cursor-pointer hover:bg-muted/50">
                  <Checkbox id={s.id} checked={sources[s.key]} onCheckedChange={(v) => setSources((prev) => ({ ...prev, [s.key]: !!v }))} data-testid={`checkbox-source-${s.key}`} />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </section>

            <Separator />

            {/* Eventos */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Eventos
                  {selectedEventIds.length > 0 && <Badge variant="secondary" className="ml-2 text-xs">{selectedEventIds.length}</Badge>}
                </h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedEventIds((events || []).map((e: any) => e.id))} data-testid="button-select-all-events">Todos</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedEventIds([])} disabled={selectedEventIds.length === 0} data-testid="button-clear-events">Limpar</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Se nenhum evento for selecionado, todos os eventos do período serão considerados.</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Buscar evento..." value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-event-search" />
              </div>
              <div className="border border-border/60 rounded-md p-1.5 max-h-52 overflow-y-auto space-y-0.5 projection-scroll" style={{ scrollbarWidth: "thin" }}>
                {filteredEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">{!events?.length ? "Nenhum evento disponível" : "Nenhum resultado"}</p>
                ) : filteredEvents.map((event: any) => (
                  <label key={event.id} htmlFor={`ev-${event.id}`} className={`flex items-start gap-2.5 rounded px-2 py-1.5 cursor-pointer transition-colors ${selectedEventIds.includes(event.id) ? "bg-primary/10" : "hover:bg-muted/50"}`}>
                    <Checkbox id={`ev-${event.id}`} checked={selectedEventIds.includes(event.id)} onCheckedChange={() => toggleEvent(event.id)} className="mt-0.5" data-testid={`checkbox-event-${event.id}`} />
                    <div className="min-w-0">
                      <div className="text-sm leading-tight truncate">{event.name}</div>
                      {event.eventDate && <div className="text-xs text-muted-foreground">{new Date(event.eventDate).toLocaleDateString("pt-BR")}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <Separator />

            {/* Produtos */}
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Produtos
                  {selectedProductIds.length > 0 && <Badge variant="secondary" className="ml-2 text-xs">{selectedProductIds.length}</Badge>}
                </h3>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedProductIds([])} disabled={selectedProductIds.length === 0} data-testid="button-clear-products">Limpar</Button>
              </div>
              <p className="text-xs text-muted-foreground">Se nenhum produto for selecionado, todos os produtos impactados serão considerados.</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-product-search" />
              </div>
              <div className="border border-border/60 rounded-md p-1.5 max-h-52 overflow-y-auto space-y-0.5 projection-scroll" style={{ scrollbarWidth: "thin" }}>
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">{!products?.length ? "Nenhum produto disponível" : "Nenhum resultado"}</p>
                ) : filteredProducts.slice(0, 200).map((product: any) => (
                  <label key={product.id} htmlFor={`pr-${product.id}`} className={`flex items-start gap-2.5 rounded px-2 py-1.5 cursor-pointer transition-colors ${selectedProductIds.includes(product.id) ? "bg-primary/10" : "hover:bg-muted/50"}`}>
                    <Checkbox id={`pr-${product.id}`} checked={selectedProductIds.includes(product.id)} onCheckedChange={() => toggleProduct(product.id)} className="mt-0.5" data-testid={`checkbox-product-${product.id}`} />
                    <div className="min-w-0">
                      <div className="text-sm leading-tight truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <Separator />

            {/* Exibição */}
            <section className="space-y-1">
              <h3 className="text-sm font-semibold mb-2">Exibição</h3>
              <label htmlFor="only-shortages" className="flex items-center gap-2.5 rounded px-1 py-2 cursor-pointer hover:bg-muted/50">
                <Checkbox id="only-shortages" checked={onlyShortages} onCheckedChange={(v) => setOnlyShortages(!!v)} data-testid="checkbox-only-shortages" />
                <span className="text-sm">Mostrar apenas produtos em falta</span>
              </label>
              <label htmlFor="only-impacted" className="flex items-center gap-2.5 rounded px-1 py-2 cursor-pointer hover:bg-muted/50">
                <Checkbox id="only-impacted" checked={onlyImpacted} onCheckedChange={(v) => setOnlyImpacted(!!v)} data-testid="checkbox-only-impacted" />
                <span className="text-sm">Mostrar apenas produtos impactados</span>
              </label>
            </section>
          </div>

          <SheetFooter className="flex-shrink-0 flex gap-2 border-t border-border/60 pt-4">
            <Button variant="outline" className="flex-1" onClick={handleClearAllFilters} data-testid="button-clear-filters">
              Limpar filtros
            </Button>
            <Button className="flex-1" onClick={handleApplyFilters} disabled={!canGenerate || isGenerating} data-testid="button-apply-filters">
              {isGenerating ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Calculando...</> : "Aplicar filtros"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ProjectionDetailDrawer target={detail} onClose={() => setDetail(null)} onGoToProduct={openProduct} />
    </div>
  );
}

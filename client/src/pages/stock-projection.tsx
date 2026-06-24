import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
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
  FileDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  EventTripSummary,
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
  useEventTripDates?: boolean;
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

  // ── Modo Evento-Viagem ──────────────────────────────────────────────────────
  const [useEventTripDates, setUseEventTripDates] = useState(false);
  const [eventsWithTrips, setEventsWithTrips] = useState<EventTripSummary[]>([]);
  const [loadingEventsWithTrips, setLoadingEventsWithTrips] = useState(false);
  const [excludedEventIds, setExcludedEventIds] = useState<string[]>([]);
  const [expandedTripEventIds, setExpandedTripEventIds] = useState<string[]>([]);

  // ── Drawer UI state ──────────────────────────────────────────────────────────
  const [configMode, setConfigMode] = useState<"quick" | "advanced">(() => {
    try { return (sessionStorage.getItem("projection-config-mode") as "quick" | "advanced") || "advanced"; } catch { return "advanced"; }
  });
  const [granularity, setGranularity] = useState<"hour" | "shift" | "day" | "week">("day");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(["period", "tripMode", "sources"])
  );

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

  // ── Modo Evento-Viagem helpers ────────────────────────────────────────────────
  const fetchEventsWithTrips = useCallback(async (start: string, end: string) => {
    if (!start || !end || start > end) return;
    setLoadingEventsWithTrips(true);
    try {
      const resp = await apiRequest("GET", `/api/reports/events-with-trips?startDate=${start}&endDate=${end}`);
      const data = await resp.json();
      const fetched: EventTripSummary[] = data.events || [];
      setEventsWithTrips(fetched);
      setExcludedEventIds([]);
    } catch {
      setEventsWithTrips([]);
    } finally {
      setLoadingEventsWithTrips(false);
    }
  }, []);

  function exportExcel() {
    if (!result) return;

    // Build per-event per-product in-transit quantities from consideredMovements
    const eventOrderedIds: string[] = [];
    const eventNamesMap = new Map<string, string>();
    const inTransitByEventProduct = new Map<string, Map<string, number>>();

    for (const cm of result.consideredMovements) {
      if (cm.direction !== "outbound") continue;
      if (!cm.eventId || !cm.eventName) continue;
      if (!eventNamesMap.has(cm.eventId)) {
        eventOrderedIds.push(cm.eventId);
        eventNamesMap.set(cm.eventId, cm.eventName);
      }
      if (!inTransitByEventProduct.has(cm.eventId)) {
        inTransitByEventProduct.set(cm.eventId, new Map());
      }
      const prodMap = inTransitByEventProduct.get(cm.eventId)!;
      for (const p of cm.products) {
        prodMap.set(p.productId, (prodMap.get(p.productId) || 0) + p.qty);
      }
    }

    const eventColHeaders = eventOrderedIds.map((id) => `Em Trânsito — ${eventNamesMap.get(id)}`);
    const headers = ["Produto", "SKU", "Estoque Atual", ...eventColHeaders, "Saldo Final"];

    const rows = result.products.map((p) => {
      const lastDay = p.days[p.days.length - 1];
      const finalBalance = lastDay?.available ?? p.minAvailable;
      return [
        p.name,
        p.sku,
        p.currentStock,
        ...eventOrderedIds.map((eid) => inTransitByEventProduct.get(eid)?.get(p.productId) ?? 0),
        finalBalance,
      ];
    });

    const wsData = [headers, ...rows];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Auto-width columns
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length));
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, "Simulação de Estoque");
    XLSX.writeFile(wb, `simulacao-estoque-${result.filters.startDate}-${result.filters.endDate}.xlsx`);
  }

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
        useEventTripDates: params.useEventTripDates ?? false,
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
    const effectiveEventIds = useEventTripDates
      ? eventsWithTrips.filter((e) => !excludedEventIds.includes(e.id)).map((e) => e.id)
      : selectedEventIds;
    generateWith({ startDate, endDate, eventIds: effectiveEventIds, productIds: selectedProductIds, sources, onlyShortages, onlyImpacted, useEventTripDates });
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

  function applyShortcut(days: number) {
    const s = format(new Date(), "yyyy-MM-dd");
    const e = format(addDays(new Date(), days), "yyyy-MM-dd");
    setStartDate(s);
    setEndDate(e);
  }

  const dateShortcuts: Array<{ label: string; apply: () => void; matchFn?: () => boolean }> = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    return [
      {
        label: "Hoje",
        apply: () => { setStartDate(todayStr); setEndDate(todayStr); },
        matchFn: () => startDate === todayStr && endDate === todayStr,
      },
      { label: "7 dias", apply: () => applyShortcut(7), matchFn: () => startDate === todayStr && endDate === format(addDays(now, 7), "yyyy-MM-dd") },
      { label: "15 dias", apply: () => applyShortcut(15), matchFn: () => startDate === todayStr && endDate === format(addDays(now, 15), "yyyy-MM-dd") },
      { label: "30 dias", apply: () => applyShortcut(30), matchFn: () => startDate === todayStr && endDate === format(addDays(now, 30), "yyyy-MM-dd") },
      { label: "60 dias", apply: () => applyShortcut(60), matchFn: () => startDate === todayStr && endDate === format(addDays(now, 60), "yyyy-MM-dd") },
      {
        label: "Sem. atual",
        apply: () => {
          setStartDate(format(startOfWeek(now, { locale: ptBR }), "yyyy-MM-dd"));
          setEndDate(format(endOfWeek(now, { locale: ptBR }), "yyyy-MM-dd"));
        },
      },
      {
        label: "Próx. sem.",
        apply: () => {
          const next = addDays(endOfWeek(now, { locale: ptBR }), 1);
          setStartDate(format(startOfWeek(next, { locale: ptBR }), "yyyy-MM-dd"));
          setEndDate(format(endOfWeek(next, { locale: ptBR }), "yyyy-MM-dd"));
        },
      },
      {
        label: "Mês atual",
        apply: () => {
          setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
          setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        },
      },
      {
        label: "Próx. mês",
        apply: () => {
          const next = addMonths(now, 1);
          setStartDate(format(startOfMonth(next), "yyyy-MM-dd"));
          setEndDate(format(endOfMonth(next), "yyyy-MM-dd"));
        },
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function setConfigModePersist(mode: "quick" | "advanced") {
    setConfigMode(mode);
    try { sessionStorage.setItem("projection-config-mode", mode); } catch { /* noop */ }
  }

  const summaryChips = useMemo(() => {
    const chips: string[] = [];
    if (startDate && endDate) {
      const days = daysBetween(startDate, endDate);
      chips.push(`${days} dia${days !== 1 ? "s" : ""}`);
    }
    if (selectedEventIds.length > 0) {
      chips.push(`${selectedEventIds.length} evento${selectedEventIds.length !== 1 ? "s" : ""}`);
    }
    if (selectedProductIds.length > 0) {
      chips.push(`${selectedProductIds.length} produto${selectedProductIds.length !== 1 ? "s" : ""}`);
    }
    const activeSrc = Object.values(sources).filter(Boolean).length;
    chips.push(`${activeSrc} fonte${activeSrc !== 1 ? "s" : ""}`);
    if (useEventTripDates) chips.push("Modo Evento-Viagem");
    return chips;
  }, [startDate, endDate, selectedEventIds, selectedProductIds, sources, useEventTripDates]);

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
        {hasData && (
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            data-testid="button-export-excel"
          >
            <FileDown className="w-3.5 h-3.5 mr-1.5" />
            Exportar Excel
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

      {/* ── Filtros Avançados Sheet ── */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          className="w-full sm:w-[680px] p-0 flex flex-col"
          style={{ maxWidth: "min(760px, 96vw)" }}
          data-testid="filters-sheet"
        >
          {/* ── Cabeçalho fixo ── */}
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/40 flex-shrink-0 space-y-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Configurar projeção de estoque
            </SheetTitle>
            <SheetDescription className="text-xs">
              Defina o período e escolha exatamente quais operações devem entrar no cálculo.
            </SheetDescription>

            {/* Chips de resumo em tempo real */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {summaryChips.map((chip, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal px-2 py-0.5">
                  {chip}
                </Badge>
              ))}
            </div>

            {/* Toggle Rápido / Avançado */}
            <div className="flex gap-1 pt-1">
              <Button
                size="sm"
                variant={configMode === "quick" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setConfigModePersist("quick")}
                data-testid="button-mode-quick"
              >
                <Zap className="w-3 h-3 mr-1.5" /> Configuração rápida
              </Button>
              <Button
                size="sm"
                variant={configMode === "advanced" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setConfigModePersist("advanced")}
                data-testid="button-mode-advanced"
              >
                <SlidersHorizontal className="w-3 h-3 mr-1.5" /> Avançado
              </Button>
            </div>
          </SheetHeader>

          {/* ── Conteúdo rolável ── */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>

            {/* ════════ MODO RÁPIDO ════════ */}
            {configMode === "quick" && (
              <div className="px-5 py-4 space-y-5">
                {/* Período — atalhos */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CalendarRange className="w-4 h-4 text-primary/70" /> Período
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {dateShortcuts.map(({ label, apply, matchFn }) => (
                      <Button
                        key={label}
                        size="sm"
                        variant={matchFn?.() ? "default" : "outline"}
                        className="h-7 text-xs px-2.5"
                        onClick={apply}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <Label htmlFor="qs-start" className="text-xs text-muted-foreground">Início</Label>
                      <Input id="qs-start" type="date" value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className={`h-8 text-sm ${dateError ? "border-destructive" : ""}`}
                        data-testid="input-start-date" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="qs-end" className="text-xs text-muted-foreground">Fim</Label>
                      <Input id="qs-end" type="date" value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`h-8 text-sm ${dateError ? "border-destructive" : ""}`}
                        data-testid="input-end-date" />
                    </div>
                  </div>
                  {dateError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Data de início deve ser anterior à data fim
                    </p>
                  )}
                </section>

                <Separator />

                {/* Fontes rápidas */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary/70" /> Fontes da projeção
                    {!anySource && <span className="text-xs text-destructive font-normal">(selecione ao menos 1)</span>}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: "loadingOrders" as const, label: "Ordens de carregamento" },
                      { key: "requests" as const, label: "Requisições aprovadas" },
                      { key: "movements" as const, label: "Movimentações" },
                      { key: "trips" as const, label: "Planos de viagens avulsos" },
                    ] as const).map((s) => (
                      <label key={s.key}
                        className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors ${
                          sources[s.key] ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={sources[s.key]}
                          onCheckedChange={(v) => setSources((prev) => ({ ...prev, [s.key]: !!v }))}
                          data-testid={`checkbox-source-${s.key}`}
                        />
                        <span className="text-xs leading-tight">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <Separator />

                {/* Exibição */}
                <section className="space-y-1">
                  <h3 className="text-sm font-semibold mb-2">Exibição</h3>
                  <label htmlFor="qs-shortages" className="flex items-center gap-2.5 rounded px-1 py-1.5 cursor-pointer hover:bg-muted/50">
                    <Checkbox id="qs-shortages" checked={onlyShortages} onCheckedChange={(v) => setOnlyShortages(!!v)} data-testid="checkbox-only-shortages" />
                    <span className="text-sm">Apenas produtos em falta</span>
                  </label>
                  <label htmlFor="qs-impacted" className="flex items-center gap-2.5 rounded px-1 py-1.5 cursor-pointer hover:bg-muted/50">
                    <Checkbox id="qs-impacted" checked={onlyImpacted} onCheckedChange={(v) => setOnlyImpacted(!!v)} data-testid="checkbox-only-impacted" />
                    <span className="text-sm">Apenas produtos impactados</span>
                  </label>
                </section>
              </div>
            )}

            {/* ════════ MODO AVANÇADO ════════ */}
            {configMode === "advanced" && (
              <div className="divide-y divide-border/40">

                {/* ── SEÇÃO: Período ── */}
                <div>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-3.5 hover-elevate text-left"
                    onClick={() => toggleSection("period")}
                    data-testid="section-toggle-period"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <CalendarRange className="w-4 h-4 text-primary/70" /> Período
                      {startDate && endDate && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {fmtDateFull(startDate)} → {fmtDateFull(endDate)}
                        </span>
                      )}
                    </span>
                    {expandedSections.has("period") ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {expandedSections.has("period") && (
                    <div className="px-5 pb-5 space-y-3">
                      {/* Data inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="filter-start" className="text-xs">Data início</Label>
                          <Input id="filter-start" type="date" value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={`h-8 text-sm ${dateError ? "border-destructive" : ""}`}
                            data-testid="input-start-date" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="filter-end" className="text-xs">Data fim</Label>
                          <Input id="filter-end" type="date" value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={`h-8 text-sm ${dateError ? "border-destructive" : ""}`}
                            data-testid="input-end-date" />
                        </div>
                      </div>
                      {dateError && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Data de início deve ser anterior à data fim
                        </p>
                      )}

                      {/* Atalhos */}
                      <div className="flex flex-wrap gap-1.5">
                        {dateShortcuts.map(({ label, apply, matchFn }) => (
                          <Button
                            key={label}
                            size="sm"
                            variant={matchFn?.() ? "default" : "outline"}
                            className="h-7 text-xs px-2.5"
                            onClick={apply}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>

                      {/* Granularidade */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Granularidade da projeção</Label>
                        <div className="flex gap-1.5 flex-wrap">
                          {([
                            { value: "hour", label: "Por hora" },
                            { value: "shift", label: "Por turno" },
                            { value: "day", label: "Por dia" },
                            { value: "week", label: "Por semana" },
                          ] as const).map(({ value, label }) => (
                            <Button
                              key={value}
                              size="sm"
                              variant={granularity === value ? "default" : "outline"}
                              className="h-7 text-xs px-2.5"
                              onClick={() => setGranularity(value)}
                              data-testid={`btn-granularity-${value}`}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                        {granularity === "shift" && (
                          <div className="rounded-md bg-muted/40 border border-border/40 p-2.5 text-xs text-muted-foreground space-y-0.5">
                            <p className="font-medium text-foreground mb-1">Turnos configurados:</p>
                            <p>Madrugada: 00:00 – 05:59</p>
                            <p>Manhã: 06:00 – 11:59</p>
                            <p>Tarde: 12:00 – 17:59</p>
                            <p>Noite: 18:00 – 23:59</p>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">Máximo de 90 dias. Granularidade por hora/turno disponível em versão futura.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── SEÇÃO: Modo Evento-Viagem ── */}
                <div>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-3.5 hover-elevate text-left"
                    onClick={() => toggleSection("tripMode")}
                    data-testid="section-toggle-tripmode"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Truck className="w-4 h-4 text-primary/70" /> Modo Evento-Viagem
                      {useEventTripDates && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Ativo</Badge>
                      )}
                    </span>
                    {expandedSections.has("tripMode") ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {expandedSections.has("tripMode") && (
                    <div className="px-5 pb-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Utiliza as viagens vinculadas ao evento para identificar quando os materiais saem, permanecem fora e retornam ao estoque.
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">Regra aplicada:</span> Saída = 1ª viagem · Retorno = última viagem por evento
                          </p>
                        </div>
                        <Switch
                          checked={useEventTripDates}
                          onCheckedChange={(v) => {
                            setUseEventTripDates(v);
                            if (v) fetchEventsWithTrips(startDate, endDate);
                            else { setEventsWithTrips([]); setExcludedEventIds([]); }
                          }}
                          data-testid="switch-trip-mode"
                        />
                      </div>

                      {useEventTripDates && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground font-medium">
                              Eventos com viagens no período
                              {eventsWithTrips.length > 0 && (
                                <span className="ml-1 text-foreground">
                                  ({eventsWithTrips.length - excludedEventIds.length} de {eventsWithTrips.length} incluídos)
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-1">
                              {excludedEventIds.length > 0 && (
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                                  onClick={() => setExcludedEventIds([])}>
                                  Incluir todos
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                onClick={() => fetchEventsWithTrips(startDate, endDate)}
                                disabled={loadingEventsWithTrips}
                                data-testid="button-refresh-events-trips">
                                <RefreshCw className={`w-3 h-3 ${loadingEventsWithTrips ? "animate-spin" : ""}`} />
                              </Button>
                            </div>
                          </div>

                          {loadingEventsWithTrips ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Buscando eventos com viagens…
                            </div>
                          ) : eventsWithTrips.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center p-4 border border-border/60 rounded-md">
                              Nenhum evento com viagens no período selecionado
                            </div>
                          ) : (
                            <div className="border border-border/60 rounded-md divide-y divide-border/40">
                              {eventsWithTrips.map((ev) => {
                                const isExcluded = excludedEventIds.includes(ev.id);
                                const isExpanded = expandedTripEventIds.includes(ev.id);
                                return (
                                  <div key={ev.id} className={`transition-opacity ${isExcluded ? "opacity-50" : ""}`}>
                                    <div className="flex items-center gap-2 px-3 py-2.5">
                                      <Checkbox
                                        checked={!isExcluded}
                                        onCheckedChange={(v) =>
                                          setExcludedEventIds((prev) =>
                                            v ? prev.filter((x) => x !== ev.id) : [...prev, ev.id]
                                          )
                                        }
                                        data-testid={`checkbox-event-trip-${ev.id}`}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium leading-tight">{ev.name}</div>
                                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 mt-0.5">
                                          {ev.firstDepartureDate && ev.lastReturnDate
                                            ? <span>{ev.firstDepartureDate} → {ev.lastReturnDate}</span>
                                            : ev.firstDepartureDate
                                            ? <span>Saída {ev.firstDepartureDate}</span>
                                            : <span className="text-amber-500">Sem datas de viagem</span>}
                                          {ev.requestCount > 0 && <span>{ev.requestCount} req.</span>}
                                          {ev.trips.length > 0 && <span>{ev.trips.length} viagem{ev.trips.length > 1 ? "s" : ""}</span>}
                                        </div>
                                      </div>
                                      {ev.trips.length > 0 && (
                                        <button
                                          type="button"
                                          className="flex items-center gap-0.5 text-xs text-muted-foreground px-1.5 py-1 hover-elevate rounded"
                                          onClick={() =>
                                            setExpandedTripEventIds((prev) =>
                                              isExpanded ? prev.filter((x) => x !== ev.id) : [...prev, ev.id]
                                            )
                                          }
                                        >
                                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </button>
                                      )}
                                    </div>
                                    {isExpanded && ev.trips.length > 0 && (
                                      <div className="ml-9 mr-3 mb-2 space-y-1.5">
                                        {ev.trips.map((t) => (
                                          <div key={t.id} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                                            <Truck className="w-3 h-3 flex-shrink-0 text-primary/50" />
                                            <span className="truncate flex-1">{t.description || "Viagem sem descrição"}</span>
                                            <span className="whitespace-nowrap shrink-0 font-mono">
                                              {t.departureDate ?? "?"} → {t.returnDate ?? "?"}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── SEÇÃO: Fontes ── */}
                <div>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-3.5 hover-elevate text-left"
                    onClick={() => toggleSection("sources")}
                    data-testid="section-toggle-sources"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <BarChart3 className="w-4 h-4 text-primary/70" /> Fontes da projeção
                      {!anySource && <span className="text-xs font-normal text-destructive">(ao menos 1)</span>}
                    </span>
                    {expandedSections.has("sources") ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {expandedSections.has("sources") && (
                    <div className="px-5 pb-5 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Prioridade na deduplicação: Movimentações {'>'} Ordens {'>'} Requisições {'>'} Viagens.
                      </p>
                      {([
                        {
                          key: "loadingOrders" as const,
                          label: "Ordens de carregamento",
                          desc: "Ordens com status pronta, aprovada ou em andamento",
                          id: "src-loading",
                        },
                        {
                          key: "requests" as const,
                          label: "Requisições aprovadas",
                          desc: "Demanda planejada das requisições com aprovação total ou parcial",
                          id: "src-requests",
                        },
                        {
                          key: "movements" as const,
                          label: "Movimentações",
                          desc: "Movimentações físicas concluídas ou em andamento",
                          id: "src-movements",
                        },
                        {
                          key: "trips" as const,
                          label: "Planos de viagens avulsos",
                          desc: "Viagens sem vínculo a evento — baseadas apenas nos horários de saída e retorno",
                          id: "src-trips",
                        },
                      ] as const).map((s) => (
                        <label
                          key={s.key}
                          htmlFor={s.id}
                          className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                            sources[s.key] ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/30"
                          }`}
                        >
                          <Checkbox
                            id={s.id}
                            checked={sources[s.key]}
                            onCheckedChange={(v) => setSources((prev) => ({ ...prev, [s.key]: !!v }))}
                            className="mt-0.5"
                            data-testid={`checkbox-source-${s.key}`}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium leading-tight">{s.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── SEÇÃO: Eventos ── */}
                <div>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-3.5 hover-elevate text-left"
                    onClick={() => toggleSection("events")}
                    data-testid="section-toggle-events"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Calendar className="w-4 h-4 text-primary/70" /> Eventos
                      {selectedEventIds.length > 0
                        ? <Badge variant="secondary" className="text-xs">{selectedEventIds.length} selecionados</Badge>
                        : <span className="text-xs font-normal text-muted-foreground">todos do período</span>
                      }
                    </span>
                    {expandedSections.has("events") ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {expandedSections.has("events") && (
                    <div className="px-5 pb-5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Sem seleção = todos os eventos do período.
                        </p>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                            onClick={() => setSelectedEventIds((events || []).map((e: any) => e.id))}
                            data-testid="button-select-all-events">
                            Todos
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                            onClick={() => setSelectedEventIds([])}
                            disabled={selectedEventIds.length === 0}
                            data-testid="button-clear-events">
                            Limpar
                          </Button>
                        </div>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar evento, cliente ou local..."
                          value={eventSearch}
                          onChange={(e) => setEventSearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                          data-testid="input-event-search"
                        />
                      </div>
                      <div className="border border-border/60 rounded-md divide-y divide-border/40 max-h-64 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                        {filteredEvents.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            {!events?.length ? "Nenhum evento disponível" : "Nenhum resultado para a busca"}
                          </p>
                        ) : filteredEvents.map((event: any) => (
                          <label
                            key={event.id}
                            htmlFor={`ev-${event.id}`}
                            className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                              selectedEventIds.includes(event.id) ? "bg-primary/8" : "hover:bg-muted/40"
                            }`}
                          >
                            <Checkbox
                              id={`ev-${event.id}`}
                              checked={selectedEventIds.includes(event.id)}
                              onCheckedChange={() => toggleEvent(event.id)}
                              className="mt-0.5"
                              data-testid={`checkbox-event-${event.id}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm leading-tight font-medium">{event.name}</div>
                              <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground mt-0.5">
                                {event.eventDate && <span>{new Date(event.eventDate).toLocaleDateString("pt-BR")}</span>}
                                {event.location && <span>{event.location}</span>}
                                {event.client && <span>{event.client}</span>}
                              </div>
                            </div>
                            {selectedEventIds.includes(event.id) && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── SEÇÃO: Produtos ── */}
                <div>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-3.5 hover-elevate text-left"
                    onClick={() => toggleSection("products")}
                    data-testid="section-toggle-products"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Package className="w-4 h-4 text-primary/70" /> Produtos
                      {selectedProductIds.length > 0
                        ? <Badge variant="secondary" className="text-xs">{selectedProductIds.length} selecionados</Badge>
                        : <span className="text-xs font-normal text-muted-foreground">todos os impactados</span>
                      }
                    </span>
                    {expandedSections.has("products") ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {expandedSections.has("products") && (
                    <div className="px-5 pb-5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Sem seleção = todos os produtos impactados.
                        </p>
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                          onClick={() => setSelectedProductIds([])}
                          disabled={selectedProductIds.length === 0}
                          data-testid="button-clear-products">
                          Limpar
                        </Button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nome ou SKU..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                          data-testid="input-product-search"
                        />
                      </div>
                      <div className="border border-border/60 rounded-md divide-y divide-border/40 max-h-64 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                        {filteredProducts.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            {!products?.length ? "Nenhum produto disponível" : "Nenhum resultado para a busca"}
                          </p>
                        ) : filteredProducts.slice(0, 200).map((product: any) => (
                          <label
                            key={product.id}
                            htmlFor={`pr-${product.id}`}
                            className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                              selectedProductIds.includes(product.id) ? "bg-primary/8" : "hover:bg-muted/40"
                            }`}
                          >
                            <Checkbox
                              id={`pr-${product.id}`}
                              checked={selectedProductIds.includes(product.id)}
                              onCheckedChange={() => toggleProduct(product.id)}
                              data-testid={`checkbox-product-${product.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm leading-tight font-medium truncate">{product.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{product.sku}</div>
                            </div>
                            {selectedProductIds.includes(product.id) && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                          </label>
                        ))}
                        {filteredProducts.length > 200 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            Mostrando 200 de {filteredProducts.length}. Refine a busca.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── SEÇÃO: Exibição ── */}
                <div>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-3.5 hover-elevate text-left"
                    onClick={() => toggleSection("display")}
                    data-testid="section-toggle-display"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <LayoutGrid className="w-4 h-4 text-primary/70" /> Exibição
                      {(onlyShortages || onlyImpacted) && (
                        <Badge variant="secondary" className="text-xs">
                          {[onlyShortages && "apenas faltas", onlyImpacted && "apenas impactados"].filter(Boolean).join(" · ")}
                        </Badge>
                      )}
                    </span>
                    {expandedSections.has("display") ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {expandedSections.has("display") && (
                    <div className="px-5 pb-5 space-y-1">
                      <label htmlFor="only-shortages" className="flex items-center gap-2.5 rounded-md px-2 py-2.5 cursor-pointer hover:bg-muted/40">
                        <Checkbox id="only-shortages" checked={onlyShortages} onCheckedChange={(v) => setOnlyShortages(!!v)} data-testid="checkbox-only-shortages" />
                        <div>
                          <div className="text-sm">Apenas produtos em falta</div>
                          <div className="text-xs text-muted-foreground">Mostra somente produtos com saldo negativo no período</div>
                        </div>
                      </label>
                      <label htmlFor="only-impacted" className="flex items-center gap-2.5 rounded-md px-2 py-2.5 cursor-pointer hover:bg-muted/40">
                        <Checkbox id="only-impacted" checked={onlyImpacted} onCheckedChange={(v) => setOnlyImpacted(!!v)} data-testid="checkbox-only-impacted" />
                        <div>
                          <div className="text-sm">Apenas produtos impactados</div>
                          <div className="text-xs text-muted-foreground">Oculta produtos sem movimentação no período selecionado</div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* ── Rodapé fixo ── */}
          <SheetFooter className="px-5 py-4 border-t border-border/60 flex-shrink-0 flex-col gap-2">
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handleClearAllFilters} data-testid="button-clear-filters">
                <X className="w-3.5 h-3.5 mr-1.5" /> Limpar filtros
              </Button>
              <Button className="flex-1" onClick={handleApplyFilters} disabled={!canGenerate || isGenerating} data-testid="button-apply-filters">
                {isGenerating
                  ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Calculando...</>
                  : <><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Gerar projeção</>
                }
              </Button>
            </div>
            {!canGenerate && (
              <p className="text-xs text-destructive text-center">Selecione ao menos uma fonte de dados</p>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ProjectionDetailDrawer target={detail} onClose={() => setDetail(null)} onGoToProduct={openProduct} />
    </div>
  );
}

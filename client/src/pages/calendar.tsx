import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Truck,
  Package,
  ArrowLeftRight,
  Clock,
  Wrench,
  ExternalLink,
  AlertTriangle,
  X,
  PackagePlus,
  PackageOpen,
  Layers,
  AlarmClockOff,
  Navigation,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { StatusBadge } from "@/components/status-badge";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  start: string;
  end?: string;
  status: string;
  severity?: string;
  entityId: string;
  route: string;
  metadata?: Record<string, unknown>;
}

interface CalendarFilters {
  showEvents: boolean;
  showTrips: boolean;
  showLoadingOrders: boolean;
  showMovements: boolean;
  showWindows: boolean;
  eventId: string;
}

const DEFAULT_FILTERS: CalendarFilters = {
  showEvents: true,
  showTrips: true,
  showLoadingOrders: true,
  showMovements: true,
  showWindows: true,
  eventId: "",
};

// ── Semantic colour config ────────────────────────────────────────────────────

interface TypeConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  bgAlpha: string;
  dotTw: string;
  textTw: string;
  badgeTw: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  event: {
    label: "Evento",
    icon: CalendarDays,
    color: "#3B82F6",
    bgAlpha: "rgba(59,130,246,0.10)",
    dotTw: "bg-blue-500",
    textTw: "text-blue-400",
    badgeTw: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  },
  event_setup: {
    label: "Montagem",
    icon: Wrench,
    color: "#60A5FA",
    bgAlpha: "rgba(59,130,246,0.07)",
    dotTw: "bg-blue-400",
    textTw: "text-blue-300",
    badgeTw: "bg-blue-400/10 border-blue-400/25 text-blue-300",
  },
  event_teardown: {
    label: "Desmontagem",
    icon: Wrench,
    color: "#60A5FA",
    bgAlpha: "rgba(59,130,246,0.07)",
    dotTw: "bg-blue-400",
    textTw: "text-blue-300",
    badgeTw: "bg-blue-400/10 border-blue-400/25 text-blue-300",
  },
  trip_departure: {
    label: "Saída",
    icon: Truck,
    color: "#F59E0B",
    bgAlpha: "rgba(245,158,11,0.10)",
    dotTw: "bg-amber-400",
    textTw: "text-amber-400",
    badgeTw: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  },
  trip_loading: {
    label: "Carregamento",
    icon: PackagePlus,
    color: "#06B6D4",
    bgAlpha: "rgba(6,182,212,0.10)",
    dotTw: "bg-cyan-400",
    textTw: "text-cyan-400",
    badgeTw: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
  },
  trip_unloading: {
    label: "Descarregamento",
    icon: PackageOpen,
    color: "#10B981",
    bgAlpha: "rgba(16,185,129,0.10)",
    dotTw: "bg-emerald-400",
    textTw: "text-emerald-400",
    badgeTw: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  },
  loading_order: {
    label: "Ordem de Carga",
    icon: Layers,
    color: "#0EA5E9",
    bgAlpha: "rgba(14,165,233,0.10)",
    dotTw: "bg-sky-400",
    textTw: "text-sky-400",
    badgeTw: "bg-sky-500/10 border-sky-500/30 text-sky-400",
  },
  movement: {
    label: "Movimentação",
    icon: ArrowLeftRight,
    color: "#8B5CF6",
    bgAlpha: "rgba(139,92,246,0.10)",
    dotTw: "bg-violet-400",
    textTw: "text-violet-400",
    badgeTw: "bg-violet-500/10 border-violet-500/30 text-violet-400",
  },
  request_window_start: {
    label: "Janela abre",
    icon: Clock,
    color: "#F97316",
    bgAlpha: "rgba(249,115,22,0.10)",
    dotTw: "bg-orange-400",
    textTw: "text-orange-400",
    badgeTw: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  },
  request_window_end: {
    label: "Janela fecha",
    icon: AlarmClockOff,
    color: "#F97316",
    bgAlpha: "rgba(249,115,22,0.12)",
    dotTw: "bg-orange-400",
    textTw: "text-orange-400",
    badgeTw: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  },
};

const FALLBACK_CONFIG: TypeConfig = {
  label: "Outro",
  icon: CalendarDays,
  color: "#6B7280",
  bgAlpha: "rgba(107,114,128,0.07)",
  dotTw: "bg-muted-foreground",
  textTw: "text-muted-foreground",
  badgeTw: "bg-muted border-border/60 text-muted-foreground",
};

function getTypeConfig(type: string): TypeConfig {
  return TYPE_CONFIG[type] ?? FALLBACK_CONFIG;
}

// ── Type groups ───────────────────────────────────────────────────────────────

const TYPE_GROUPS: Record<string, string[]> = {
  events: ["event", "event_setup", "event_teardown"],
  trips: ["trip_departure", "trip_loading", "trip_unloading"],
  loading_orders: ["loading_order"],
  movements: ["movement"],
  windows: ["request_window_start", "request_window_end"],
};

const GROUP_SHORT_LABELS: Record<string, string> = {
  events: "eventos",
  trips: "viagens",
  loading_orders: "ordens",
  movements: "moviment.",
  windows: "janelas",
};

function getGroupForType(type: string): string {
  return (
    Object.entries(TYPE_GROUPS).find(([, types]) => types.includes(type))?.[0] ??
    "outros"
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(iso: string): string {
  return iso.slice(0, 10);
}

function buildGridDays(current: Date): Date[] {
  const first = startOfMonth(current);
  const last = endOfMonth(current);
  const gridStart = startOfWeek(first, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(last, { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

function tryDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function getPrimaryDateTime(item: CalItem): Date | null {
  const m = item.metadata ?? {};
  const pick = (key: string) => tryDate(m[key] ? String(m[key]) : null);
  if (item.type === "trip_departure") return pick("departureDateTime") ?? tryDate(item.start);
  if (item.type === "trip_loading") return pick("loadingStartTime") ?? tryDate(item.start);
  if (item.type === "trip_unloading") return pick("unloadingStartTime") ?? tryDate(item.start);
  return tryDate(item.start);
}

function fmtTime(d: Date | null): string | null {
  if (!d) return null;
  return format(d, "HH:mm");
}

function fmtDateTime(d: Date | null): string | null {
  if (!d) return null;
  return format(d, "dd/MM HH:mm", { locale: ptBR });
}

type TimePeriod = "morning" | "afternoon" | "evening" | "notime";

function getTimePeriod(d: Date | null): TimePeriod {
  if (!d) return "notime";
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
  notime: "Sem horário definido",
};

const PERIOD_ORDER: TimePeriod[] = ["morning", "afternoon", "evening", "notime"];

// ── CalendarItemChip ──────────────────────────────────────────────────────────

function CalendarItemChip({ item }: { item: CalItem }) {
  const cfg = getTypeConfig(item.type);
  const Icon = cfg.icon;
  const t = fmtTime(getPrimaryDateTime(item));
  const tooltipText = [
    cfg.label,
    item.title,
    item.subtitle,
    t,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="flex items-stretch overflow-hidden rounded-sm"
      title={tooltipText}
    >
      <div className="w-[3px] shrink-0" style={{ backgroundColor: cfg.color }} />
      <div
        className="flex items-center gap-1 px-1 py-0.5 flex-1 min-w-0"
        style={{ backgroundColor: cfg.bgAlpha }}
      >
        <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: cfg.color }} />
        <span
          className="truncate text-[10px] leading-tight font-medium"
          style={{ color: cfg.color }}
        >
          {cfg.label}
          {item.title ? `: ${item.title}` : ""}
        </span>
        {item.severity === "warning" && (
          <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-400" />
        )}
      </div>
    </div>
  );
}

// ── CalendarCell ──────────────────────────────────────────────────────────────

function CalendarCell({
  date,
  currentMonth,
  items,
  isSelected,
  onClick,
}: {
  date: Date;
  currentMonth: Date;
  items: CalItem[];
  isSelected: boolean;
  onClick: () => void;
}) {
  const today = isToday(date);
  const inMonth = isSameMonth(date, currentMonth);
  const MAX_VISIBLE = 3;
  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.slice(MAX_VISIBLE);
  const hasWarning = items.some((i) => i.severity === "warning");

  let overflowDesc = "";
  if (overflow.length > 0) {
    const counts: Record<string, number> = {};
    for (const item of overflow) {
      const g = getGroupForType(item.type);
      counts[g] = (counts[g] || 0) + 1;
    }
    overflowDesc = Object.entries(counts)
      .map(([g, n]) => `${n} ${GROUP_SHORT_LABELS[g] ?? g}`)
      .join(" · ");
  }

  return (
    <div
      onClick={onClick}
      data-testid={`cell-day-${format(date, "yyyy-MM-dd")}`}
      className={cn(
        "min-h-[90px] p-1.5 border-b border-r border-border/30 cursor-pointer transition-colors",
        inMonth ? "bg-card/20" : "bg-muted/5",
        isSelected && "ring-1 ring-inset ring-primary/50",
        "hover:bg-muted/20",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center justify-center text-xs font-semibold leading-none w-5 h-5 rounded-full",
              today &&
                "ring-2 ring-primary/70 ring-offset-1 ring-offset-background text-primary",
              !today && inMonth && "text-foreground",
              !today && !inMonth && "text-muted-foreground/35",
            )}
          >
            {format(date, "d")}
          </span>
          {today && (
            <span className="text-[9px] text-primary/60 font-medium leading-none">
              Hoje
            </span>
          )}
        </div>
        {hasWarning && (
          <AlertTriangle className="h-2.5 w-2.5 text-amber-400 shrink-0" />
        )}
      </div>

      <div className="space-y-0.5">
        {visible.map((item) => (
          <CalendarItemChip key={item.id} item={item} />
        ))}
        {overflow.length > 0 && (
          <div
            className="text-[9px] text-muted-foreground/60 px-1 pt-0.5 leading-tight"
            title={overflowDesc || undefined}
          >
            +{overflow.length} atividades
            {overflowDesc ? ` · ${overflowDesc}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DayPanel ──────────────────────────────────────────────────────────────────

function DayPanel({
  date,
  items,
  onClose,
}: {
  date: Date;
  items: CalItem[];
  onClose: () => void;
}) {
  const [, navigate] = useLocation();

  const periodGroups = useMemo<Record<TimePeriod, CalItem[]>>(() => {
    const groups: Record<TimePeriod, CalItem[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      notime: [],
    };
    for (const item of items) {
      const t = getPrimaryDateTime(item);
      groups[getTimePeriod(t)].push(item);
    }
    for (const key of PERIOD_ORDER) {
      groups[key].sort((a, b) => {
        const ta = getPrimaryDateTime(a);
        const tb = getPrimaryDateTime(b);
        if (!ta && !tb) return 0;
        if (!ta) return 1;
        if (!tb) return -1;
        return ta.getTime() - tb.getTime();
      });
    }
    return groups;
  }, [items]);

  const filledPeriods = PERIOD_ORDER.filter((p) => periodGroups[p].length > 0);

  return (
    <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-3">
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-base text-foreground leading-snug">
                {format(date, "EEEE, d 'de' MMMM", { locale: ptBR }).replace(
                  /^\w/,
                  (c) => c.toUpperCase(),
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {items.length === 0
                  ? "Nenhuma atividade"
                  : `${items.length} atividade${items.length !== 1 ? "s" : ""} planejada${items.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              data-testid="button-close-day-panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Sem atividades"
          description="Nenhum planejamento para este dia."
        />
      ) : (
        <div
          className="space-y-4 overflow-y-auto"
          style={{ scrollbarWidth: "thin" }}
        >
          {filledPeriods.map((period) => (
            <div key={period}>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 px-0.5">
                {PERIOD_LABELS[period]}
              </p>
              <div className="space-y-2">
                {periodGroups[period].map((item) => {
                  const cfg = getTypeConfig(item.type);
                  const Icon = cfg.icon;
                  const m = item.metadata ?? {};
                  const primaryTime = getPrimaryDateTime(item);
                  const driver = m.driver ? String(m.driver) : null;
                  const plate = m.plate ? String(m.plate) : null;
                  const vehicleType = m.vehicleType ? String(m.vehicleType) : null;
                  const location = m.location ? String(m.location) : null;
                  const loadStart = tryDate(m.loadingStartTime ? String(m.loadingStartTime) : null);
                  const loadEnd = tryDate(m.loadingEndTime ? String(m.loadingEndTime) : null);
                  const departure = tryDate(m.departureDateTime ? String(m.departureDateTime) : null);
                  const unloadStart = tryDate(m.unloadingStartTime ? String(m.unloadingStartTime) : null);
                  const unloadEnd = tryDate(m.unloadingEndTime ? String(m.unloadingEndTime) : null);

                  return (
                    <div
                      key={item.id}
                      className="relative rounded-md border border-border/60 hover-elevate cursor-pointer"
                      onClick={() => navigate(item.route)}
                      data-testid={`card-cal-item-${item.id}`}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md"
                        style={{ backgroundColor: cfg.color }}
                      />

                      <div className="pl-4 pr-3 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.badgeTw}`}
                          >
                            <Icon className="h-2.5 w-2.5" />
                            {cfg.label.toUpperCase()}
                          </span>
                          <StatusBadge status={item.status} />
                          {item.severity === "warning" && (
                            <AlertTriangle className="h-3 w-3 text-amber-400" />
                          )}
                        </div>

                        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                          {item.title}
                        </p>

                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.subtitle}
                          </p>
                        )}

                        {primaryTime && (
                          <p
                            className="text-xl font-bold tabular-nums mt-1.5 leading-none"
                            style={{ color: cfg.color }}
                          >
                            {fmtTime(primaryTime)}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="mt-2 pt-2 border-t border-border/30 space-y-1 text-[11px] text-muted-foreground">
                          {(vehicleType || plate) && (
                            <div className="flex items-center gap-1.5">
                              <Truck className="h-3 w-3 shrink-0 opacity-50" />
                              <span>
                                {[vehicleType, plate ? `(${plate})` : null]
                                  .filter(Boolean)
                                  .join(" ")}
                              </span>
                            </div>
                          )}
                          {driver && (
                            <div className="flex items-center gap-1.5">
                              <Navigation className="h-3 w-3 shrink-0 opacity-50" />
                              <span>{driver}</span>
                            </div>
                          )}
                          {item.type === "trip_loading" && loadStart && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 shrink-0 opacity-50" />
                              <span>
                                Carreg.: {fmtDateTime(loadStart)}
                                {loadEnd ? ` → ${fmtDateTime(loadEnd)}` : ""}
                              </span>
                            </div>
                          )}
                          {item.type === "trip_departure" && departure && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 shrink-0 opacity-50" />
                              <span>Saída: {fmtDateTime(departure)}</span>
                            </div>
                          )}
                          {item.type === "trip_unloading" && unloadStart && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 shrink-0 opacity-50" />
                              <span>
                                Descarg.: {fmtDateTime(unloadStart)}
                                {unloadEnd ? ` → ${fmtDateTime(unloadEnd)}` : ""}
                              </span>
                            </div>
                          )}
                          {location && (
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3 w-3 shrink-0 opacity-50" />
                              <span>{location}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end mt-2">
                          <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LEGEND_DEFS = [
  {
    key: "showEvents" as keyof CalendarFilters,
    group: "events",
    label: "Eventos",
    dotTw: "bg-blue-500",
    chipOn: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  },
  {
    key: "showTrips" as keyof CalendarFilters,
    group: "trips",
    label: "Saídas / Viagens",
    dotTw: "bg-amber-400",
    chipOn: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  },
  {
    key: "showLoadingOrders" as keyof CalendarFilters,
    group: "loading_orders",
    label: "Ordens de Carga",
    dotTw: "bg-sky-400",
    chipOn: "bg-sky-500/10 border-sky-500/30 text-sky-400",
  },
  {
    key: "showMovements" as keyof CalendarFilters,
    group: "movements",
    label: "Movimentações",
    dotTw: "bg-violet-400",
    chipOn: "bg-violet-500/10 border-violet-500/30 text-violet-400",
  },
  {
    key: "showWindows" as keyof CalendarFilters,
    group: "windows",
    label: "Janelas de Req.",
    dotTw: "bg-orange-400",
    chipOn: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  },
];

const COLOR_LEGEND = [
  { color: "#3B82F6", label: "Evento" },
  { color: "#F59E0B", label: "Saída" },
  { color: "#06B6D4", label: "Carregamento" },
  { color: "#10B981", label: "Descarregamento" },
  { color: "#0EA5E9", label: "Ordem de Carga" },
  { color: "#8B5CF6", label: "Movimentação" },
  { color: "#F97316", label: "Janela de requisição" },
];

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function OperationalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);

  const gridDays = useMemo(() => buildGridDays(currentDate), [currentDate]);
  const gridStart = gridDays[0];
  const gridEnd = gridDays[gridDays.length - 1];

  const { data, isLoading, isError } = useQuery<{ items: CalItem[] }>({
    queryKey: [
      "/api/calendar/operational",
      format(gridStart, "yyyy-MM-dd"),
      format(gridEnd, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: gridStart.toISOString(),
        endDate: gridEnd.toISOString(),
      });
      const res = await fetch(`/api/calendar/operational?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return res.json();
    },
  });

  const { data: eventsData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/events"],
  });

  const filteredItems = useMemo(() => {
    const all = data?.items ?? [];
    return all.filter((item) => {
      if (!filters.showEvents && TYPE_GROUPS.events.includes(item.type)) return false;
      if (!filters.showTrips && TYPE_GROUPS.trips.includes(item.type)) return false;
      if (!filters.showLoadingOrders && TYPE_GROUPS.loading_orders.includes(item.type)) return false;
      if (!filters.showMovements && TYPE_GROUPS.movements.includes(item.type)) return false;
      if (!filters.showWindows && TYPE_GROUPS.windows.includes(item.type)) return false;
      return true;
    });
  }, [data, filters]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, CalItem[]> = {};
    for (const item of filteredItems) {
      const key = toDateStr(item.start);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [filteredItems]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return [];
    return itemsByDate[format(selectedDate, "yyyy-MM-dd")] ?? [];
  }, [selectedDate, itemsByDate]);

  const countByGroup = useMemo(() => {
    const all = data?.items ?? [];
    const counts: Record<string, number> = {};
    for (const [group, types] of Object.entries(TYPE_GROUPS)) {
      counts[group] = all.filter((i) => types.includes(i.type)).length;
    }
    return counts;
  }, [data]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (!filters.showEvents) n++;
    if (!filters.showTrips) n++;
    if (!filters.showLoadingOrders) n++;
    if (!filters.showMovements) n++;
    if (!filters.showWindows) n++;
    if (filters.eventId) n++;
    return n;
  }, [filters]);

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Calendário Operacional"
        description="Agenda integrada de eventos, planos de viagens, ordens e movimentações"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            data-testid="button-today"
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-base font-semibold text-foreground min-w-[160px] text-center capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </span>
        </div>
      </PageHeader>

      {/* Filter bar — also serves as legend */}
      <FilterBar badgeCount={activeFilterCount} onClear={clearFilters}>
        <div className="lg:col-span-3 space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Tipo de atividade
          </p>
          <div className="flex flex-wrap gap-2">
            {LEGEND_DEFS.map(({ key, group, label, dotTw, chipOn }) => {
              const active = filters[key] as boolean;
              const count = countByGroup[group] ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, [key]: !p[key] }))}
                  data-testid={`toggle-${key}`}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all select-none cursor-pointer",
                    active
                      ? chipOn
                      : "bg-muted/40 border-border/40 text-muted-foreground opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0 transition-colors",
                      active ? dotTw : "bg-muted-foreground/40",
                    )}
                  />
                  {label}
                  {count > 0 && (
                    <span className="font-bold tabular-nums">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Evento
          </p>
          <Select
            value={filters.eventId || "all"}
            onValueChange={(v) =>
              setFilters((p) => ({ ...p, eventId: v === "all" ? "" : v }))
            }
          >
            <SelectTrigger
              className="h-9 text-sm bg-card border-border/60"
              data-testid="select-event-filter"
            >
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {(eventsData ?? []).map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {/* Calendar */}
      {isLoading ? (
        <PageLoading message="Carregando calendário..." />
      ) : isError ? (
        <EmptyState
          icon={CalendarDays}
          title="Erro ao carregar"
          description="Não foi possível buscar os dados do calendário."
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 min-h-0">
          <div className="flex-1 min-w-0">
            <Card className="border-border/60 overflow-hidden">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 bg-muted/20 border-b border-border/40">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r border-border/20 last:border-r-0"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid cells */}
              <div className="grid grid-cols-7 border-l border-t border-border/30">
                {gridDays.map((day) => (
                  <CalendarCell
                    key={day.toISOString()}
                    date={day}
                    currentMonth={currentDate}
                    items={itemsByDate[format(day, "yyyy-MM-dd")] ?? []}
                    isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
                    onClick={() =>
                      setSelectedDate(
                        selectedDate && isSameDay(day, selectedDate) ? null : day,
                      )
                    }
                  />
                ))}
              </div>
            </Card>

            {/* Colour legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
              {COLOR_LEGEND.map(({ color, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <div
                    className="w-[10px] h-[10px] rounded-[2px] shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day detail panel */}
          {selectedDate && (
            <DayPanel
              date={selectedDate}
              items={selectedDayItems}
              onClose={() => setSelectedDate(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

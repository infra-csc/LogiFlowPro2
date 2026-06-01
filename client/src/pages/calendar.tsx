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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_GROUPS: Record<string, string[]> = {
  events: ["event", "event_setup", "event_teardown"],
  trips: ["trip_loading", "trip_unloading"],
  loading_orders: ["loading_order"],
  movements: ["movement"],
  windows: ["request_window_start", "request_window_end"],
};

interface TypeDef {
  label: string;
  icon: React.ElementType;
  chip: string;
  dot: string;
}

const TYPE_CONFIG: Record<string, TypeDef> = {
  event: {
    label: "Evento",
    icon: CalendarDays,
    chip: "bg-primary/10 border-primary/30 text-primary",
    dot: "bg-primary",
  },
  event_setup: {
    label: "Montagem",
    icon: Wrench,
    chip: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    dot: "bg-blue-400",
  },
  event_teardown: {
    label: "Desmontagem",
    icon: Wrench,
    chip: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    dot: "bg-blue-400",
  },
  request_window_start: {
    label: "Janela abre",
    icon: Clock,
    chip: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    dot: "bg-orange-400",
  },
  request_window_end: {
    label: "Janela fecha",
    icon: Clock,
    chip: "bg-orange-500/15 border-orange-500/30 text-orange-400",
    dot: "bg-orange-400",
  },
  trip_loading: {
    label: "Carregamento",
    icon: Truck,
    chip: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    dot: "bg-amber-400",
  },
  trip_unloading: {
    label: "Descarregamento",
    icon: Truck,
    chip: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    dot: "bg-amber-400",
  },
  loading_order: {
    label: "Ordem",
    icon: Package,
    chip: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    dot: "bg-emerald-400",
  },
  movement: {
    label: "Movimentação",
    icon: ArrowLeftRight,
    chip: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    dot: "bg-purple-400",
  },
};

function getTypeConfig(type: string): TypeDef {
  return (
    TYPE_CONFIG[type] ?? {
      label: type,
      icon: CalendarDays,
      chip: "bg-muted border-border/60 text-muted-foreground",
      dot: "bg-muted-foreground",
    }
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

// ── CalendarItemChip (compact chip in grid cell) ─────────────────────────────

function CalendarItemChip({ item }: { item: CalItem }) {
  const cfg = getTypeConfig(item.type);
  const Icon = cfg.icon;
  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-tight border truncate ${cfg.chip}`}
      title={item.title}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{item.title}</span>
      {item.severity === "warning" && (
        <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-400" />
      )}
    </div>
  );
}

// ── DayPanel (right detail panel) ────────────────────────────────────────────

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

  const grouped = useMemo(() => {
    const groups: Record<string, CalItem[]> = {};
    for (const item of items) {
      const g = Object.entries(TYPE_GROUPS).find(([, types]) =>
        types.includes(item.type)
      )?.[0] ?? "outros";
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  }, [items]);

  const groupLabels: Record<string, string> = {
    events: "Eventos",
    trips: "Viagens",
    loading_orders: "Ordens de Carregamento",
    movements: "Movimentações",
    windows: "Janelas de Requisição",
    outros: "Outros",
  };

  return (
    <div className="w-full lg:w-80 shrink-0 flex flex-col gap-3">
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-base text-foreground">
                {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
                  .replace(/^\w/, (c) => c.toUpperCase())}
              </h3>
              <p className="text-xs text-muted-foreground">
                {items.length} item{items.length !== 1 ? "s" : ""} neste dia
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
          title="Sem itens"
          description="Nenhum planejamento para este dia."
        />
      ) : (
        <div
          className="space-y-3 overflow-y-auto"
          style={{ scrollbarWidth: "thin" }}
        >
          {Object.entries(grouped).map(([group, groupItems]) => (
            <div key={group}>
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2 px-1">
                {groupLabels[group]}
              </p>
              <div className="space-y-2">
                {groupItems.map((item) => {
                  const cfg = getTypeConfig(item.type);
                  const Icon = cfg.icon;
                  return (
                    <Card
                      key={item.id}
                      className="border-border/60 hover-elevate cursor-pointer"
                      onClick={() => navigate(item.route)}
                      data-testid={`card-cal-item-${item.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div
                            className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded flex items-center justify-center ${cfg.chip}`}
                          >
                            <Icon className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground leading-tight truncate">
                                  {item.title}
                                </p>
                                {item.subtitle && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {item.subtitle}
                                  </p>
                                )}
                              </div>
                              <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5" />
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 h-4"
                              >
                                {cfg.label}
                              </Badge>
                              <StatusBadge status={item.status} />
                              {item.severity === "warning" && (
                                <AlertTriangle className="h-3 w-3 text-amber-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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

// ── CalendarCell (single day in the grid) ────────────────────────────────────

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
  const overflow = items.length - MAX_VISIBLE;
  const hasWarning = items.some((i) => i.severity === "warning");

  return (
    <div
      onClick={onClick}
      data-testid={`cell-day-${format(date, "yyyy-MM-dd")}`}
      className={`
        min-h-[88px] p-1.5 border-b border-r border-border/30 cursor-pointer transition-colors
        ${inMonth ? "bg-card/30" : "bg-muted/10"}
        ${isSelected ? "ring-1 ring-inset ring-primary" : ""}
        ${today ? "bg-primary/5" : ""}
        hover:bg-muted/30
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`
            inline-flex items-center justify-center text-sm font-medium leading-none
            ${today
              ? "h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs"
              : inMonth
              ? "text-foreground"
              : "text-muted-foreground/40"
            }
          `}
        >
          {format(date, "d")}
        </span>
        {hasWarning && (
          <AlertTriangle className="h-2.5 w-2.5 text-amber-400 shrink-0" />
        )}
      </div>
      <div className="space-y-0.5">
        {visible.map((item) => (
          <CalendarItemChip key={item.id} item={item} />
        ))}
        {overflow > 0 && (
          <div className="text-[10px] text-muted-foreground px-1">
            +{overflow} mais
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OperationalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Grid covers Mon–Sun for all weeks visible in the month
  const gridDays = useMemo(() => buildGridDays(currentDate), [currentDate]);
  const gridStart = gridDays[0];
  const gridEnd = gridDays[gridDays.length - 1];

  // Fetch calendar data
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

  // Fetch events list for event filter
  const { data: eventsData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/events"],
  });

  // Apply client-side filters
  const filteredItems = useMemo(() => {
    const all = data?.items ?? [];
    return all.filter((item) => {
      if (!filters.showEvents && TYPE_GROUPS.events.includes(item.type)) return false;
      if (!filters.showTrips && TYPE_GROUPS.trips.includes(item.type)) return false;
      if (!filters.showLoadingOrders && TYPE_GROUPS.loading_orders.includes(item.type)) return false;
      if (!filters.showMovements && TYPE_GROUPS.movements.includes(item.type)) return false;
      if (!filters.showWindows && TYPE_GROUPS.windows.includes(item.type)) return false;
      if (filters.eventId && item.metadata?.["client"] === undefined) {
        // For non-event items, we can't filter by event easily without the metadata
      }
      return true;
    });
  }, [data, filters]);

  // Group filtered items by date string (YYYY-MM-DD)
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalItem[]> = {};
    for (const item of filteredItems) {
      const key = toDateStr(item.start);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [filteredItems]);

  // Items for selected day
  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return [];
    return itemsByDate[format(selectedDate, "yyyy-MM-dd")] ?? [];
  }, [selectedDate, itemsByDate]);

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

  const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <PageHeader
        title="Calendário Operacional"
        description="Agenda integrada de eventos, viagens, ordens e movimentações"
      >
        <div className="flex items-center gap-2">
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

      {/* Filter bar */}
      <FilterBar
        badgeCount={activeFilterCount}
        onClear={clearFilters}
      >
        {/* Category toggles — pills that act as both filter and legend */}
        <div className="lg:col-span-3 space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Mostrar no calendário
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "showEvents" as const,       label: "Eventos",        dot: "bg-primary",    chipOn: "bg-primary/10 border-primary/30 text-primary" },
                { key: "showTrips" as const,        label: "Viagens",        dot: "bg-amber-400",  chipOn: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
                { key: "showLoadingOrders" as const, label: "Ordens de Carga", dot: "bg-emerald-400", chipOn: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
                { key: "showMovements" as const,    label: "Movimentações",  dot: "bg-purple-400", chipOn: "bg-purple-500/10 border-purple-500/20 text-purple-400" },
                { key: "showWindows" as const,      label: "Janelas",        dot: "bg-orange-400", chipOn: "bg-orange-500/10 border-orange-500/20 text-orange-400" },
              ]
            ).map(({ key, label, dot, chipOn }) => {
              const active = filters[key];
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
                      : "bg-muted/40 border-border/40 text-muted-foreground opacity-50"
                  )}
                >
                  <span className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0 transition-colors",
                    active ? dot : "bg-muted-foreground/40"
                  )} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Event filter */}
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
            <SelectTrigger className="h-9 text-sm bg-card border-border/60" data-testid="select-event-filter">
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

      {/* Calendar + day panel */}
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
          {/* Calendar grid */}
          <div className="flex-1 min-w-0">
            <Card className="border-border/60 overflow-hidden">
              {/* Day names header */}
              <div className="grid grid-cols-7 bg-muted/30 border-b border-border/40">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r border-border/20 last:border-r-0"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days */}
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
                        selectedDate && isSameDay(day, selectedDate) ? null : day
                      )
                    }
                  />
                ))}
              </div>
            </Card>

            {/* Stats bar */}
            <div className="flex flex-wrap gap-3 mt-3">
              {[
                { key: "events", label: "Eventos", types: TYPE_GROUPS.events, dot: "bg-primary" },
                { key: "trips", label: "Viagens", types: TYPE_GROUPS.trips, dot: "bg-amber-400" },
                { key: "loading_orders", label: "Ordens", types: TYPE_GROUPS.loading_orders, dot: "bg-emerald-400" },
                { key: "movements", label: "Movimentações", types: TYPE_GROUPS.movements, dot: "bg-purple-400" },
                { key: "windows", label: "Janelas", types: TYPE_GROUPS.windows, dot: "bg-orange-400" },
              ].map(({ key, label, types, dot }) => {
                const count = filteredItems.filter((i) => types.includes(i.type)).length;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    data-testid={`stat-${key}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className="font-medium text-foreground">{count}</span>
                    {label}
                  </div>
                );
              })}
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

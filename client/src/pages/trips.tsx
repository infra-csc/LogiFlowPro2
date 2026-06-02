import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Plus, Truck, CalendarDays, MapPin, X, List,
  ArrowRight, CheckCircle2, Loader2, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import {
  format, startOfDay, endOfDay, parseISO, startOfWeek, endOfWeek,
  addWeeks, addDays, isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Trip, Event, Vehicle, VehicleType, Driver } from "@shared/schema";
import { TripDialog } from "@/components/trip-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FilterBar } from "@/components/filter-bar";
import {
  ToggleGroup, ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

interface TripWithRelations extends Trip {
  event?: Event;
  vehicle?: Vehicle;
  vehicleType?: VehicleType;
  driver?: Driver;
}

interface TripFilters {
  eventDate?: string;
  eventId?: string;
  movementDate?: string;
  statusGroup?: "planned" | "in_progress" | "completed";
}

interface CalendarTripEntry {
  trip: TripWithRelations;
  type: "loading" | "unloading" | "departure" | "event";
}

type ViewMode = "list" | "calendar";
type SortBy = "loading" | "unloading";
type CalendarPeriod = "week" | "biweekly";

const STATS = [
  {
    label: "Total",
    icon: Truck,
    key: undefined as undefined,
    filter: (_: TripWithRelations) => true,
  },
  {
    label: "Agendadas",
    icon: Clock,
    key: "planned" as const,
    filter: (t: TripWithRelations) => t.status === "planned",
  },
  {
    label: "Em Andamento",
    icon: Loader2,
    key: "in_progress" as const,
    filter: (t: TripWithRelations) =>
      ["loading", "loaded", "in_transit", "at_destination", "unloading"].includes(t.status),
  },
  {
    label: "Concluídas",
    icon: CheckCircle2,
    key: "completed" as const,
    filter: (t: TripWithRelations) => t.status === "completed",
  },
] as const;

export default function Trips() {
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | undefined>();
  const [filters, setFilters] = useState<TripFilters>({});
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("loading");
  const [calendarPeriod, setCalendarPeriod] = useState<CalendarPeriod>("week");
  const [calendarStartDate, setCalendarStartDate] = useState(
    startOfWeek(new Date(), { locale: ptBR })
  );

  const { data: trips, isLoading } = useQuery<TripWithRelations[]>({
    queryKey: ["/api/trips"],
  });

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.eventDate) count++;
    if (filters.eventId) count++;
    if (filters.movementDate) count++;
    if (filters.statusGroup) count++;
    return count;
  }, [filters]);

  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    return trips.filter((trip) => {
      if (filters.eventDate) {
        if (!trip.event?.eventDate) return false;
        const eventDate = startOfDay(new Date(trip.event.eventDate));
        const filterDate = startOfDay(parseISO(filters.eventDate));
        if (eventDate.getTime() !== filterDate.getTime()) return false;
      }
      if (filters.eventId && trip.eventId !== filters.eventId) return false;
      if (filters.movementDate) {
        const filterDate = startOfDay(parseISO(filters.movementDate));
        const filterDateEnd = endOfDay(parseISO(filters.movementDate));
        let match = false;
        if (trip.loadingStartTime) {
          const d = new Date(trip.loadingStartTime);
          if (d >= filterDate && d <= filterDateEnd) match = true;
        }
        if (trip.unloadingStartTime) {
          const d = new Date(trip.unloadingStartTime);
          if (d >= filterDate && d <= filterDateEnd) match = true;
        }
        if (!match) return false;
      }
      if (filters.statusGroup) {
        const inProgress = ["loading", "loaded", "in_transit", "at_destination", "unloading"];
        if (filters.statusGroup === "planned" && trip.status !== "planned") return false;
        if (filters.statusGroup === "in_progress" && !inProgress.includes(trip.status)) return false;
        if (filters.statusGroup === "completed" && trip.status !== "completed") return false;
      }
      return true;
    });
  }, [trips, filters]);

  const sortedTrips = useMemo(() => {
    return [...filteredTrips].sort((a, b) => {
      const dateA =
        sortBy === "loading"
          ? a.loadingStartTime
            ? new Date(a.loadingStartTime).getTime()
            : Infinity
          : a.unloadingStartTime
          ? new Date(a.unloadingStartTime).getTime()
          : Infinity;
      const dateB =
        sortBy === "loading"
          ? b.loadingStartTime
            ? new Date(b.loadingStartTime).getTime()
            : Infinity
          : b.unloadingStartTime
          ? new Date(b.unloadingStartTime).getTime()
          : Infinity;
      return dateA - dateB;
    });
  }, [filteredTrips, sortBy]);

  const calendarEndDate = useMemo(() => {
    if (calendarPeriod === "week") return endOfWeek(calendarStartDate, { locale: ptBR });
    return endOfWeek(addWeeks(calendarStartDate, 1), { locale: ptBR });
  }, [calendarStartDate, calendarPeriod]);

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let cur = calendarStartDate;
    while (cur <= calendarEndDate) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    return days;
  }, [calendarStartDate, calendarEndDate]);

  const tripsByDate = useMemo(() => {
    const grouped: Record<string, CalendarTripEntry[]> = {};
    sortedTrips.forEach((trip) => {
      let placed = false;
      if (trip.loadingStartTime) {
        const key = format(new Date(trip.loadingStartTime), "yyyy-MM-dd");
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ trip, type: "loading" });
        placed = true;
      }
      if (trip.unloadingStartTime) {
        const key = format(new Date(trip.unloadingStartTime), "yyyy-MM-dd");
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ trip, type: "unloading" });
        placed = true;
      }
      if (!placed && trip.departureDateTime) {
        const key = format(new Date(trip.departureDateTime), "yyyy-MM-dd");
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ trip, type: "departure" });
        placed = true;
      }
      if (!placed && trip.event?.eventDate) {
        const key = format(new Date(trip.event.eventDate), "yyyy-MM-dd");
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ trip, type: "event" });
      }
    });
    return grouped;
  }, [sortedTrips]);

  const handleEdit = (trip: Trip) => {
    setSelectedTrip(trip);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedTrip(undefined);
    setShowDialog(false);
  };

  const clearFilters = () => setFilters({});

  const navigateCalendar = (dir: "prev" | "next") => {
    const weeks = calendarPeriod === "week" ? 1 : 2;
    setCalendarStartDate(addWeeks(calendarStartDate, dir === "next" ? weeks : -weeks));
  };

  const goToToday = () => setCalendarStartDate(startOfWeek(new Date(), { locale: ptBR }));

  if (isLoading) return <PageLoading message="Carregando viagens..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planejamento de Transporte"
        description="Agende e gerencie viagens, veículos, rotas e carregamentos."
      >
        {canWrite && (
          <Button onClick={() => setShowDialog(true)} data-testid="button-create-trip">
            <Plus className="h-4 w-4 mr-2" />
            Planejar Viagem
          </Button>
        )}
      </PageHeader>

      {/* Stats */}
      {trips && trips.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map(({ label, icon: Icon, key, filter }) => {
            const count = trips.filter(filter).length;
            const active = filters.statusGroup === key && key !== undefined;
            return (
              <Card
                key={label}
                className={`border-border/60 hover-elevate cursor-pointer transition-all ${
                  active ? "ring-1 ring-primary border-primary/40" : ""
                }`}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    statusGroup: prev.statusGroup === key ? undefined : key,
                  }))
                }
                data-testid={`stat-card-${label.toLowerCase().replace(/ /g, "-")}`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-primary/70" />
                  </div>
                  <div>
                    <div className="text-xl font-bold tabular-nums leading-none">{count}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Controls bar */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* View toggle */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
              className="border border-border/60 rounded-md p-0.5"
            >
              <ToggleGroupItem
                value="list"
                aria-label="Lista"
                className="px-3 py-1.5 text-sm rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                data-testid="toggle-view-list"
              >
                <List className="h-3.5 w-3.5 mr-1.5" />
                Lista
              </ToggleGroupItem>
              <ToggleGroupItem
                value="calendar"
                aria-label="Calendário"
                className="px-3 py-1.5 text-sm rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                data-testid="toggle-view-calendar"
              >
                <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                Calendário
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Sort (only in list) */}
            {viewMode === "list" && (
              <div className="flex items-center gap-2">
                <Label htmlFor="sort-by" className="text-xs text-muted-foreground whitespace-nowrap">
                  Ordenar por
                </Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                  <SelectTrigger id="sort-by" className="w-[180px] h-8 text-sm" data-testid="select-sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loading">Data de Carregamento</SelectItem>
                    <SelectItem value="unloading">Data de Descarregamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Calendar period */}
            {viewMode === "calendar" && (
              <div className="flex items-center gap-2">
                <Label htmlFor="calendar-period" className="text-xs text-muted-foreground whitespace-nowrap">
                  Período
                </Label>
                <Select
                  value={calendarPeriod}
                  onValueChange={(v) => setCalendarPeriod(v as CalendarPeriod)}
                >
                  <SelectTrigger
                    id="calendar-period"
                    className="w-[130px] h-8 text-sm"
                    data-testid="select-calendar-period"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="biweekly">Quinzena</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <FilterBar badgeCount={activeFilterCount} onClear={clearFilters}>
        {/* Status */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-status" className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filters.statusGroup || "all"}
            onValueChange={(v) =>
              setFilters((p) => ({
                ...p,
                statusGroup: v === "all" ? undefined : (v as TripFilters["statusGroup"]),
              }))
            }
          >
            <SelectTrigger id="filter-status" className="h-8 text-sm" data-testid="select-filter-status">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="planned">Agendadas</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Evento */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-event" className="text-xs text-muted-foreground">Evento</Label>
          <Select
            value={filters.eventId || "all"}
            onValueChange={(v) =>
              setFilters((p) => ({ ...p, eventId: v === "all" ? undefined : v }))
            }
          >
            <SelectTrigger id="filter-event" className="h-8 text-sm" data-testid="select-filter-event">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {events?.map((ev) => (
                <SelectItem key={ev.id} value={String(ev.id)}>
                  {ev.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data do Evento */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-event-date" className="text-xs text-muted-foreground">Data do Evento</Label>
          <div className="flex gap-1">
            <Input
              id="filter-event-date"
              type="date"
              value={filters.eventDate || ""}
              onChange={(e) =>
                setFilters((p) => ({ ...p, eventDate: e.target.value || undefined }))
              }
              className="h-8 text-sm flex-1"
              data-testid="input-filter-event-date"
            />
            {filters.eventDate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFilters((p) => ({ ...p, eventDate: undefined }))}
                data-testid="button-clear-event-date"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Data de Movimentação */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-movement-date" className="text-xs text-muted-foreground">
            Movimentações do Dia
          </Label>
          <div className="flex gap-1">
            <Input
              id="filter-movement-date"
              type="date"
              value={filters.movementDate || ""}
              onChange={(e) =>
                setFilters((p) => ({ ...p, movementDate: e.target.value || undefined }))
              }
              className="h-8 text-sm flex-1"
              data-testid="input-filter-movement-date"
            />
            {filters.movementDate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFilters((p) => ({ ...p, movementDate: undefined }))}
                data-testid="button-clear-movement-date"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Carregamento ou descarregamento</p>
        </div>
      </FilterBar>

      {/* ── LISTA ── */}
      {viewMode === "list" && (
        <>
          {sortedTrips.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={activeFilterCount > 0 ? "Nenhuma viagem encontrada" : "Nenhuma viagem agendada"}
              description={
                activeFilterCount > 0
                  ? "Tente ajustar os filtros para ver mais resultados."
                  : "Comece a planejar o transporte para seus eventos."
              }
              action={
                activeFilterCount === 0 && canWrite
                  ? { label: "Planejar Viagem", onClick: () => setShowDialog(true) }
                  : activeFilterCount > 0
                  ? { label: "Limpar filtros", onClick: clearFilters }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {sortedTrips.map((trip) => (
                <Card
                  key={trip.id}
                  className="border-border/60 hover-elevate"
                  data-testid={`card-trip-${trip.id}`}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <StatusBadge status={trip.status} />
                          {trip.event?.name && (
                            <span className="text-xs text-muted-foreground truncate">
                              {trip.event.name}
                            </span>
                          )}
                        </div>
                        {trip.description ? (
                          <h3 className="font-semibold text-base text-foreground">
                            {trip.description}
                          </h3>
                        ) : (
                          <h3 className="font-semibold text-base text-foreground">
                            {trip.event?.name || "Viagem sem descrição"}
                          </h3>
                        )}

                        {/* Rota */}
                        {(trip.loadingLocation || trip.unloadingLocation) && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 flex-wrap">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-primary/60" />
                            <span className="truncate max-w-[140px]">
                              {trip.loadingLocation || "—"}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[140px]">
                              {trip.unloadingLocation || "—"}
                            </span>
                            {(trip as any).destinations?.length > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 h-4">
                                +{(trip as any).destinations.length} destino
                                {(trip as any).destinations.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(trip)}
                          aria-label="Editar viagem"
                          data-testid={`button-edit-trip-${trip.id}`}
                        >
                          Editar
                        </Button>
                      )}
                    </div>

                    {/* Metadados */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-border/40 flex-wrap">
                      <div>
                        <p className="text-xs text-muted-foreground">Veículo</p>
                        <p className="text-sm font-medium leading-tight">
                          {trip.vehicleType?.name || "—"}
                        </p>
                        {trip.vehicle?.plate && (
                          <p className="text-xs text-muted-foreground font-mono">{trip.vehicle.plate}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Motorista</p>
                        <p className="text-sm font-medium leading-tight">{trip.driver?.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Carregamento</p>
                        {trip.loadingStartTime ? (
                          <>
                            <p className="text-sm font-medium leading-tight">
                              {format(new Date(trip.loadingStartTime), "dd/MM/yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(trip.loadingStartTime), "HH:mm")}
                              {trip.loadingEndTime &&
                                ` – ${format(new Date(trip.loadingEndTime), "HH:mm")}`}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-medium">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Descarregamento</p>
                        {trip.unloadingStartTime ? (
                          <>
                            <p className="text-sm font-medium leading-tight">
                              {format(new Date(trip.unloadingStartTime), "dd/MM/yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(trip.unloadingStartTime), "HH:mm")}
                              {trip.unloadingEndTime &&
                                ` – ${format(new Date(trip.unloadingEndTime), "HH:mm")}`}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-medium">—</p>
                        )}
                      </div>
                    </div>

                    {trip.notes && (
                      <div className="mt-2 pt-2 border-t border-border/40">
                        <p className="text-xs text-muted-foreground">{trip.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CALENDÁRIO ── */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          {/* Navegação */}
          <Card className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateCalendar("prev")}
                  data-testid="button-calendar-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <p className="font-semibold text-sm">
                    {format(calendarStartDate, "dd 'de' MMMM", { locale: ptBR })} –{" "}
                    {format(calendarEndDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToToday}
                    className="h-6 text-xs mt-0.5"
                    data-testid="button-calendar-today"
                  >
                    Hoje
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateCalendar("next")}
                  data-testid="button-calendar-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Grade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-7 gap-3">
            {calendarDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayTrips = tripsByDate[dayKey] || [];
              const isToday = isSameDay(day, new Date());

              return (
                <Card
                  key={dayKey}
                  className={`border-border/60 ${isToday ? "ring-1 ring-primary border-primary/40" : ""}`}
                  data-testid={`calendar-day-${dayKey}`}
                >
                  <div className="p-3 pb-2">
                    <div className="text-xs font-normal flex items-center justify-between">
                      <span className="capitalize text-muted-foreground">
                        {format(day, "EEE", { locale: ptBR })}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          isToday
                            ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                            : "text-foreground"
                        }`}
                      >
                        {format(day, "dd")}
                      </span>
                    </div>
                    {dayTrips.length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {dayTrips.length} viagem{dayTrips.length !== 1 ? "ns" : ""}
                      </div>
                    )}
                  </div>
                  <CardContent
                    className="p-2 pt-0 space-y-1.5"
                    style={{ scrollbarWidth: "thin" }}
                  >
                    {dayTrips.length === 0 ? (
                      <div className="py-3 text-center">
                        <div className="w-1 h-1 rounded-full bg-border mx-auto" />
                      </div>
                    ) : (
                      dayTrips.map((entry, idx) => (
                        <button
                          key={`${entry.trip.id}-${entry.type}-${idx}`}
                          type="button"
                          className={`w-full text-left p-2 rounded-md border border-border/60 hover-elevate ${
                            canWrite ? "cursor-pointer" : "cursor-default"
                          } ${entry.type === "loading" ? "bg-primary/5" : "bg-chart-2/5"}`}
                          onClick={canWrite ? () => handleEdit(entry.trip) : undefined}
                          data-testid={`calendar-trip-${entry.trip.id}-${entry.type}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                entry.type === "loading"
                                  ? "bg-primary/15 text-primary"
                                  : entry.type === "unloading"
                                  ? "bg-chart-2/15 text-chart-2"
                                  : entry.type === "departure"
                                  ? "bg-chart-5/15 text-chart-5"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {entry.type === "loading"
                                ? "CARGA"
                                : entry.type === "unloading"
                                ? "DESC"
                                : entry.type === "departure"
                                ? "SAÍDA"
                                : "EVENTO"}
                            </span>
                          </div>
                          <p className="text-xs font-medium leading-tight line-clamp-2">
                            {entry.trip.description || entry.trip.event?.name || "Viagem"}
                          </p>
                          {(() => {
                            const t = entry.trip;
                            const saida = t.departureDateTime ?? t.loadingStartTime ?? null;
                            const volta = t.unloadingStartTime ?? t.unloadingEndTime ?? null;
                            if (!saida && !volta) return null;
                            return (
                              <div className="mt-1.5 space-y-0.5">
                                {saida && (
                                  <div
                                    className="flex items-center gap-1 text-[10px] text-muted-foreground"
                                    data-testid={`text-trip-departure-${entry.trip.id}-${entry.type}`}
                                  >
                                    <Truck className="h-2.5 w-2.5 shrink-0 text-chart-5" />
                                    <span className="font-semibold text-foreground">Saída</span>
                                    <span>
                                      {format(new Date(saida), "dd/MM HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                )}
                                {volta && (
                                  <div
                                    className="flex items-center gap-1 text-[10px] text-muted-foreground"
                                    data-testid={`text-trip-return-${entry.trip.id}-${entry.type}`}
                                  >
                                    <Clock className="h-2.5 w-2.5 shrink-0 text-chart-2" />
                                    <span className="font-semibold text-foreground">Volta</span>
                                    <span>
                                      {format(new Date(volta), "dd/MM HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <StatusBadge
                            status={entry.trip.status}
                            className="mt-1 text-[10px] px-1.5 py-0.5 h-auto"
                          />
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <TripDialog open={showDialog} onOpenChange={handleClose} trip={selectedTrip} />
    </div>
  );
}

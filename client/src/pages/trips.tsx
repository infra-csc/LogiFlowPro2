import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Truck, Calendar, MapPin, Filter, X, List, CalendarDays, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format, startOfDay, endOfDay, parseISO, startOfWeek, endOfWeek, addWeeks, addDays, isSameDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Trip, Event, Vehicle, VehicleType, Driver } from "@shared/schema";
import { TripDialog } from "@/components/trip-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

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
}

interface CalendarTripEntry {
  trip: TripWithRelations;
  type: "loading" | "unloading";
}

type ViewMode = "list" | "calendar";
type SortBy = "loading" | "unloading";
type CalendarPeriod = "week" | "biweekly";

export default function Trips() {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<TripFilters>({});
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("loading");
  const [calendarPeriod, setCalendarPeriod] = useState<CalendarPeriod>("week");
  const [calendarStartDate, setCalendarStartDate] = useState(startOfWeek(new Date(), { locale: ptBR }));

  const { data: trips, isLoading } = useQuery<TripWithRelations[]>({
    queryKey: ["/api/trips"],
  });

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.eventDate) count++;
    if (filters.eventId) count++;
    if (filters.movementDate) count++;
    return count;
  }, [filters]);

  // Apply filters
  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    
    return trips.filter((trip) => {
      // Filter by event date
      if (filters.eventDate) {
        if (!trip.event?.eventDate) return false;
        const eventDate = startOfDay(new Date(trip.event.eventDate));
        const filterDate = startOfDay(parseISO(filters.eventDate));
        if (eventDate.getTime() !== filterDate.getTime()) return false;
      }

      // Filter by event
      if (filters.eventId && trip.eventId !== filters.eventId) {
        return false;
      }

      // Filter by movement date (loading or unloading)
      if (filters.movementDate) {
        const filterDate = startOfDay(parseISO(filters.movementDate));
        const filterDateEnd = endOfDay(parseISO(filters.movementDate));
        
        let matchesMovementDate = false;
        
        // Check loading date
        if (trip.loadingStartTime) {
          const loadingDate = new Date(trip.loadingStartTime);
          if (loadingDate >= filterDate && loadingDate <= filterDateEnd) {
            matchesMovementDate = true;
          }
        }
        
        // Check unloading date
        if (trip.unloadingStartTime) {
          const unloadingDate = new Date(trip.unloadingStartTime);
          if (unloadingDate >= filterDate && unloadingDate <= filterDateEnd) {
            matchesMovementDate = true;
          }
        }
        
        if (!matchesMovementDate) return false;
      }

      return true;
    });
  }, [trips, filters]);

  // Sort trips
  const sortedTrips = useMemo(() => {
    if (!filteredTrips) return [];
    
    return [...filteredTrips].sort((a, b) => {
      const dateA = sortBy === "loading" 
        ? (a.loadingStartTime ? new Date(a.loadingStartTime).getTime() : Infinity)
        : (a.unloadingStartTime ? new Date(a.unloadingStartTime).getTime() : Infinity);
      const dateB = sortBy === "loading"
        ? (b.loadingStartTime ? new Date(b.loadingStartTime).getTime() : Infinity)
        : (b.unloadingStartTime ? new Date(b.unloadingStartTime).getTime() : Infinity);
      
      return dateA - dateB;
    });
  }, [filteredTrips, sortBy]);

  // Calendar period calculation
  const calendarEndDate = useMemo(() => {
    if (calendarPeriod === "week") {
      return endOfWeek(calendarStartDate, { locale: ptBR });
    } else {
      return endOfWeek(addWeeks(calendarStartDate, 1), { locale: ptBR });
    }
  }, [calendarStartDate, calendarPeriod]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = [];
    let currentDay = calendarStartDate;
    
    while (currentDay <= calendarEndDate) {
      days.push(currentDay);
      currentDay = addDays(currentDay, 1);
    }
    
    return days;
  }, [calendarStartDate, calendarEndDate]);

  // Group trips by date for calendar view
  const tripsByDate = useMemo(() => {
    const grouped: Record<string, CalendarTripEntry[]> = {};
    
    sortedTrips.forEach((trip) => {
      // Add loading entry
      if (trip.loadingStartTime) {
        const loadingDateKey = format(new Date(trip.loadingStartTime), "yyyy-MM-dd");
        if (!grouped[loadingDateKey]) {
          grouped[loadingDateKey] = [];
        }
        grouped[loadingDateKey].push({ trip, type: "loading" });
      }
      
      // Add unloading entry
      if (trip.unloadingStartTime) {
        const unloadingDateKey = format(new Date(trip.unloadingStartTime), "yyyy-MM-dd");
        if (!grouped[unloadingDateKey]) {
          grouped[unloadingDateKey] = [];
        }
        grouped[unloadingDateKey].push({ trip, type: "unloading" });
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

  const clearFilters = () => {
    setFilters({});
  };

  const navigateCalendar = (direction: "prev" | "next") => {
    const weeksToAdd = calendarPeriod === "week" ? 1 : 2;
    setCalendarStartDate(
      direction === "next"
        ? addWeeks(calendarStartDate, weeksToAdd)
        : addWeeks(calendarStartDate, -weeksToAdd)
    );
  };

  const goToToday = () => {
    setCalendarStartDate(startOfWeek(new Date(), { locale: ptBR }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando viagens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Planejamento de Transporte</h1>
          <p className="text-sm text-muted-foreground mt-1">Agende e gerencie a logística de veículos e rotas</p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-trip">
          <Plus className="h-4 w-4 mr-2" />
          Planejar Viagem
        </Button>
      </div>

      {/* View Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as ViewMode)}>
                <ToggleGroupItem value="list" aria-label="Visualização em lista" data-testid="toggle-view-list">
                  <List className="h-4 w-4 mr-2" />
                  Lista
                </ToggleGroupItem>
                <ToggleGroupItem value="calendar" aria-label="Visualização em calendário" data-testid="toggle-view-calendar">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Calendário
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="flex items-center gap-2">
                <Label htmlFor="sort-by" className="text-sm whitespace-nowrap">Ordenar por:</Label>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                  <SelectTrigger id="sort-by" className="w-[180px]" data-testid="select-sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loading">Data de Carregamento</SelectItem>
                    <SelectItem value="unloading">Data de Descarregamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {viewMode === "calendar" && (
              <div className="flex items-center gap-2">
                <Label htmlFor="calendar-period" className="text-sm whitespace-nowrap">Período:</Label>
                <Select value={calendarPeriod} onValueChange={(value) => setCalendarPeriod(value as CalendarPeriod)}>
                  <SelectTrigger id="calendar-period" className="w-[140px]" data-testid="select-calendar-period">
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

      {/* Filters Panel */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="button-toggle-filters"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-2" data-testid="badge-filter-count">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </CollapsibleTrigger>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Event Filter */}
                <div className="space-y-2">
                  <Label htmlFor="filter-event">Evento</Label>
                  <Select
                    value={filters.eventId || "all"}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, eventId: value === "all" ? undefined : value }))
                    }
                  >
                    <SelectTrigger id="filter-event" data-testid="select-filter-event">
                      <SelectValue placeholder="Todos os eventos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os eventos</SelectItem>
                      {events?.map((event) => (
                        <SelectItem key={event.id} value={String(event.id)}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Event Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="filter-event-date">Data do Evento</Label>
                  <div className="flex gap-2">
                    <Input
                      id="filter-event-date"
                      type="date"
                      value={filters.eventDate || ""}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          eventDate: e.target.value || undefined,
                        }))
                      }
                      className="flex-1"
                      data-testid="input-filter-event-date"
                    />
                    {filters.eventDate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setFilters((prev) => ({ ...prev, eventDate: undefined }))
                        }
                        data-testid="button-clear-event-date"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Movement Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="filter-movement-date">Movimentações do Dia</Label>
                  <div className="flex gap-2">
                    <Input
                      id="filter-movement-date"
                      type="date"
                      value={filters.movementDate || ""}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          movementDate: e.target.value || undefined,
                        }))
                      }
                      className="flex-1"
                      data-testid="input-filter-movement-date"
                    />
                    {filters.movementDate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setFilters((prev) => ({ ...prev, movementDate: undefined }))
                        }
                        data-testid="button-clear-movement-date"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Filtra por data de carregamento ou descarregamento
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* List View */}
      {viewMode === "list" && (
        <>
          {!sortedTrips || sortedTrips.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Truck className="h-16 w-16 mx-auto text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">
                    {activeFilterCount > 0 ? "Nenhuma viagem encontrada" : "Nenhuma viagem agendada"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {activeFilterCount > 0
                      ? "Tente ajustar os filtros para ver mais resultados"
                      : "Comece a planejar o transporte para seus eventos"}
                  </p>
                  {activeFilterCount === 0 && (
                    <Button onClick={() => setShowDialog(true)} className="mt-4" data-testid="button-plan-first-trip">
                      <Plus className="h-4 w-4 mr-2" />
                      Planejar Viagem
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedTrips.map((trip) => (
                <Card 
                  key={trip.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => handleEdit(trip)}
                  data-testid={`card-trip-${trip.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Truck className="h-5 w-5 text-primary" />
                          <span className="text-lg font-semibold">{trip.event?.name || "Trip"}</span>
                        </div>
                        {trip.description && (
                          <p className="text-sm text-muted-foreground">{trip.description}</p>
                        )}
                      </div>
                      <StatusBadge status={trip.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Tipo de Veículo</p>
                        <p className="text-sm font-medium">{trip.vehicleType?.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Período de Carregamento</p>
                        <p className="text-sm font-medium">
                          {trip.loadingStartTime && trip.loadingEndTime
                            ? `${format(new Date(trip.loadingStartTime), "dd/MM HH:mm")} - ${format(new Date(trip.loadingEndTime), "HH:mm")}`
                            : trip.loadingStartTime
                            ? format(new Date(trip.loadingStartTime), "dd/MM/yyyy HH:mm")
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Período de Descarregamento</p>
                        <p className="text-sm font-medium">
                          {trip.unloadingStartTime && trip.unloadingEndTime
                            ? `${format(new Date(trip.unloadingStartTime), "dd/MM HH:mm")} - ${format(new Date(trip.unloadingEndTime), "HH:mm")}`
                            : trip.unloadingStartTime
                            ? format(new Date(trip.unloadingStartTime), "dd/MM/yyyy HH:mm")
                            : "—"}
                        </p>
                      </div>
                    </div>
                    {trip.notes && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Observações</p>
                        <p className="text-sm">{trip.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          {/* Calendar Navigation */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateCalendar("prev")}
                  data-testid="button-calendar-prev"
                >
                  Anterior
                </Button>
                <div className="text-center">
                  <p className="font-medium">
                    {format(calendarStartDate, "dd 'de' MMMM", { locale: ptBR })} - {format(calendarEndDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToToday}
                    className="mt-1"
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
                  Próximo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {calendarDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayTrips = tripsByDate[dayKey] || [];
              const isToday = isSameDay(day, new Date());

              return (
                <Card 
                  key={dayKey} 
                  className={isToday ? "border-primary" : ""}
                  data-testid={`calendar-day-${dayKey}`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="capitalize">
                          {format(day, "EEE", { locale: ptBR })}
                        </span>
                        <span className={isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs" : ""}>
                          {format(day, "dd")}
                        </span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dayTrips.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Sem viagens
                      </p>
                    ) : (
                      dayTrips.map((entry, index) => (
                        <div
                          key={`${entry.trip.id}-${entry.type}-${index}`}
                          className="p-2 rounded-md bg-card hover-elevate cursor-pointer border"
                          onClick={() => handleEdit(entry.trip)}
                          data-testid={`calendar-trip-${entry.trip.id}-${entry.type}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center font-bold text-lg ${
                              entry.type === "loading" 
                                ? "bg-pink-500/20 text-pink-600 dark:bg-pink-500/30 dark:text-pink-400" 
                                : "bg-blue-500/20 text-blue-600 dark:bg-blue-500/30 dark:text-blue-400"
                            }`}>
                              {entry.type === "loading" ? "C" : "D"}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="font-medium text-sm line-clamp-2">{entry.trip.event?.name}</p>
                              <StatusBadge status={entry.trip.status} className="text-[10px] px-1.5 py-0.5 h-auto" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <TripDialog 
        open={showDialog}
        onOpenChange={handleClose}
        trip={selectedTrip}
      />
    </div>
  );
}

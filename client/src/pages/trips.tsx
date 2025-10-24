import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Truck, Calendar, MapPin, Filter, X } from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import type { Trip, Event, Vehicle, Driver } from "@shared/schema";
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

interface TripWithRelations extends Trip {
  event?: Event;
  vehicle?: Vehicle;
  driver?: Driver;
}

interface TripFilters {
  eventDate?: string;
  eventId?: string;
  movementDate?: string;
}

export default function Trips() {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<TripFilters>({});

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
        if (!trip.event?.startDate) return false;
        const eventDate = startOfDay(parseISO(trip.event.startDate));
        const filterDate = startOfDay(parseISO(filters.eventDate));
        if (eventDate.getTime() !== filterDate.getTime()) return false;
      }

      // Filter by event
      if (filters.eventId && trip.eventId !== parseInt(filters.eventId)) {
        return false;
      }

      // Filter by movement date (loading or unloading)
      if (filters.movementDate) {
        const filterDate = startOfDay(parseISO(filters.movementDate));
        const filterDateEnd = endOfDay(parseISO(filters.movementDate));
        
        let matchesMovementDate = false;
        
        // Check loading date
        if (trip.loadingDate) {
          const loadingDate = new Date(trip.loadingDate);
          if (loadingDate >= filterDate && loadingDate <= filterDateEnd) {
            matchesMovementDate = true;
          }
        }
        
        // Check unloading date
        if (trip.unloadingDate) {
          const unloadingDate = new Date(trip.unloadingDate);
          if (unloadingDate >= filterDate && unloadingDate <= filterDateEnd) {
            matchesMovementDate = true;
          }
        }
        
        if (!matchesMovementDate) return false;
      }

      return true;
    });
  }, [trips, filters]);

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
                    value={filters.eventId || ""}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, eventId: value || undefined }))
                    }
                  >
                    <SelectTrigger id="filter-event" data-testid="select-filter-event">
                      <SelectValue placeholder="Todos os eventos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os eventos</SelectItem>
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
                  <div className="relative">
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
                      data-testid="input-filter-event-date"
                    />
                    {filters.eventDate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
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
                  <div className="relative">
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
                      data-testid="input-filter-movement-date"
                    />
                    {filters.movementDate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
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

      {/* Results */}
      {!filteredTrips || filteredTrips.length === 0 ? (
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
          {filteredTrips.map((trip) => (
            <Card 
              key={trip.id}
              className="hover-elevate cursor-pointer"
              onClick={() => handleEdit(trip)}
              data-testid={`card-trip-${trip.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    {trip.event?.name || "Trip"}
                  </CardTitle>
                  <StatusBadge status={trip.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Veículo</p>
                    <p className="text-sm font-medium">{trip.vehicle?.plate || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Motorista</p>
                    <p className="text-sm font-medium">{trip.driver?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Carregamento</p>
                    <p className="text-sm font-medium">
                      {trip.loadingDate ? format(new Date(trip.loadingDate), "dd/MM/yyyy HH:mm") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Descarregamento</p>
                    <p className="text-sm font-medium">
                      {trip.unloadingDate ? format(new Date(trip.unloadingDate), "dd/MM/yyyy HH:mm") : "—"}
                    </p>
                  </div>
                </div>
                {trip.notes && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">{trip.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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

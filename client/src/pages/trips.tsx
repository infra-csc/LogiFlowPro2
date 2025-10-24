import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Truck, Calendar, MapPin } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import type { Trip, Event, Vehicle, Driver } from "@shared/schema";
import { TripDialog } from "@/components/trip-dialog";
import { Badge } from "@/components/ui/badge";

interface TripWithRelations extends Trip {
  event?: Event;
  vehicle?: Vehicle;
  driver?: Driver;
}

export default function Trips() {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | undefined>();

  const { data: trips, isLoading } = useQuery<TripWithRelations[]>({
    queryKey: ["/api/trips"],
  });

  const handleEdit = (trip: Trip) => {
    setSelectedTrip(trip);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedTrip(undefined);
    setShowDialog(false);
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

      {!trips || trips.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Truck className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma viagem agendada</h3>
              <p className="mt-2 text-sm text-muted-foreground">Comece a planejar o transporte para seus eventos</p>
              <Button onClick={() => setShowDialog(true)} className="mt-4" data-testid="button-plan-first-trip">
                <Plus className="h-4 w-4 mr-2" />
                Planejar Viagem
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => (
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
                      {trip.loadingDate ? format(new Date(trip.loadingDate), "MMM dd, HH:mm") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Descarregamento</p>
                    <p className="text-sm font-medium">
                      {trip.unloadingDate ? format(new Date(trip.unloadingDate), "MMM dd, HH:mm") : "—"}
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

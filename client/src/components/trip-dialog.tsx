import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Trip, InsertTrip, Event, VehicleType, Driver, Dock } from "@shared/schema";
import { format } from "date-fns";
import { Plus, X, MapPin } from "lucide-react";

interface TripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip;
}

interface Destination {
  id: string;
  location: string;
  arrivalDateTime: string;
}

interface TripFormData {
  eventId?: string;
  vehicleTypeId?: string;
  driverId?: string;
  dockId?: string;
  loadingDate?: string;
  loadingLocation?: string;
  loadingStartTime?: string;
  loadingEndTime?: string;
  departureDateTime?: string;
  unloadingLocation?: string;
  unloadingDate?: string;
  unloadingStartTime?: string;
  unloadingEndTime?: string;
  status?: string;
  notes?: string;
}

export function TripDialog({ open, onOpenChange, trip }: TripDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<TripFormData>({
    eventId: "",
    vehicleTypeId: "",
    driverId: "",
    dockId: "",
    status: "planned",
    notes: "",
  });

  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    if (trip && open) {
      setFormData({
        eventId: trip.eventId || "",
        vehicleTypeId: trip.vehicleTypeId || "",
        driverId: trip.driverId || "",
        dockId: trip.dockId || "",
        loadingDate: trip.loadingDate ? format(new Date(trip.loadingDate), "yyyy-MM-dd'T'HH:mm") : "",
        loadingLocation: trip.loadingLocation || "",
        loadingStartTime: trip.loadingStartTime ? format(new Date(trip.loadingStartTime), "yyyy-MM-dd'T'HH:mm") : "",
        loadingEndTime: trip.loadingEndTime ? format(new Date(trip.loadingEndTime), "yyyy-MM-dd'T'HH:mm") : "",
        departureDateTime: trip.departureDateTime ? format(new Date(trip.departureDateTime), "yyyy-MM-dd'T'HH:mm") : "",
        unloadingLocation: trip.unloadingLocation || "",
        unloadingDate: trip.unloadingDate ? format(new Date(trip.unloadingDate), "yyyy-MM-dd'T'HH:mm") : "",
        unloadingStartTime: trip.unloadingStartTime ? format(new Date(trip.unloadingStartTime), "yyyy-MM-dd'T'HH:mm") : "",
        unloadingEndTime: trip.unloadingEndTime ? format(new Date(trip.unloadingEndTime), "yyyy-MM-dd'T'HH:mm") : "",
        status: trip.status || "planned",
        notes: trip.notes || "",
      });
      setDestinations([]);
    } else if (!trip && !open) {
      setFormData({
        eventId: "",
        vehicleTypeId: "",
        driverId: "",
        dockId: "",
        status: "planned",
        notes: "",
      });
      setDestinations([]);
    }
  }, [trip, open]);

  const { data: events } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: vehicleTypes } = useQuery<VehicleType[]>({ queryKey: ["/api/vehicle-types"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: docks } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  const createMutation = useMutation({
    mutationFn: async (data: InsertTrip) => {
      return apiRequest("POST", "/api/trips", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ description: "Viagem criada com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao criar viagem", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertTrip>) => {
      return apiRequest("PATCH", `/api/trips/${trip?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ description: "Viagem atualizada com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao atualizar viagem", variant: "destructive" });
    },
  });

  const addDestination = () => {
    setDestinations([
      ...destinations,
      {
        id: crypto.randomUUID(),
        location: "",
        arrivalDateTime: "",
      },
    ]);
  };

  const removeDestination = (id: string) => {
    setDestinations(destinations.filter((d) => d.id !== id));
  };

  const updateDestination = (id: string, field: keyof Destination, value: string) => {
    setDestinations(
      destinations.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.eventId || !formData.vehicleTypeId) {
      toast({ 
        description: "Preencha os campos obrigatórios (Evento e Tipo de Veículo)", 
        variant: "destructive" 
      });
      return;
    }

    const submitData: any = {
      eventId: formData.eventId,
      vehicleTypeId: formData.vehicleTypeId,
      driverId: formData.driverId || null,
      dockId: formData.dockId || null,
      loadingDate: formData.loadingDate ? new Date(formData.loadingDate) : null,
      loadingLocation: formData.loadingLocation || null,
      loadingStartTime: formData.loadingStartTime ? new Date(formData.loadingStartTime) : null,
      loadingEndTime: formData.loadingEndTime ? new Date(formData.loadingEndTime) : null,
      departureDateTime: formData.departureDateTime ? new Date(formData.departureDateTime) : null,
      unloadingLocation: formData.unloadingLocation || null,
      unloadingDate: formData.unloadingDate ? new Date(formData.unloadingDate) : null,
      unloadingStartTime: formData.unloadingStartTime ? new Date(formData.unloadingStartTime) : null,
      unloadingEndTime: formData.unloadingEndTime ? new Date(formData.unloadingEndTime) : null,
      status: formData.status || "planned",
      notes: formData.notes || null,
    };

    if (trip) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{trip ? "Editar Viagem" : "Planejar Nova Viagem"}</DialogTitle>
          <DialogDescription>
            {trip ? "Atualize os detalhes do planejamento de transporte" : "Crie um novo planejamento de transporte"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção: Evento */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">Evento</h3>
            <div className="space-y-2">
              <Label htmlFor="eventId">Evento *</Label>
              <Select 
                value={formData.eventId}
                onValueChange={(value) => setFormData({ ...formData, eventId: value })}
              >
                <SelectTrigger data-testid="select-event">
                  <SelectValue placeholder="Selecione um evento" />
                </SelectTrigger>
                <SelectContent>
                  {events?.map((event) => (
                    <SelectItem key={event.id} value={event.id.toString()}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seção: Tipo de Veículo e Motorista */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">Veículo e Motorista</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleTypeId">Tipo de Veículo *</Label>
                <Select 
                  value={formData.vehicleTypeId}
                  onValueChange={(value) => setFormData({ ...formData, vehicleTypeId: value })}
                >
                  <SelectTrigger data-testid="select-vehicle-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes?.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverId">Motorista</Label>
                <Select 
                  value={formData.driverId}
                  onValueChange={(value) => setFormData({ ...formData, driverId: value })}
                >
                  <SelectTrigger data-testid="select-driver">
                    <SelectValue placeholder="Selecione um motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers?.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dockId">Doca (Opcional)</Label>
              <Select 
                value={formData.dockId || "none"}
                onValueChange={(value) => setFormData({ ...formData, dockId: value === "none" ? undefined : value })}
              >
                <SelectTrigger data-testid="select-dock">
                  <SelectValue placeholder="Selecione uma doca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma doca</SelectItem>
                  {docks?.map((dock) => (
                    <SelectItem key={dock.id} value={dock.id}>
                      {dock.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seção: Destinos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-medium">Destinos</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addDestination}
                data-testid="button-add-destination"
              >
                <Plus className="h-4 w-4 mr-2" />
                Incluir Destino
              </Button>
            </div>

            {destinations.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                Nenhum destino adicionado. Clique em "Incluir Destino" para adicionar.
              </div>
            ) : (
              <div className="space-y-3">
                {destinations.map((destination, index) => (
                  <Card key={destination.id} data-testid={`card-destination-${index}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Destino {index + 1}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`destination-location-${destination.id}`}>
                              Endereço
                            </Label>
                            <Input
                              id={`destination-location-${destination.id}`}
                              value={destination.location}
                              onChange={(e) =>
                                updateDestination(destination.id, "location", e.target.value)
                              }
                              placeholder="Ex: Rua ABC, 123 - Bairro"
                              data-testid={`input-destination-location-${index}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`destination-arrival-${destination.id}`}>
                              Data e Horário de Chegada
                            </Label>
                            <Input
                              id={`destination-arrival-${destination.id}`}
                              type="datetime-local"
                              value={destination.arrivalDateTime}
                              onChange={(e) =>
                                updateDestination(destination.id, "arrivalDateTime", e.target.value)
                              }
                              data-testid={`input-destination-arrival-${index}`}
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDestination(destination.id)}
                          data-testid={`button-remove-destination-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Seção: Carregamento */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">Carregamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loadingDate">Data de Carregamento</Label>
                <Input
                  id="loadingDate"
                  type="datetime-local"
                  value={formData.loadingDate || ""}
                  onChange={(e) => setFormData({ ...formData, loadingDate: e.target.value })}
                  data-testid="input-loading-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loadingLocation">Local de Carregamento</Label>
                <Input
                  id="loadingLocation"
                  value={formData.loadingLocation || ""}
                  onChange={(e) => setFormData({ ...formData, loadingLocation: e.target.value })}
                  placeholder="Ex: Armazém Central"
                  data-testid="input-loading-location"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loadingStartTime">Início do Carregamento</Label>
                <Input
                  id="loadingStartTime"
                  type="datetime-local"
                  value={formData.loadingStartTime || ""}
                  onChange={(e) => setFormData({ ...formData, loadingStartTime: e.target.value })}
                  data-testid="input-loading-start"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loadingEndTime">Fim do Carregamento</Label>
                <Input
                  id="loadingEndTime"
                  type="datetime-local"
                  value={formData.loadingEndTime || ""}
                  onChange={(e) => setFormData({ ...formData, loadingEndTime: e.target.value })}
                  data-testid="input-loading-end"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="departureDateTime">Data/Hora de Saída</Label>
                <Input
                  id="departureDateTime"
                  type="datetime-local"
                  value={formData.departureDateTime || ""}
                  onChange={(e) => setFormData({ ...formData, departureDateTime: e.target.value })}
                  data-testid="input-departure"
                />
              </div>
            </div>
          </div>

          {/* Seção: Descarregamento */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium border-b pb-2">Descarregamento</h3>
            <div className="space-y-2">
              <Label htmlFor="unloadingLocation">Local de Descarregamento</Label>
              <Input
                id="unloadingLocation"
                value={formData.unloadingLocation || ""}
                onChange={(e) => setFormData({ ...formData, unloadingLocation: e.target.value })}
                placeholder="Ex: Local do Evento"
                data-testid="input-unloading-location"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unloadingDate">Data de Descarregamento</Label>
                <Input
                  id="unloadingDate"
                  type="datetime-local"
                  value={formData.unloadingDate || ""}
                  onChange={(e) => setFormData({ ...formData, unloadingDate: e.target.value })}
                  data-testid="input-unloading-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unloadingStartTime">Início do Descarregamento</Label>
                <Input
                  id="unloadingStartTime"
                  type="datetime-local"
                  value={formData.unloadingStartTime || ""}
                  onChange={(e) => setFormData({ ...formData, unloadingStartTime: e.target.value })}
                  data-testid="input-unloading-start"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unloadingEndTime">Fim do Descarregamento</Label>
                <Input
                  id="unloadingEndTime"
                  type="datetime-local"
                  value={formData.unloadingEndTime || ""}
                  onChange={(e) => setFormData({ ...formData, unloadingEndTime: e.target.value })}
                  data-testid="input-unloading-end"
                />
              </div>
            </div>
          </div>

          {/* Seção: Status e Notas */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status as string}
                onValueChange={(value) => setFormData({ ...formData, status: value as any })}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planejada</SelectItem>
                  <SelectItem value="loading">Carregando</SelectItem>
                  <SelectItem value="loaded">Carregada</SelectItem>
                  <SelectItem value="in_transit">Em Trânsito</SelectItem>
                  <SelectItem value="at_destination">No Destino</SelectItem>
                  <SelectItem value="unloading">Descarregando</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas sobre a viagem..."
                rows={3}
                data-testid="input-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-trip"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : (trip ? "Atualizar" : "Criar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

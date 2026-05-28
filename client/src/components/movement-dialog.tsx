import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { userCanCreateMovement, userCanEditMovement } from "@/lib/authz";
import type { LoadingOrder, Dock, Event, Trip, Movement, MovementTypeConfig } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  movementTypeConfigId: z.string().min(1, "Tipo de movimentação é obrigatório"),
  eventIds: z.array(z.string()).optional().default([]),
  tripIds: z.array(z.string()).optional(),
  loadingOrderId: z.string().optional(),
  vehiclePlate: z.string().optional(),
  dockId: z.string().min(1, "Doca é obrigatória"),
});

type FormData = z.infer<typeof formSchema>;

type MovementWithRelations = Movement & {
  events?: Event[];
  trips?: Trip[];
};

interface MovementDialogProps {
  children: React.ReactNode;
  movement?: MovementWithRelations;
}

export function MovementDialog({ children, movement }: MovementDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditMode = !!movement;

  const { data: loadingOrders = [] } = useQuery<LoadingOrder[]>({
    queryKey: ["/api/loading-orders"],
  });

  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });

  const { data: movementTypes = [] } = useQuery<MovementTypeConfig[]>({
    queryKey: ["/api/movement-types-config"],
  });

  const activeMovementTypes = movementTypes.filter(mt => mt.active);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      movementTypeConfigId: "",
      eventIds: [],
      tripIds: [],
      loadingOrderId: undefined,
      vehiclePlate: undefined,
      dockId: "",
    },
  });

  // Load movement data when in edit mode
  useEffect(() => {
    if (movement && open) {
      form.reset({
        name: movement.name,
        movementTypeConfigId: movement.movementTypeConfigId || "",
        eventIds: movement.events?.map(e => e.id) || [],
        tripIds: movement.trips?.map(t => t.id) || [],
        loadingOrderId: movement.loadingOrderId ?? undefined,
        vehiclePlate: movement.vehiclePlate ?? undefined,
        dockId: movement.dockId || "",
      });
    }
  }, [movement, open, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/movements", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create movement");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Movimentação criada",
        description: "A movimentação foi criada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements/pending-approval"] });
      setOpen(false);
      form.reset({
        name: "",
        movementTypeConfigId: "",
        eventIds: [],
        tripIds: [],
        loadingOrderId: undefined,
        vehiclePlate: undefined,
        dockId: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar movimentação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!movement) throw new Error("No movement to update");
      const res = await apiRequest("PATCH", `/api/movements/${movement.id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update movement");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Movimentação atualizada",
        description: "A movimentação foi atualizada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements", movement?.id] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar movimentação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Normalize optional fields: convert empty strings to undefined
    const normalizedData = {
      ...data,
      loadingOrderId: data.loadingOrderId || undefined,
      vehiclePlate: data.vehiclePlate || undefined,
    };
    
    if (isEditMode) {
      updateMutation.mutate(normalizedData);
    } else {
      createMutation.mutate(normalizedData);
    }
  };

  const approvedOrders = loadingOrders.filter(
    (order) => order.status === "approved" || order.status === "in_progress"
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl" data-testid="dialog-movement">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar Movimentação" : "Nova Movimentação"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Movimentação</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Carga Evento Corporativo ABC"
                      data-testid="input-movement-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="movementTypeConfigId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimentação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-movement-type">
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeMovementTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                          {type.requiresApproval && " ⚠️"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eventIds"
              render={({ field }) => {
                const selectedEventIds = field.value || [];
                const selectedEvents = events.filter(e => selectedEventIds.includes(e.id));
                const unselectedEvents = events.filter(e => !selectedEventIds.includes(e.id));

                const handleEventSelect = (eventId: string) => {
                  const newIds = [...selectedEventIds, eventId];
                  field.onChange(newIds);
                };

                const handleEventRemove = (eventId: string) => {
                  const newIds = selectedEventIds.filter(id => id !== eventId);
                  field.onChange(newIds);
                };

                return (
                  <FormItem>
                    <FormLabel>Eventos (Opcional)</FormLabel>
                    <div className="space-y-2">
                      {selectedEvents.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedEvents.map((event) => (
                            <Badge
                              key={event.id}
                              variant="secondary"
                              className="gap-1 pr-1"
                              data-testid={`badge-event-${event.id}`}
                            >
                              {event.name}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0 hover:bg-transparent"
                                onClick={() => handleEventRemove(event.id)}
                                data-testid={`button-remove-event-${event.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {unselectedEvents.length > 0 && (
                        <Select
                          onValueChange={handleEventSelect}
                          value=""
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-events">
                              <SelectValue placeholder="Adicionar evento..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unselectedEvents.map((event) => (
                              <SelectItem key={event.id} value={event.id}>
                                {event.name} ({event.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {unselectedEvents.length === 0 && selectedEvents.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Todos os eventos disponíveis foram selecionados
                        </p>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="tripIds"
              render={({ field }) => {
                const selectedTripIds = field.value || [];
                const selectedEventIds = form.watch('eventIds') || [];
                
                // Filter trips: if events are selected, only show trips from those events
                const filteredTrips = selectedEventIds.length > 0
                  ? trips.filter(t => selectedEventIds.includes(t.eventId))
                  : trips;
                
                const selectedTrips = filteredTrips.filter(t => selectedTripIds.includes(t.id));
                const unselectedTrips = filteredTrips.filter(t => !selectedTripIds.includes(t.id));

                const handleTripSelect = (tripId: string) => {
                  const newIds = [...selectedTripIds, tripId];
                  field.onChange(newIds);
                };

                const handleTripRemove = (tripId: string) => {
                  const newIds = selectedTripIds.filter(id => id !== tripId);
                  field.onChange(newIds);
                };

                // Helper to get event name for a trip
                const getEventName = (trip: Trip) => {
                  const event = events.find(e => e.id === trip.eventId);
                  return event?.name || 'Evento não encontrado';
                };

                return (
                  <FormItem>
                    <FormLabel>Viagens (Opcional)</FormLabel>
                    <div className="space-y-2">
                      {selectedTrips.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedTrips.map((trip) => {
                            const eventName = getEventName(trip);
                            return (
                              <Badge
                                key={trip.id}
                                variant="secondary"
                                className="gap-1 pr-1"
                                data-testid={`badge-trip-${trip.id}`}
                              >
                                {eventName} - {trip.description || `Viagem ${trip.id.substring(0, 8)}`}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 p-0 hover:bg-transparent"
                                  onClick={() => handleTripRemove(trip.id)}
                                  data-testid={`button-remove-trip-${trip.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      {unselectedTrips.length > 0 && (
                        <Select
                          onValueChange={handleTripSelect}
                          value=""
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-trips">
                              <SelectValue placeholder="Adicionar viagem..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unselectedTrips.map((trip) => {
                              const eventName = getEventName(trip);
                              return (
                                <SelectItem key={trip.id} value={trip.id}>
                                  {eventName} - {trip.description || `Viagem ${trip.id.substring(0, 8)}`}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                      {unselectedTrips.length === 0 && selectedTrips.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Todas as viagens disponíveis foram selecionadas
                        </p>
                      )}
                      {selectedEventIds.length > 0 && filteredTrips.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma viagem disponível para os eventos selecionados
                        </p>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="loadingOrderId"
              render={({ field }) => {
                const selectedEventIds = form.watch('eventIds') || [];
                
                // Filter loading orders: if events are selected, only show orders from those events
                const filteredOrders = selectedEventIds.length > 0
                  ? approvedOrders.filter(order => selectedEventIds.includes(order.eventId))
                  : approvedOrders;

                return (
                  <FormItem>
                    <FormLabel>Ordem de Carregamento (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-loading-order">
                          <SelectValue placeholder="Selecione uma ordem (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredOrders.map((order) => {
                          const event = events.find(e => e.id === order.eventId);
                          const eventName = event?.name || 'Evento não encontrado';
                          return (
                            <SelectItem key={order.id} value={order.id}>
                              {eventName} - {order.orderNumber}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedEventIds.length > 0 && filteredOrders.length === 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Nenhuma ordem de carregamento aprovada para os eventos selecionados
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="vehiclePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Placa do Veículo (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: ABC-1234"
                      data-testid="input-vehicle-plate"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dockId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doca</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-dock">
                        <SelectValue placeholder="Selecione uma doca" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {docks.map((dock) => (
                        <SelectItem key={dock.id} value={dock.id}>
                          {dock.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              {(isEditMode ? userCanEditMovement(user) : userCanCreateMovement(user)) && (
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {isEditMode
                    ? (updateMutation.isPending ? "Salvando..." : "Salvar Alterações")
                    : (createMutation.isPending ? "Criando..." : "Criar Movimentação")}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { userCanCreateMovement, userCanEditMovement } from "@/lib/authz";
import type { LoadingOrder, Dock, Event, Trip, Movement, MovementTypeConfig } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  X,
  Check,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
  Truck,
  Package,
  MapPin,
  Route,
  ClipboardList,
  Warehouse,
  Tag,
  FileText,
  Info,
} from "lucide-react";

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

// Friendly labels for movement types (visual only, payload unchanged)
const movementTypeFriendlyLabel = (name: string): string => {
  const map: Record<string, string> = {
    "outbound_event": "Saída para evento",
    "inbound_event": "Retorno de evento",
    "inbound_purchase": "Entrada de compra",
    "inbound_rental": "Entrada de aluguel",
    "outbound_rental_return": "Saída para devolução de aluguel",
    "internal_transfer": "Transferência interna",
    "inventory_adjustment": "Ajuste de inventário",
  };
  return map[name] || name;
};

// Description hint for movement type
const movementTypeHint = (name: string): string => {
  const map: Record<string, string> = {
    "outbound_event": "Use para registrar saída de materiais do armazém para o evento.",
    "inbound_event": "Use para registrar retorno de materiais ao armazém.",
    "inbound_purchase": "Use para registrar entrada de materiais comprados.",
    "inbound_rental": "Use para registrar entrada de materiais alugados.",
    "outbound_rental_return": "Use para registrar devolução de materiais alugados.",
    "internal_transfer": "Use para transferir materiais entre áreas do armazém.",
    "inventory_adjustment": "Use para corrigir divergências de estoque.",
  };
  return map[name] || "";
};

// Section divider component
function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 pt-2">
      <div className="flex items-center justify-center h-5 w-5 rounded-sm bg-primary/10 text-primary">
        <Icon className="h-3 w-3" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      <div className="flex-1 h-px bg-border/60 ml-2" />
    </div>
  );
}

// Combobox for searchable selects
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  dataTestid,
  renderItem,
  renderSelected,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; searchText: string }[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  dataTestid?: string;
  renderItem?: (option: { value: string; label: string }) => React.ReactNode;
  renderSelected?: (value: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between h-10 font-normal bg-card"
          data-testid={dataTestid}
        >
          {renderSelected ? (
            renderSelected(value)
          ) : selected ? (
            <span className="truncate">{selected.label}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>
              <div className="flex flex-col items-center py-4 gap-2">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{emptyText}</span>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.searchText}
                  onSelect={() => {
                    onChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {renderItem ? renderItem(option) : <span className="text-sm">{option.label}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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

  const activeMovementTypes = useMemo(() => movementTypes.filter((mt) => mt.active), [movementTypes]);

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

  const watchedValues = form.watch();

  // Load movement data when in edit mode
  useEffect(() => {
    if (movement && open) {
      form.reset({
        name: movement.name,
        movementTypeConfigId: movement.movementTypeConfigId || "",
        eventIds: movement.events?.map((e) => e.id) || [],
        tripIds: movement.trips?.map((t) => t.id) || [],
        loadingOrderId: movement.loadingOrderId ?? undefined,
        vehiclePlate: movement.vehiclePlate ?? undefined,
        dockId: movement.dockId || "",
      });
    }
  }, [movement, open, form]);

  // Reset on close
  useEffect(() => {
    if (!open && !isEditMode) {
      form.reset({
        name: "",
        movementTypeConfigId: "",
        eventIds: [],
        tripIds: [],
        loadingOrderId: undefined,
        vehiclePlate: undefined,
        dockId: "",
      });
    }
  }, [open, isEditMode, form]);

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

  const approvedOrders = useMemo(
    () => loadingOrders.filter((order) => order.status === "approved" || order.status === "in_progress"),
    [loadingOrders]
  );

  // Computed data for summary
  const selectedType = activeMovementTypes.find((t) => t.id === watchedValues.movementTypeConfigId);
  const selectedEvents = events.filter((e) => (watchedValues.eventIds || []).includes(e.id));
  const selectedTrips = trips.filter((t) => (watchedValues.tripIds || []).includes(t.id));
  const selectedOrder = approvedOrders.find((o) => o.id === watchedValues.loadingOrderId);
  const selectedDock = docks.find((d) => d.id === watchedValues.dockId);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isValid = form.formState.isValid;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="max-w-xl max-h-[90vh] overflow-hidden p-0 flex flex-col"
        data-testid="dialog-movement"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {isEditMode ? "Editar Movimentação" : "Nova Movimentação"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {isEditMode
                ? "Atualize os dados da movimentação operacional."
                : "Crie uma movimentação operacional vinculando evento, plano de viagens, ordem de carregamento, veículo e doca."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: "thin" }}>
              {/* Section 1: Identificação */}
              <SectionTitle icon={Tag} title="Identificação" />
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Nome da movimentação *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Carga Night Run — Carreta 1"
                          data-testid="input-movement-name"
                          className="h-10"
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
                  render={({ field }) => {
                    const typeOptions = activeMovementTypes.map((t) => ({
                      value: t.id,
                      label: movementTypeFriendlyLabel(t.name),
                      searchText: `${movementTypeFriendlyLabel(t.name)} ${t.name}`.toLowerCase(),
                    }));

                    return (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Tipo de movimentação *</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value}
                            onChange={field.onChange}
                            options={typeOptions}
                            placeholder="Selecione o tipo..."
                            searchPlaceholder="Buscar tipo de movimentação..."
                            emptyText="Nenhum tipo encontrado"
                            dataTestid="select-movement-type"
                            renderItem={(option) => (
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{option.label}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {movementTypeHint(option.value)}
                                </span>
                              </div>
                            )}
                            renderSelected={(val) => {
                              const t = activeMovementTypes.find((x) => x.id === val);
                              return t ? (
                                <span className="truncate">
                                  {movementTypeFriendlyLabel(t.name)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Selecione o tipo...</span>
                              );
                            }}
                          />
                        </FormControl>
                        {selectedType && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {movementTypeHint(selectedType.name)}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Section 2: Contexto */}
              <SectionTitle icon={MapPin} title="Contexto" />
              <div className="space-y-4">
                {/* Evento */}
                <FormField
                  control={form.control}
                  name="eventIds"
                  render={({ field }) => {
                    const selectedEventIds = field.value || [];
                    const selectedEventsList = events.filter((e) => selectedEventIds.includes(e.id));
                    const unselectedEvents = events.filter((e) => !selectedEventIds.includes(e.id));
                    const eventOptions = unselectedEvents.map((e) => ({
                      value: e.id,
                      label: e.name,
                      searchText: `${e.name} ${e.location || ""} ${e.sku || ""}`.toLowerCase(),
                    }));

                    return (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Evento (opcional)</FormLabel>
                        <div className="space-y-2">
                          {selectedEventsList.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {selectedEventsList.map((event) => (
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
                                    onClick={() => {
                                      const newIds = selectedEventIds.filter((id) => id !== event.id);
                                      field.onChange(newIds);
                                      // Also clear dependent selections
                                      form.setValue("tripIds", []);
                                      form.setValue("loadingOrderId", undefined);
                                    }}
                                    data-testid={`button-remove-event-${event.id}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          {unselectedEvents.length > 0 && (
                            <FormControl>
                              <SearchableSelect
                                value=""
                                onChange={(val) => {
                                  if (val) {
                                    const newIds = [...selectedEventIds, val];
                                    field.onChange(newIds);
                                  }
                                }}
                                options={eventOptions}
                                placeholder="Adicionar evento..."
                                searchPlaceholder="Buscar evento por nome ou cidade..."
                                emptyText="Nenhum evento encontrado"
                                dataTestid="select-events"
                                renderItem={(option) => {
                                  const evt = events.find((e) => e.id === option.value);
                                  return (
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">{option.label}</span>
                                      {evt && (
                                        <span className="text-[10px] text-muted-foreground">
                                          {evt.location
                                            ? `${evt.location} · ${new Date(evt.eventDate).toLocaleDateString("pt-BR")}`
                                            : new Date(evt.eventDate).toLocaleDateString("pt-BR")}
                                        </span>
                                      )}
                                    </div>
                                  );
                                }}
                                renderSelected={() => (
                                  <span className="text-muted-foreground">Adicionar evento...</span>
                                )}
                              />
                            </FormControl>
                          )}
                          {unselectedEvents.length === 0 && selectedEventsList.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Todos os eventos disponíveis foram selecionados
                            </p>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* Viagem */}
                <FormField
                  control={form.control}
                  name="tripIds"
                  render={({ field }) => {
                    const selectedTripIds = field.value || [];
                    const selectedEventIds = form.watch("eventIds") || [];
                    const filteredTrips =
                      selectedEventIds.length > 0
                        ? trips.filter((t) => selectedEventIds.includes(t.eventId))
                        : trips;
                    const selectedTripsList = filteredTrips.filter((t) => selectedTripIds.includes(t.id));
                    const unselectedTrips = filteredTrips.filter((t) => !selectedTripIds.includes(t.id));
                    const tripOptions = unselectedTrips.map((t) => {
                      const event = events.find((e) => e.id === t.eventId);
                      return {
                        value: t.id,
                        label: `${event?.name || "Evento"} — ${t.description || `Plano de Viagens ${t.id.substring(0, 8)}`}`,
                        searchText: `${t.description || ""} ${event?.name || ""}`.toLowerCase(),
                      };
                    });

                    return (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Plano de Viagens (opcional)</FormLabel>
                        <div className="space-y-2">
                          {selectedTripsList.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {selectedTripsList.map((trip) => {
                                const event = events.find((e) => e.id === trip.eventId);
                                return (
                                  <Badge
                                    key={trip.id}
                                    variant="secondary"
                                    className="gap-1 pr-1"
                                    data-testid={`badge-trip-${trip.id}`}
                                  >
                                    {event?.name || "Evento"} — {trip.description || `Plano de Viagens ${trip.id.substring(0, 8)}`}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 p-0 hover:bg-transparent"
                                      onClick={() => {
                                        const newIds = selectedTripIds.filter((id) => id !== trip.id);
                                        field.onChange(newIds);
                                      }}
                                      data-testid={`button-remove-trip-${trip.id}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                          {selectedEventIds.length === 0 ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Info className="h-3 w-3" />
                              Selecione um evento para ver planos de viagens disponíveis
                            </p>
                          ) : unselectedTrips.length > 0 ? (
                            <FormControl>
                              <SearchableSelect
                                value=""
                                onChange={(val) => {
                                  if (val) {
                                    const newIds = [...selectedTripIds, val];
                                    field.onChange(newIds);
                                  }
                                }}
                                options={tripOptions}
                                placeholder="Adicionar plano de viagens..."
                                searchPlaceholder="Buscar plano de viagens por nome ou evento..."
                                emptyText="Nenhum plano de viagens encontrado"
                                dataTestid="select-trips"
                                renderItem={(option) => (
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{option.label}</span>
                                  </div>
                                )}
                                renderSelected={() => (
                                  <span className="text-muted-foreground">Adicionar plano de viagens...</span>
                                )}
                              />
                            </FormControl>
                          ) : selectedTripsList.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Nenhum plano de viagens disponível para os eventos selecionados
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Todos os planos de viagens disponíveis foram selecionados
                            </p>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* Ordem de Carregamento */}
                <FormField
                  control={form.control}
                  name="loadingOrderId"
                  render={({ field }) => {
                    const selectedEventIds = form.watch("eventIds") || [];
                    const filteredOrders =
                      selectedEventIds.length > 0
                        ? approvedOrders.filter((order) => selectedEventIds.includes(order.eventId))
                        : approvedOrders;
                    const orderOptions = filteredOrders.map((o) => {
                      const event = events.find((e) => e.id === o.eventId);
                      return {
                        value: o.id,
                        label: `${event?.name || "Evento"} — ${o.orderNumber}`,
                        searchText: `${o.orderNumber} ${event?.name || ""}`.toLowerCase(),
                      };
                    });

                    return (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Ordem de carregamento (opcional)</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value || ""}
                            onChange={(val) => field.onChange(val || undefined)}
                            options={orderOptions}
                            placeholder="Selecione uma ordem (opcional)"
                            searchPlaceholder="Buscar ordem por número ou evento..."
                            emptyText="Nenhuma ordem encontrada"
                            dataTestid="select-loading-order"
                            disabled={selectedEventIds.length === 0 && approvedOrders.length === 0}
                            renderItem={(option) => {
                              const order = approvedOrders.find((o) => o.id === option.value);
                              const event = events.find((e) => e.id === order?.eventId);
                              return (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{option.label}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {event?.name || "Evento"} · {order?.status === "approved" ? "Aprovada" : "Em progresso"}
                                  </span>
                                </div>
                              );
                            }}
                            renderSelected={(val) => {
                              const order = approvedOrders.find((o) => o.id === val);
                              const event = events.find((e) => e.id === order?.eventId);
                              return order ? (
                                <span className="truncate">
                                  {event?.name || "Evento"} — {order.orderNumber}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Selecione uma ordem (opcional)</span>
                              );
                            }}
                          />
                        </FormControl>
                        {selectedEventIds.length > 0 && filteredOrders.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Nenhuma ordem de carregamento aprovada para os eventos selecionados
                          </p>
                        )}
                        {selectedEventIds.length === 0 && approvedOrders.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            Selecione um evento para ver ordens disponíveis
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Section 3: Operação */}
              <SectionTitle icon={Truck} title="Operação" />
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="vehiclePlate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Placa do veículo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: ABC-1234"
                          data-testid="input-vehicle-plate"
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Informe a placa quando não houver plano de viagens vinculado.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dockId"
                  render={({ field }) => {
                    const dockOptions = docks.map((d) => ({
                      value: d.id,
                      label: d.name,
                      searchText: d.name.toLowerCase(),
                    }));

                    return (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Doca *</FormLabel>
                        <FormControl>
                          {docks.length > 8 ? (
                            <SearchableSelect
                              value={field.value}
                              onChange={field.onChange}
                              options={dockOptions}
                              placeholder="Selecione uma doca"
                              searchPlaceholder="Buscar doca por nome..."
                              emptyText="Nenhuma doca encontrada"
                              dataTestid="select-dock"
                              renderSelected={(val) => {
                                const dock = docks.find((d) => d.id === val);
                                return dock ? (
                                  <span className="truncate">{dock.name}</span>
                                ) : (
                                  <span className="text-muted-foreground">Selecione uma doca</span>
                                );
                              }}
                            />
                          ) : (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-dock" className="h-10 bg-card">
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
                          )}
                        </FormControl>
                        {docks.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Nenhuma doca cadastrada. Cadastre uma doca antes de criar a movimentação.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Section 4: Resumo */}
              {(watchedValues.name || selectedType || selectedEvents.length > 0 || selectedDock) && (
                <>
                  <SectionTitle icon={ClipboardList} title="Resumo" />
                  <Card className="border-border/60 bg-muted/30">
                    <CardContent className="p-3 space-y-2">
                      {watchedValues.name && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Nome:</span>
                          <span className="text-xs font-medium truncate">{watchedValues.name}</span>
                        </div>
                      )}
                      {selectedType && (
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Tipo:</span>
                          <span className="text-xs font-medium">
                            {movementTypeFriendlyLabel(selectedType.name)}
                          </span>
                        </div>
                      )}
                      {selectedEvents.length > 0 && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground">Evento:</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedEvents.map((e) => (
                              <Badge key={e.id} variant="outline" className="text-[10px] h-4 px-1">
                                {e.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedTrips.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Route className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground">Plano de Viagens:</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedTrips.map((t) => (
                              <Badge key={t.id} variant="outline" className="text-[10px] h-4 px-1">
                                {t.description || `Plano de Viagens ${t.id.substring(0, 8)}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedOrder && (
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Ordem:</span>
                          <span className="text-xs font-medium">{selectedOrder.orderNumber}</span>
                        </div>
                      )}
                      {watchedValues.vehiclePlate && (
                        <div className="flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Veículo:</span>
                          <span className="text-xs font-medium">{watchedValues.vehiclePlate}</span>
                        </div>
                      )}
                      {selectedDock && (
                        <div className="flex items-center gap-2">
                          <Warehouse className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Doca:</span>
                          <span className="text-xs font-medium">{selectedDock.name}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 bg-muted/50 p-4 border-t border-border flex flex-col sm:flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              {(isEditMode ? userCanEditMovement(user) : userCanCreateMovement(user)) && (
                <Button
                  type="submit"
                  disabled={!isValid || isPending}
                  data-testid="button-submit"
                  className="w-full sm:w-auto"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isEditMode ? "Salvando..." : "Criando..."}
                    </>
                  ) : isEditMode ? (
                    "Salvar Alterações"
                  ) : (
                    "Criar Movimentação"
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

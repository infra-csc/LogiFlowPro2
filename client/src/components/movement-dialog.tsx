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
import type { LoadingOrder, Dock, Event, Trip, Movement, MovementTypeConfig, MaterialRequest, Product } from "@shared/schema";
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
  Minus,
  Plus,
  Calendar,
  Clock,
  User,
  Navigation,
  ChevronRight,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  movementTypeConfigId: z.string().min(1, "Tipo de movimentação é obrigatório"),
  eventIds: z.array(z.string()).optional().default([]),
  tripIds: z.array(z.string()).optional(),
  loadingOrderId: z.string().optional(),
  requestId: z.string().optional(),
  vehiclePlate: z.string().optional(),
  dockId: z.string().optional(),
  productItems: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })).optional().default([]),
});

type FormData = z.infer<typeof formSchema>;

type TripWithRelations = Trip & {
  event?: Event | null;
  vehicle?: { id: string; plate: string; model?: string | null } | null;
  vehicleType?: { id: string; name: string; capacity?: number | null } | null;
  driver?: { id: string; name: string; phone?: string | null } | null;
  dock?: { id: string; name: string } | null;
  destinations?: Array<{
    id: string;
    location: string;
    arrivalDateTime: string | Date;
    sequence: number;
    notes?: string | null;
  }>;
};

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

// Trip status helpers
function tripStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    planned: "Planejado", in_progress: "Em andamento",
    completed: "Concluído", cancelled: "Cancelado",
  };
  return labels[status] || status;
}
function tripStatusClass(status: string): string {
  const classes: Record<string, string> = {
    planned: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  };
  return classes[status] || "bg-muted text-muted-foreground";
}

function fmtDt(val: string | Date | null | undefined): string {
  if (!val) return "—";
  try { return format(new Date(val), "dd MMM HH:mm", { locale: ptBR }); }
  catch { return "—"; }
}

// Trip detail side panel shown when one or more trips are selected
function TripDetailPanel({ trips }: { trips: TripWithRelations[] }) {
  return (
    <div className="flex flex-col gap-5 p-4">
      {trips.map((trip) => {
        const sortedDests = [...(trip.destinations || [])].sort((a, b) => a.sequence - b.sequence);
        return (
          <div key={trip.id} className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm text-foreground leading-tight">
                {trip.description || `Plano de Viagens ${trip.id.substring(0, 8)}`}
              </p>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", tripStatusClass(trip.status))}>
                {tripStatusLabel(trip.status)}
              </Badge>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {trip.event && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Evento</span>
                    <p className="text-foreground font-medium leading-snug">{trip.event.name}</p>
                  </div>
                </div>
              )}
              {trip.vehicleType && (
                <div className="flex items-start gap-2">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Tipo de veículo</span>
                    <p className="text-foreground font-medium leading-snug">
                      {trip.vehicleType.name}
                      {trip.vehicle ? ` · ${trip.vehicle.plate}` : ""}
                    </p>
                  </div>
                </div>
              )}
              {trip.driver && (
                <div className="flex items-start gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Motorista</span>
                    <p className="text-foreground font-medium leading-snug">{trip.driver.name}</p>
                  </div>
                </div>
              )}
              {trip.dock && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Doca</span>
                    <p className="text-foreground font-medium leading-snug">{trip.dock.name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Loading window */}
            {(trip.loadingStartTime || trip.loadingEndTime || trip.loadingLocation) && (
              <div className="rounded-md border border-border/60 bg-card p-2.5 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Carregamento</p>
                {trip.loadingLocation && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{trip.loadingLocation}</span>
                  </div>
                )}
                {(trip.loadingStartTime || trip.loadingEndTime) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{fmtDt(trip.loadingStartTime)}</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span>{fmtDt(trip.loadingEndTime)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Departure */}
            {trip.departureDateTime && (
              <div className="flex items-center gap-2 text-xs">
                <Navigation className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Partida:</span>
                <span className="text-foreground font-medium">{fmtDt(trip.departureDateTime)}</span>
              </div>
            )}

            {/* Unloading window */}
            {(trip.unloadingStartTime || trip.unloadingEndTime || trip.unloadingLocation) && (
              <div className="rounded-md border border-border/60 bg-card p-2.5 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descarregamento</p>
                {trip.unloadingLocation && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{trip.unloadingLocation}</span>
                  </div>
                )}
                {(trip.unloadingStartTime || trip.unloadingEndTime) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{fmtDt(trip.unloadingStartTime)}</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span>{fmtDt(trip.unloadingEndTime)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Destinations */}
            {sortedDests.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Destinos ({sortedDests.length})
                </p>
                <div className="space-y-1">
                  {sortedDests.map((dest, idx) => (
                    <div key={dest.id} className="flex items-start gap-2 text-xs">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0 text-[10px] font-bold mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground font-medium truncate">{dest.location}</p>
                        <p className="text-muted-foreground">{fmtDt(dest.arrivalDateTime)}</p>
                        {dest.notes && <p className="text-muted-foreground italic">{dest.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {trip.notes && (
              <div className="flex items-start gap-2 text-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Observações</span>
                  <p className="text-foreground leading-snug mt-0.5">{trip.notes}</p>
                </div>
              </div>
            )}

            {trips.indexOf(trip) < trips.length - 1 && (
              <div className="border-t border-border/40 pt-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
          <CommandList className="max-h-[400px]">
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
  const [linkType, setLinkType] = useState<"order" | "request">(
    movement?.requestId ? "request" : "order"
  );

  const { data: loadingOrders = [] } = useQuery<LoadingOrder[]>({
    queryKey: ["/api/loading-orders"],
  });

  const { data: requests = [] } = useQuery<(MaterialRequest & { event?: Event })[]>({
    queryKey: ["/api/requests"],
  });

  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: trips = [] } = useQuery<TripWithRelations[]>({
    queryKey: ["/api/trips"],
  });

  const { data: movementTypes = [] } = useQuery<MovementTypeConfig[]>({
    queryKey: ["/api/movement-types-config"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
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
      requestId: undefined,
      vehiclePlate: undefined,
      dockId: undefined,
      productItems: [],
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
        requestId: movement.requestId ?? undefined,
        vehiclePlate: movement.vehiclePlate ?? undefined,
        dockId: movement.dockId ?? undefined,
        productItems: [],
      });
      setLinkType(movement.requestId ? "request" : "order");
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
        requestId: undefined,
        vehiclePlate: undefined,
        dockId: undefined,
        productItems: [],
      });
      setLinkType("order");
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
        requestId: undefined,
        vehiclePlate: undefined,
        dockId: undefined,
        productItems: [],
      });
      setLinkType("order");
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
      loadingOrderId: linkType === "order" ? (data.loadingOrderId || null) : null,
      requestId: linkType === "request" ? (data.requestId || null) : null,
      vehiclePlate: data.vehiclePlate || undefined,
      dockId: data.dockId || undefined,
      productItems: isEditMode ? [] : (data.productItems || []),
    };

    if (isEditMode) {
      updateMutation.mutate(normalizedData as any);
    } else {
      createMutation.mutate(normalizedData as any);
    }
  };

  const approvedOrders = useMemo(
    () => loadingOrders.filter((order) => order.status === "approved" || order.status === "in_progress"),
    [loadingOrders]
  );

  const linkableRequests = useMemo(
    () => requests.filter((r) => !["draft", "pending_approval", "rejected"].includes(r.status)),
    [requests]
  );

  // Computed data for summary
  const selectedType = activeMovementTypes.find((t) => t.id === watchedValues.movementTypeConfigId);
  const selectedEvents = events.filter((e) => (watchedValues.eventIds || []).includes(e.id));
  const selectedTrips = trips.filter((t) => (watchedValues.tripIds || []).includes(t.id));
  const selectedOrder = approvedOrders.find((o) => o.id === watchedValues.loadingOrderId);
  const selectedRequest = linkableRequests.find((r) => r.id === watchedValues.requestId);
  const selectedDock = docks.find((d) => d.id === watchedValues.dockId);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isValid = form.formState.isValid;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={cn(
          "max-h-[92vh] overflow-hidden p-0 flex flex-col transition-all duration-300",
          selectedTrips.length > 0 ? "max-w-5xl" : "max-w-xl"
        )}
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
            <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-5 min-w-0" style={{ scrollbarWidth: "thin" }}>
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
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {selectedType.nature === "inbound" && (
                              <Badge variant="outline" className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                Entrada
                              </Badge>
                            )}
                            {selectedType.nature === "outbound" && (
                              <Badge variant="outline" className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                Saída
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {movementTypeHint(selectedType.name)}
                            </p>
                          </div>
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
                          {unselectedTrips.length > 0 ? (
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
                              Nenhum plano de viagens disponível
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

                {/* Vínculo: Ordem de carregamento OU Requisição (mutuamente exclusivos) */}
                <div>
                  <FormLabel className="text-sm font-medium">Vínculo (opcional)</FormLabel>
                  <p className="text-xs text-muted-foreground mb-2">
                    Vincule a uma ordem de carregamento ou diretamente a uma requisição.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={linkType === "order" ? "default" : "outline"}
                      size="sm"
                      data-testid="button-link-type-order"
                      onClick={() => {
                        setLinkType("order");
                        form.setValue("requestId", undefined);
                      }}
                    >
                      Ordem de carregamento
                    </Button>
                    <Button
                      type="button"
                      variant={linkType === "request" ? "default" : "outline"}
                      size="sm"
                      data-testid="button-link-type-request"
                      onClick={() => {
                        setLinkType("request");
                        form.setValue("loadingOrderId", undefined);
                      }}
                    >
                      Requisição
                    </Button>
                  </div>
                </div>

                {/* Ordem de Carregamento */}
                {linkType === "order" && (
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
                )}

                {/* Requisição (alternativa à ordem de carregamento) */}
                {linkType === "request" && (
                <FormField
                  control={form.control}
                  name="requestId"
                  render={({ field }) => {
                    const selectedEventIds = form.watch("eventIds") || [];
                    const filteredRequests =
                      selectedEventIds.length > 0
                        ? linkableRequests.filter((r) => selectedEventIds.includes(r.eventId))
                        : linkableRequests;
                    const requestOptions = filteredRequests.map((r) => {
                      const event = events.find((e) => e.id === r.eventId);
                      return {
                        value: r.id,
                        label: `${event?.name || "Evento"} — ${r.area}`,
                        searchText: `${r.area} ${event?.name || ""}`.toLowerCase(),
                      };
                    });

                    return (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Requisição (opcional)</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value || ""}
                            onChange={(val) => field.onChange(val || undefined)}
                            options={requestOptions}
                            placeholder="Selecione uma requisição (opcional)"
                            searchPlaceholder="Buscar requisição por área ou evento..."
                            emptyText="Nenhuma requisição encontrada"
                            dataTestid="select-request"
                            disabled={selectedEventIds.length === 0 && linkableRequests.length === 0}
                            renderItem={(option) => {
                              const request = linkableRequests.find((r) => r.id === option.value);
                              const event = events.find((e) => e.id === request?.eventId);
                              return (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{option.label}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {event?.name || "Evento"} · {request?.area}
                                  </span>
                                </div>
                              );
                            }}
                            renderSelected={(val) => {
                              const request = linkableRequests.find((r) => r.id === val);
                              const event = events.find((e) => e.id === request?.eventId);
                              return request ? (
                                <span className="truncate">
                                  {event?.name || "Evento"} — {request.area}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Selecione uma requisição (opcional)</span>
                              );
                            }}
                          />
                        </FormControl>
                        {selectedEventIds.length > 0 && filteredRequests.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Nenhuma requisição disponível para os eventos selecionados
                          </p>
                        )}
                        {selectedEventIds.length === 0 && linkableRequests.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            Nenhuma requisição disponível
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                )}
              </div>

              {/* Section 3: Itens (only on create) */}
              {!isEditMode && (
                <>
                  <SectionTitle icon={Package} title="Itens" />
                  <FormField
                    control={form.control}
                    name="productItems"
                    render={({ field }) => {
                      const items: { productId: string; quantity: number }[] = field.value || [];
                      const usedIds = items.map((i) => i.productId);
                      const productOptions = products
                        .filter((p) => !usedIds.includes(p.id))
                        .map((p) => ({
                          value: p.id,
                          label: `${p.name} (${p.sku})`,
                          searchText: `${p.name} ${p.sku}`.toLowerCase(),
                        }));

                      return (
                        <FormItem>
                          <div className="space-y-2">
                            {items.length > 0 && (
                              <div className="space-y-1">
                                {items.map((item, idx) => {
                                  const prod = products.find((p) => p.id === item.productId);
                                  return (
                                    <div
                                      key={item.productId}
                                      className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2"
                                    >
                                      <span className="flex-1 text-sm font-medium truncate">
                                        {prod ? `${prod.name} (${prod.sku})` : item.productId}
                                      </span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          disabled={item.quantity <= 1}
                                          onClick={() => {
                                            const updated = items.map((it, i) =>
                                              i === idx ? { ...it, quantity: it.quantity - 1 } : it
                                            );
                                            field.onChange(updated);
                                          }}
                                          data-testid={`button-dec-qty-${idx}`}
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center text-sm font-medium tabular-nums">
                                          {item.quantity}
                                        </span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => {
                                            const updated = items.map((it, i) =>
                                              i === idx ? { ...it, quantity: it.quantity + 1 } : it
                                            );
                                            field.onChange(updated);
                                          }}
                                          data-testid={`button-inc-qty-${idx}`}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-destructive"
                                          onClick={() => {
                                            field.onChange(items.filter((_, i) => i !== idx));
                                          }}
                                          data-testid={`button-remove-item-${idx}`}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {productOptions.length > 0 ? (
                              <FormControl>
                                <SearchableSelect
                                  value=""
                                  onChange={(val) => {
                                    if (val) {
                                      field.onChange([...items, { productId: val, quantity: 1 }]);
                                    }
                                  }}
                                  options={productOptions}
                                  placeholder="Adicionar produto..."
                                  searchPlaceholder="Buscar produto por nome ou SKU..."
                                  emptyText="Nenhum produto encontrado"
                                  dataTestid="select-product-item"
                                  renderItem={(option) => {
                                    const prod = products.find((p) => p.id === option.value);
                                    return (
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">{prod?.name}</span>
                                        <span className="text-[10px] text-muted-foreground">{prod?.sku}</span>
                                      </div>
                                    );
                                  }}
                                  renderSelected={() => (
                                    <span className="text-muted-foreground">Adicionar produto...</span>
                                  )}
                                />
                              </FormControl>
                            ) : items.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Nenhum produto cadastrado
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Todos os produtos foram adicionados
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Opcional — pré-popula a lista de itens da movimentação.
                            </p>
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </>
              )}

              {/* Section 4: Operação */}
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
                        <FormLabel className="text-sm font-medium">Doca (opcional)</FormLabel>
                        <FormControl>
                          {docks.length > 8 ? (
                            <SearchableSelect
                              value={field.value ?? ""}
                              onChange={(val) => field.onChange(val || undefined)}
                              options={dockOptions}
                              placeholder="Selecione uma doca (opcional)"
                              searchPlaceholder="Buscar doca por nome..."
                              emptyText="Nenhuma doca encontrada"
                              dataTestid="select-dock"
                              renderSelected={(val) => {
                                const dock = docks.find((d) => d.id === val);
                                return dock ? (
                                  <span className="truncate">{dock.name}</span>
                                ) : (
                                  <span className="text-muted-foreground">Selecione uma doca (opcional)</span>
                                );
                              }}
                            />
                          ) : (
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-dock" className="h-10 bg-card">
                                  <SelectValue placeholder="Selecione uma doca (opcional)" />
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
                            Nenhuma doca cadastrada.
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
                      {selectedRequest && (
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Requisição:</span>
                          <span className="text-xs font-medium">
                            {selectedRequest.event?.name ? `${selectedRequest.event.name} — ` : ""}{selectedRequest.area}
                          </span>
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
                      {!isEditMode && (watchedValues.productItems || []).length > 0 && (
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Itens:</span>
                          <span className="text-xs font-medium">
                            {(watchedValues.productItems || []).length} produto{(watchedValues.productItems || []).length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
            {/* Trip detail panel — right column */}
            {selectedTrips.length > 0 && (
              <div className="w-[360px] border-l border-border overflow-y-auto bg-muted/20 shrink-0" style={{ scrollbarWidth: "thin" }}>
                <div className="p-3 border-b border-border/60 bg-muted/40 shrink-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Detalhes do plano de viagens
                  </p>
                </div>
                <TripDetailPanel trips={selectedTrips} />
              </div>
            )}
            </div>{/* end flex row */}

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

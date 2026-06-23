import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueries } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { userCanCreateMovement, userCanEditMovement } from "@/lib/authz";
import type {
  LoadingOrder, Dock, Event, Trip, Movement,
  MovementTypeConfig, MaterialRequest, Product,
  RequestItem, LoadingOrderItem,
} from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  X, Check, ChevronsUpDown, Loader2, AlertCircle,
  Truck, Package, MapPin, Route, ClipboardList,
  Warehouse, Tag, FileText, Info, Minus, Plus,
  Calendar, Clock, User, Navigation, ChevronRight,
  Building2, CheckCircle2, AlertTriangle, StickyNote,
  ListOrdered, Layers, ChevronDown, ChevronLeft,
  ArrowRight, Circle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Form schema ──────────────────────────────────────────────────────────────
const formSchema = z.object({
  name: z.string().min(1, "Informe um nome para a movimentação."),
  movementTypeConfigId: z.string().min(1, "Selecione o tipo da movimentação."),
  eventIds: z.array(z.string()).optional().default([]),
  tripIds: z.array(z.string()).optional(),
  loadingOrderId: z.string().optional(),
  requestIds: z.array(z.string()).optional().default([]),
  vehiclePlate: z.string().optional(),
  dockId: z.string().optional(),
  notes: z.string().optional(),
  productItems: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })).optional().default([]),
});
type FormData = z.infer<typeof formSchema>;

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Identificação",      icon: Tag },
  { id: 2, label: "Vínculos e itens",   icon: Layers },
  { id: 3, label: "Logística e revisão", icon: Truck },
] as const;

// ─── Extended trip type ───────────────────────────────────────────────────────
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
  requests?: Array<{ id: string; area: string | null; eventId: string | null; status: string; event?: { id: string | null; name: string } | null }>;
};

interface MovementDialogProps {
  children: React.ReactNode;
  movement?: MovementWithRelations;
}

// ─── Label/hint helpers ───────────────────────────────────────────────────────
const movementTypeFriendlyLabel = (name: string): string => {
  const map: Record<string, string> = {
    outbound_event: "Saída para evento",
    inbound_event: "Retorno de evento",
    inbound_purchase: "Entrada de compra",
    inbound_rental: "Entrada de aluguel",
    outbound_rental_return: "Saída para devolução de aluguel",
    internal_transfer: "Transferência interna",
    inventory_adjustment: "Ajuste de inventário",
  };
  return map[name] || name;
};

const movementTypeHint = (id: string, types: MovementTypeConfig[]): string => {
  const map: Record<string, string> = {
    outbound_event: "Registra saída de materiais do armazém para o evento.",
    inbound_event: "Registra retorno de materiais ao armazém.",
    inbound_purchase: "Registra entrada de materiais comprados.",
    inbound_rental: "Registra entrada de materiais alugados.",
    outbound_rental_return: "Registra devolução de materiais alugados.",
    internal_transfer: "Transfere materiais entre áreas do armazém.",
    inventory_adjustment: "Corrige divergências de estoque.",
  };
  const t = types.find((x) => x.id === id);
  return t ? (map[t.name] || "") : "";
};

// ─── Trip status helpers ──────────────────────────────────────────────────────
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
  try { return format(new Date(val as string), "dd MMM HH:mm", { locale: ptBR }); }
  catch { return "—"; }
}

// ─── StepIndicator ────────────────────────────────────────────────────────────
function StepIndicator({ currentStep, isEditMode }: { currentStep: number; isEditMode: boolean }) {
  if (isEditMode) return null;
  return (
    <div className="flex items-center gap-0 px-6 pb-3">
      {STEPS.map((step, idx) => {
        const isActive = step.id === currentStep;
        const isDone = step.id < currentStep;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-medium",
              isActive && "bg-primary text-primary-foreground",
              isDone && "text-emerald-600 dark:text-emerald-400",
              !isActive && !isDone && "text-muted-foreground",
            )}>
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Icon className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <ChevronRight className={cn(
                "h-3.5 w-3.5 mx-1 shrink-0",
                currentStep > step.id ? "text-emerald-500" : "text-muted-foreground/40",
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── BlockSection ─────────────────────────────────────────────────────────────
function BlockSection({
  icon: Icon, title, description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <div className="flex-1 h-px bg-border/50 ml-1" />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 ml-8">{description}</p>
      )}
    </div>
  );
}

// ─── TripDetailPanel ──────────────────────────────────────────────────────────
function TripDetailPanel({ trips }: { trips: TripWithRelations[] }) {
  return (
    <div className="flex flex-col gap-5 p-4">
      {trips.map((trip, ti) => {
        const sortedDests = [...(trip.destinations || [])].sort((a, b) => a.sequence - b.sequence);
        return (
          <div key={trip.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm text-foreground leading-tight">
                {trip.description || `Plano ${trip.id.substring(0, 8)}`}
              </p>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", tripStatusClass(trip.status))}>
                {tripStatusLabel(trip.status)}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {trip.event && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div><span className="text-muted-foreground block">Evento</span>
                    <p className="text-foreground font-medium leading-snug">{trip.event.name}</p></div>
                </div>
              )}
              {trip.vehicleType && (
                <div className="flex items-start gap-2">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div><span className="text-muted-foreground block">Veículo</span>
                    <p className="text-foreground font-medium leading-snug">
                      {trip.vehicleType.name}{trip.vehicle ? ` · ${trip.vehicle.plate}` : ""}
                    </p></div>
                </div>
              )}
              {trip.driver && (
                <div className="flex items-start gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div><span className="text-muted-foreground block">Motorista</span>
                    <p className="text-foreground font-medium leading-snug">{trip.driver.name}</p></div>
                </div>
              )}
              {trip.dock && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div><span className="text-muted-foreground block">Doca</span>
                    <p className="text-foreground font-medium leading-snug">{trip.dock.name}</p></div>
                </div>
              )}
            </div>
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
            {trip.departureDateTime && (
              <div className="flex items-center gap-2 text-xs">
                <Navigation className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Partida:</span>
                <span className="text-foreground font-medium">{fmtDt(trip.departureDateTime)}</span>
              </div>
            )}
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
            {trip.notes && (
              <div className="flex items-start gap-2 text-xs">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div><span className="text-muted-foreground block">Obs. do plano</span>
                  <p className="text-foreground leading-snug mt-0.5">{trip.notes}</p></div>
              </div>
            )}
            {ti < trips.length - 1 && <div className="border-t border-border/40" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── SearchableSelect ─────────────────────────────────────────────────────────
type SelectOption = { value: string; label: string; searchText: string };
type SelectGroup = { label: string; options: SelectOption[] };

function SearchableSelect({
  value, onChange, options, groups, placeholder, searchPlaceholder, emptyText,
  disabled, dataTestid, renderItem, renderSelected,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  groups?: SelectGroup[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  dataTestid?: string;
  renderItem?: (option: { value: string; label: string }) => React.ReactNode;
  renderSelected?: (value: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const allOptions = groups ? groups.flatMap((g) => g.options) : options;
  const selected = allOptions.find((o) => o.value === value);

  function renderCommandItem(option: SelectOption) {
    return (
      <CommandItem
        key={option.value}
        value={option.searchText}
        onSelect={() => {
          onChange(option.value === value ? "" : option.value);
          setOpen(false);
        }}
      >
        <div className="flex items-center gap-2 w-full">
          <Check className={cn("h-4 w-4 shrink-0", value === option.value ? "opacity-100" : "opacity-0")} />
          {renderItem ? renderItem(option) : <span className="text-sm">{option.label}</span>}
        </div>
      </CommandItem>
    );
  }

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
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups ? (
              groups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.options.map(renderCommandItem)}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {options.map(renderCommandItem)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── ReviewRow ────────────────────────────────────────────────────────────────
function ReviewRow({
  icon: Icon, label, children, faded,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  faded?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <span className="text-muted-foreground block leading-tight">{label}</span>
        <div className={cn("mt-0.5", faded && "text-muted-foreground italic")}>{children}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MovementDialog({ children, movement }: MovementDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditMode = !!movement;

  const [linkType, setLinkType] = useState<"order" | "request">(
    (movement?.requests && movement.requests.length > 0) || (movement as any)?.requestId ? "request" : "order"
  );
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [tripDetailExpanded, setTripDetailExpanded] = useState(false);

  // ─ Queries ──────────────────────────────────────────────────────────────────
  const { data: loadingOrders = [] } = useQuery<LoadingOrder[]>({ queryKey: ["/api/loading-orders"] });
  const { data: requests = [] } = useQuery<(MaterialRequest & { event?: Event })[]>({ queryKey: ["/api/requests"] });
  const { data: docks = [] } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: trips = [] } = useQuery<TripWithRelations[]>({ queryKey: ["/api/trips"] });
  const { data: movementTypes = [] } = useQuery<MovementTypeConfig[]>({ queryKey: ["/api/movement-types-config"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: existingMovements = [] } = useQuery<Movement[]>({ queryKey: ["/api/movements"] });

  const activeMovementTypes = useMemo(() => movementTypes.filter((mt) => mt.active), [movementTypes]);

  // ─ Form ─────────────────────────────────────────────────────────────────────
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", movementTypeConfigId: "",
      eventIds: [], tripIds: [],
      loadingOrderId: undefined, requestIds: [],
      vehiclePlate: undefined, dockId: undefined,
      notes: undefined, productItems: [],
    },
  });

  const watchedValues = form.watch();

  // ─ Multiple request items via useQueries ─────────────────────────────────────
  const selectedRequestIds = watchedValues.requestIds || [];
  const reqItemsResults = useQueries({
    queries: selectedRequestIds.map((id) => ({
      queryKey: ["/api/requests", id, "items"] as [string, string, string],
      enabled: !!id && linkType === "request",
    })),
  });

  const reqItemsLoading = reqItemsResults.some((r) => r.isPending);

  // Consolidate items from ALL requests: merge duplicate productIds (sum quantities)
  // Derived directly from reqItemsResults.data values to avoid unstable array ref in deps
  const consolidatedReqItems = useMemo(() => {
    const map = new Map<string, { productId: string; qty: number; name: string; sku: string }>();
    for (const result of reqItemsResults) {
      const items = (result.data as (RequestItem & { product?: Product })[] | undefined) ?? [];
      for (const item of items) {
        if (!item.productId) continue;
        const qty = item.approvedQuantity ?? item.quantity;
        const prod = products.find((p) => p.id === item.productId);
        const existing = map.get(item.productId);
        if (existing) {
          existing.qty += qty;
        } else {
          map.set(item.productId, {
            productId: item.productId,
            qty,
            name: prod?.name || item.productId,
            sku: prod?.sku || "",
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Depend on the serialized data so memo only re-runs when actual data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(reqItemsResults.map((r) => r.data)),
    products,
  ]);

  // Order items
  const { data: orderItemsRaw = [] } = useQuery<(LoadingOrderItem & { product?: Product })[]>({
    queryKey: ["/api/loading-orders", watchedValues.loadingOrderId, "items"],
    enabled: !!watchedValues.loadingOrderId,
  });

  // ─ Reset on open ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setStep(1);
      if (isEditMode && movement) {
        form.reset({
          name: movement.name || "",
          movementTypeConfigId: movement.movementTypeConfigId || "",
          eventIds: movement.events?.map((e) => e.id) || [],
          tripIds: movement.trips?.map((t) => t.id) || [],
          loadingOrderId: movement.loadingOrderId || undefined,
          requestIds: movement.requests?.map((r) => r.id) || ((movement as any).requestId ? [(movement as any).requestId] : []),
          vehiclePlate: movement.vehiclePlate || undefined,
          dockId: movement.dockId || undefined,
          notes: (movement as any).notes || undefined,
          productItems: [],
        });
        setLinkType((movement.requests && movement.requests.length > 0) || (movement as any).requestId ? "request" : "order");
      } else {
        form.reset({
          name: "", movementTypeConfigId: "",
          eventIds: [], tripIds: [],
          loadingOrderId: undefined, requestIds: [],
          vehiclePlate: undefined, dockId: undefined,
          notes: undefined, productItems: [],
        });
        setLinkType("order");
        setAutoFilledFields(new Set());
      }
    }
  }, [open, isEditMode, movement]);

  // ─ Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/movements", data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Movimentação criada", description: "A movimentação foi criada com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      setOpen(false);
      form.reset({
        name: "", movementTypeConfigId: "",
        eventIds: [], tripIds: [],
        loadingOrderId: undefined, requestIds: [],
        vehiclePlate: undefined, dockId: undefined,
        notes: undefined, productItems: [],
      });
      setLinkType("order");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar movimentação", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!movement) throw new Error("No movement to update");
      const res = await apiRequest("PATCH", `/api/movements/${movement.id}`, data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Movimentação atualizada", description: "A movimentação foi atualizada com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movements", movement?.id] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar movimentação", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: FormData) => {
    const normalized = {
      ...data,
      loadingOrderId: linkType === "order" ? (data.loadingOrderId || null) : null,
      requestIds: linkType === "request" ? (data.requestIds || []) : [],
      vehiclePlate: data.vehiclePlate || undefined,
      dockId: data.dockId || undefined,
      notes: data.notes || undefined,
      productItems: isEditMode ? [] : (data.productItems || []),
    };
    if (isEditMode) updateMutation.mutate(normalized as any);
    else createMutation.mutate(normalized as any);
  };

  // ─ Derived values ────────────────────────────────────────────────────────────
  const approvedOrders = useMemo(
    () => loadingOrders.filter((o) => o.status === "approved" || o.status === "in_progress"),
    [loadingOrders]
  );

  const usedRequestIds = useMemo(() => {
    const currentId = movement?.id;
    const used = new Set<string>();
    for (const m of existingMovements as any[]) {
      if (m.id === currentId) continue;
      if (m.requests && Array.isArray(m.requests)) {
        for (const r of m.requests) used.add(r.id);
      }
      if (m.requestId) used.add(m.requestId);
    }
    return used;
  }, [existingMovements, movement?.id]);

  const linkableRequests = useMemo(
    () => requests.filter(
      (r) =>
        !["draft", "pending_approval", "rejected"].includes(r.status) &&
        !usedRequestIds.has(r.id)
    ),
    [requests, usedRequestIds]
  );

  const selectedType = activeMovementTypes.find((t) => t.id === watchedValues.movementTypeConfigId);
  const selectedEvents = events.filter((e) => (watchedValues.eventIds || []).includes(e.id));
  const selectedTrips = trips.filter((t) => (watchedValues.tripIds || []).includes(t.id));
  const selectedOrder = approvedOrders.find((o) => o.id === watchedValues.loadingOrderId);
  const selectedRequests = linkableRequests.filter((r) => selectedRequestIds.includes(r.id));
  const selectedDock = docks.find((d) => d.id === watchedValues.dockId);
  const productItems = watchedValues.productItems || [];
  const totalUnits = productItems.reduce((s, i) => s + i.quantity, 0);

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─ Step 1 validation (name + type required) ──────────────────────────────────
  const step1Valid = !!(watchedValues.name?.trim() && watchedValues.movementTypeConfigId);
  const step1Missing: string[] = [];
  if (!watchedValues.name?.trim()) step1Missing.push("Nome");
  if (!watchedValues.movementTypeConfigId) step1Missing.push("Tipo");

  // ─ Step navigation ────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (step === 1) { if (!step1Valid) return; setStep(2); }
    else if (step === 2) setStep(3);
  };
  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  // In edit mode always treat as step 3 (all fields visible)
  const effectiveStep = isEditMode ? 3 : step;

  // ─ NATURE ORDER for type grouping ────────────────────────────────────────────
  const NATURE_ORDER: Record<string, number> = { outbound: 0, inbound: 1, transfer: 2, adjustment: 3 };
  const NATURE_LABEL: Record<string, string> = { outbound: "Saída", inbound: "Entrada", transfer: "Transferência", adjustment: "Ajuste" };

  const sortedTypes = useMemo(() => [...activeMovementTypes].sort((a, b) => {
    const nA = NATURE_ORDER[a.nature] ?? 99;
    const nB = NATURE_ORDER[b.nature] ?? 99;
    if (nA !== nB) return nA - nB;
    return movementTypeFriendlyLabel(a.name).localeCompare(movementTypeFriendlyLabel(b.name), "pt-BR");
  }), [activeMovementTypes]);

  const typeGroups: SelectGroup[] = useMemo(() => {
    const naturesPresent = Array.from(new Set(sortedTypes.map((t) => t.nature)));
    return naturesPresent.map((nature) => ({
      label: NATURE_LABEL[nature] ?? nature,
      options: sortedTypes
        .filter((t) => t.nature === nature)
        .map((t) => ({
          value: t.id,
          label: movementTypeFriendlyLabel(t.name),
          searchText: `${NATURE_LABEL[t.nature] ?? t.nature} ${movementTypeFriendlyLabel(t.name)} ${t.name}`.toLowerCase(),
        })),
    }));
  }, [sortedTypes]);

  const typeOptions = typeGroups.flatMap((g) => g.options);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="w-[min(1280px,calc(100vw-32px))] max-w-none max-h-[calc(100vh-40px)] overflow-hidden p-0 flex flex-col"
        data-testid="dialog-movement"
      >
        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <div className="shrink-0 border-b border-border">
          <div className="px-6 pt-5 pb-2">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {isEditMode ? "Editar Movimentação" : "Nova Movimentação"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {isEditMode
                  ? "Edite os campos desta movimentação operacional."
                  : "Preencha os dados em 3 etapas para criar uma movimentação operacional."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Stepper */}
          <StepIndicator currentStep={step} isEditMode={isEditMode} />

          {/* Context chips */}
          {(selectedType || selectedEvents.length > 0 || productItems.length > 0 || selectedTrips.length > 0) && (
            <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
              {selectedType ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs gap-1",
                    selectedType.nature === "inbound"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : selectedType.nature === "outbound"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : ""
                  )}
                >
                  <Tag className="h-3 w-3" />
                  {movementTypeFriendlyLabel(selectedType.name)}
                </Badge>
              ) : null}
              {selectedEvents.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <MapPin className="h-3 w-3" />
                  {selectedEvents.length === 1 ? selectedEvents[0].name : `${selectedEvents.length} eventos`}
                </Badge>
              )}
              {!isEditMode && productItems.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1 bg-primary/5 border-primary/20 text-primary">
                  <Package className="h-3 w-3" />
                  {productItems.length} item{productItems.length !== 1 ? "s" : ""} · {totalUnits} un.
                </Badge>
              )}
              {selectedTrips.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Route className="h-3 w-3" />
                  {selectedTrips.length} plano{selectedTrips.length !== 1 ? "s" : ""} vinculado{selectedTrips.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* ══ BODY ════════════════════════════════════════════════════════════ */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex flex-1 overflow-hidden min-h-0">

              {/* ─ LEFT: Steps ────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 min-w-0" style={{ scrollbarWidth: "thin" }}>

                {/* ╔══ STEP 1: Identificação ══════════════════════════════╗ */}
                {(effectiveStep === 1 || isEditMode) && (
                  <div>
                    <BlockSection
                      icon={Tag}
                      title="Identificação"
                      description="Nome e tipo definem o propósito operacional desta movimentação."
                    />
                    <div className="space-y-4">
                      {/* Nome */}
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Nome da movimentação *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex.: Carga Night Run — Carreta 1"
                                data-testid="input-movement-name"
                                className="h-10"
                                {...field}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Use um nome fácil de localizar na operação.</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Tipo */}
                      <FormField
                        control={form.control}
                        name="movementTypeConfigId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Tipo de movimentação *</FormLabel>
                            <FormControl>
                              <SearchableSelect
                                value={field.value}
                                onChange={field.onChange}
                                options={typeOptions}
                                groups={typeGroups}
                                placeholder="Selecione o tipo..."
                                searchPlaceholder="Buscar tipo de movimentação..."
                                emptyText="Nenhum tipo encontrado"
                                dataTestid="select-movement-type"
                                renderItem={(option) => {
                                  const t = activeMovementTypes.find((x) => x.id === option.value);
                                  return (
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{option.label}</span>
                                        {t?.nature === "inbound" && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Entrada</Badge>
                                        )}
                                        {t?.nature === "outbound" && (
                                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">Saída</Badge>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">
                                        {movementTypeHint(option.value, activeMovementTypes)}
                                      </span>
                                    </div>
                                  );
                                }}
                                renderSelected={(val) => {
                                  const t = activeMovementTypes.find((x) => x.id === val);
                                  return t ? (
                                    <span className="truncate">{movementTypeFriendlyLabel(t.name)}</span>
                                  ) : (
                                    <span className="text-muted-foreground">Selecione o tipo...</span>
                                  );
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* ╔══ STEP 2: Vínculos e itens ════════════════════════════╗ */}
                {(effectiveStep === 2 || effectiveStep === 3 || isEditMode) && (
                  <>
                    {/* BLOCO: Eventos */}
                    <div>
                      <BlockSection
                        icon={MapPin}
                        title="Evento"
                        description="Vincule esta movimentação a um ou mais eventos."
                      />
                      <FormField
                        control={form.control}
                        name="eventIds"
                        render={({ field }) => {
                          const currentIds: string[] = field.value || [];
                          const unselected = events.filter((e) => !currentIds.includes(e.id));
                          const selectedList = events.filter((e) => currentIds.includes(e.id));
                          const eventOptions = unselected.map((e) => ({
                            value: e.id,
                            label: e.name,
                            searchText: e.name.toLowerCase(),
                          }));
                          return (
                            <FormItem>
                              <div className="space-y-2">
                                {selectedList.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {selectedList.map((e) => (
                                      <Badge key={e.id} variant="secondary" className="gap-1 pr-1" data-testid={`badge-event-${e.id}`}>
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        <span className="max-w-[200px] truncate">{e.name}</span>
                                        <Button
                                          type="button" variant="ghost" size="icon"
                                          className="h-4 w-4 p-0 hover:bg-transparent"
                                          onClick={() => field.onChange(currentIds.filter((id) => id !== e.id))}
                                          data-testid={`button-remove-event-${e.id}`}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {unselected.length > 0 ? (
                                  <FormControl>
                                    <SearchableSelect
                                      value=""
                                      onChange={(val) => { if (val) field.onChange([...currentIds, val]); }}
                                      options={eventOptions}
                                      placeholder="Adicionar evento..."
                                      searchPlaceholder="Buscar evento por nome..."
                                      emptyText="Nenhum evento encontrado"
                                      dataTestid="select-events"
                                      renderSelected={() => (
                                        <span className="text-muted-foreground">Adicionar evento...</span>
                                      )}
                                    />
                                  </FormControl>
                                ) : selectedList.length > 0 ? (
                                  <p className="text-xs text-muted-foreground">Todos os eventos foram selecionados.</p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Nenhum evento cadastrado.</p>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    {/* BLOCO: Plano de viagens */}
                    <div>
                      <BlockSection
                        icon={Route}
                        title="Plano de viagens"
                        description="Vincule a um plano. Placa e doca serão preenchidas automaticamente."
                      />
                      <FormField
                        control={form.control}
                        name="tripIds"
                        render={({ field }) => {
                          const selectedTripIds: string[] = field.value || [];
                          const selectedEventIds = form.watch("eventIds") || [];
                          const filteredTrips = selectedEventIds.length > 0
                            ? trips.filter((t) => selectedEventIds.includes(t.eventId))
                            : trips;
                          const selectedTripsList = filteredTrips.filter((t) => selectedTripIds.includes(t.id));
                          const unselectedTrips = filteredTrips.filter((t) => !selectedTripIds.includes(t.id));
                          const tripOptions = unselectedTrips.map((t) => {
                            const event = events.find((e) => e.id === t.eventId);
                            return {
                              value: t.id,
                              label: t.description || `Plano ${t.id.substring(0, 8)}`,
                              searchText: `${t.description || ""} ${event?.name || ""}`.toLowerCase(),
                            };
                          });
                          return (
                            <FormItem>
                              <div className="space-y-2">
                                {selectedTripsList.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {selectedTripsList.map((trip) => (
                                      <Badge key={trip.id} variant="secondary" className="gap-1 pr-1" data-testid={`badge-trip-${trip.id}`}>
                                        <Route className="h-3 w-3 shrink-0" />
                                        <span className="max-w-[200px] truncate">
                                          {trip.description || `Plano ${trip.id.substring(0, 8)}`}
                                        </span>
                                        <Button
                                          type="button" variant="ghost" size="icon"
                                          className="h-4 w-4 p-0 hover:bg-transparent"
                                          onClick={() => field.onChange(selectedTripIds.filter((id) => id !== trip.id))}
                                          data-testid={`button-remove-trip-${trip.id}`}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {unselectedTrips.length > 0 ? (
                                  <FormControl>
                                    <SearchableSelect
                                      value=""
                                      onChange={(val) => {
                                        if (!val) return;
                                        field.onChange([...selectedTripIds, val]);
                                        // Auto-fill from trip
                                        const addedTrip = trips.find((t) => t.id === val);
                                        if (!addedTrip) return;
                                        const filled: string[] = [];
                                        if (!form.getValues("vehiclePlate") && addedTrip.vehicle?.plate) {
                                          form.setValue("vehiclePlate", addedTrip.vehicle.plate);
                                          filled.push("vehiclePlate");
                                        }
                                        if (!form.getValues("dockId") && (addedTrip as any).dockId) {
                                          form.setValue("dockId", (addedTrip as any).dockId);
                                          filled.push("dockId");
                                        }
                                        if (addedTrip.eventId) {
                                          const currEventIds = form.getValues("eventIds") || [];
                                          if (!currEventIds.includes(addedTrip.eventId)) {
                                            form.setValue("eventIds", [...currEventIds, addedTrip.eventId]);
                                            filled.push("eventIds");
                                          }
                                        }
                                        if (filled.length > 0) {
                                          setAutoFilledFields((prev) => new Set([...Array.from(prev), ...filled]));
                                        }
                                      }}
                                      options={tripOptions}
                                      placeholder="Adicionar plano de viagens..."
                                      searchPlaceholder="Buscar plano por nome ou evento..."
                                      emptyText="Nenhum plano encontrado"
                                      dataTestid="select-trips"
                                      renderItem={(option) => {
                                        const t = trips.find((x) => x.id === option.value);
                                        const event = events.find((e) => e.id === t?.eventId);
                                        return (
                                          <div className="flex flex-col">
                                            <span className="text-sm font-medium">{option.label}</span>
                                            {event && (
                                              <span className="text-[10px] text-muted-foreground">
                                                Evento: {event.name}
                                              </span>
                                            )}
                                            {t?.vehicleType && (
                                              <span className="text-[10px] text-muted-foreground">
                                                {(t.vehicleType as any).name}{t.vehicle ? ` · ${(t.vehicle as any).plate}` : ""}
                                                {t.driver ? ` · ${(t.driver as any).name}` : ""}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }}
                                      renderSelected={() => (
                                        <span className="text-muted-foreground">Adicionar plano de viagens...</span>
                                      )}
                                    />
                                  </FormControl>
                                ) : selectedTripsList.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    {selectedEventIds.length > 0
                                      ? "Nenhum plano de viagens disponível para os eventos selecionados."
                                      : "Nenhum plano de viagens disponível."}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    Todos os planos disponíveis foram selecionados.
                                  </p>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    {/* BLOCO: Origem e vínculos */}
                    <div>
                      <BlockSection
                        icon={Layers}
                        title="Origens e vínculos"
                        description="Vincule a uma ordem de carregamento ou diretamente a requisições (mutuamente exclusivos)."
                      />
                      <div className="space-y-4">
                        {/* Toggle buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={linkType === "order" ? "default" : "outline"}
                            size="sm"
                            data-testid="button-link-type-order"
                            onClick={() => { setLinkType("order"); form.setValue("requestIds", []); }}
                          >
                            <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                            Ordem de carregamento
                          </Button>
                          <Button
                            type="button"
                            variant={linkType === "request" ? "default" : "outline"}
                            size="sm"
                            data-testid="button-link-type-request"
                            onClick={() => { setLinkType("request"); form.setValue("loadingOrderId", undefined); }}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Requisição
                          </Button>
                        </div>

                        {/* Order picker */}
                        {linkType === "order" && (
                          <FormField
                            control={form.control}
                            name="loadingOrderId"
                            render={({ field }) => {
                              const selectedEventIds = form.watch("eventIds") || [];
                              const filteredOrders = selectedEventIds.length > 0
                                ? approvedOrders.filter((o) => selectedEventIds.includes(o.eventId))
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
                                  <FormLabel className="text-sm font-medium">Ordem de carregamento</FormLabel>
                                  <FormControl>
                                    <SearchableSelect
                                      value={field.value || ""}
                                      onChange={(val) => field.onChange(val || undefined)}
                                      options={orderOptions}
                                      placeholder="Selecionar ordem (opcional)"
                                      searchPlaceholder="Buscar por número ou evento..."
                                      emptyText="Nenhuma ordem encontrada"
                                      dataTestid="select-loading-order"
                                      renderItem={(option) => {
                                        const order = approvedOrders.find((o) => o.id === option.value);
                                        const event = events.find((e) => e.id === order?.eventId);
                                        return (
                                          <div className="flex flex-col">
                                            <span className="text-sm font-medium">{order?.orderNumber}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                              {event?.name} · {order?.status === "approved" ? "Aprovada" : "Em progresso"}
                                            </span>
                                          </div>
                                        );
                                      }}
                                      renderSelected={(val) => {
                                        const order = approvedOrders.find((o) => o.id === val);
                                        const event = events.find((e) => e.id === order?.eventId);
                                        return order ? (
                                          <span className="truncate">{event?.name || "Evento"} — {order.orderNumber}</span>
                                        ) : (
                                          <span className="text-muted-foreground">Selecionar ordem (opcional)</span>
                                        );
                                      }}
                                    />
                                  </FormControl>
                                  {selectedOrder && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Ordem vinculada: {selectedOrder.orderNumber}
                                    </p>
                                  )}
                                  {selectedEvents.length > 0 && filteredOrders.length === 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">Nenhuma ordem aprovada para os eventos selecionados.</p>
                                  )}
                                  {selectedEvents.length === 0 && (
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                      <Info className="h-3 w-3" />
                                      Selecione um evento para filtrar as ordens disponíveis.
                                    </p>
                                  )}
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        )}

                        {/* Request picker */}
                        {linkType === "request" && (
                          <FormField
                            control={form.control}
                            name="requestIds"
                            render={({ field }) => {
                              const currentIds: string[] = field.value || [];
                              const selectedEventIds = form.watch("eventIds") || [];
                              const filteredRequests = selectedEventIds.length > 0
                                ? linkableRequests.filter((r) => selectedEventIds.includes(r.eventId ?? ""))
                                : linkableRequests;
                              const selectedList = filteredRequests.filter((r) => currentIds.includes(r.id));
                              const unselected = filteredRequests.filter((r) => !currentIds.includes(r.id));
                              const requestOptions = unselected.map((r) => {
                                const event = events.find((e) => e.id === r.eventId);
                                return {
                                  value: r.id,
                                  label: `${event?.name || "Evento"} — ${r.area}`,
                                  searchText: `${r.area} ${event?.name || ""}`.toLowerCase(),
                                };
                              });
                              return (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Requisições</FormLabel>
                                  <div className="space-y-2">
                                    {/* Cards for selected requests */}
                                    {selectedList.length > 0 && (
                                      <div className="space-y-2">
                                        {selectedList.map((req) => {
                                          const event = events.find((e) => e.id === req.eventId);
                                          return (
                                            <div
                                              key={req.id}
                                              className="flex items-start gap-3 rounded-md border border-border/60 bg-card px-3 py-2.5"
                                              data-testid={`card-request-${req.id}`}
                                            >
                                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{req.area}</p>
                                                {event && (
                                                  <p className="text-xs text-muted-foreground truncate">{event.name}</p>
                                                )}
                                                <Badge
                                                  variant="outline"
                                                  className="text-[10px] px-1.5 py-0 mt-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                                >
                                                  {(req.status as string) === "approved" ? "Aprovada" : (req.status as string) === "partial" ? "Parcial" : req.status}
                                                </Badge>
                                              </div>
                                              <Button
                                                type="button" variant="ghost" size="icon"
                                                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                                onClick={() => field.onChange(currentIds.filter((id) => id !== req.id))}
                                                data-testid={`button-remove-request-${req.id}`}
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {unselected.length > 0 ? (
                                      <FormControl>
                                        <SearchableSelect
                                          value=""
                                          onChange={(val) => { if (val) field.onChange([...currentIds, val]); }}
                                          options={requestOptions}
                                          placeholder="Adicionar requisição..."
                                          searchPlaceholder="Buscar requisição por nome ou evento..."
                                          emptyText="Nenhuma requisição disponível"
                                          dataTestid="select-requests"
                                          renderItem={(option) => {
                                            const req = linkableRequests.find((r) => r.id === option.value);
                                            const event = events.find((e) => e.id === req?.eventId);
                                            return (
                                              <div className="flex flex-col">
                                                <span className="text-sm font-medium">{req?.area}</span>
                                                <span className="text-[10px] text-muted-foreground">{event?.name}</span>
                                              </div>
                                            );
                                          }}
                                          renderSelected={() => (
                                            <span className="text-muted-foreground">Adicionar requisição...</span>
                                          )}
                                        />
                                      </FormControl>
                                    ) : selectedList.length === 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {selectedEvents.length > 0
                                          ? "Nenhuma requisição disponível para os eventos selecionados."
                                          : "Nenhuma requisição disponível."}
                                      </p>
                                    )}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              );
                            }}
                          />
                        )}

                        {!selectedOrder && selectedRequests.length === 0 && (
                          <div className="rounded-md bg-muted/40 border border-border/40 px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                              Você pode criar uma movimentação avulsa sem vínculos obrigatórios.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BLOCO: Itens (create mode only) */}
                    {!isEditMode && (
                      <div>
                        <BlockSection
                          icon={ListOrdered}
                          title="Itens da movimentação"
                          description="Pré-popule a lista de itens. Ajuste mais tarde na tela de detalhes."
                        />
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
                                <div className="space-y-3">
                                  {items.length > 0 && (
                                    <div className="space-y-1.5">
                                      {items.map((item, idx) => {
                                        const prod = products.find((p) => p.id === item.productId);
                                        return (
                                          <div
                                            key={item.productId}
                                            className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium truncate">{prod?.name || item.productId}</p>
                                              <p className="text-[10px] text-muted-foreground">{prod?.sku}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              <Button
                                                type="button" variant="ghost" size="icon" className="h-6 w-6"
                                                disabled={item.quantity <= 1}
                                                onClick={() => field.onChange(items.map((it, i) => i === idx ? { ...it, quantity: it.quantity - 1 } : it))}
                                                data-testid={`button-dec-qty-${idx}`}
                                              >
                                                <Minus className="h-3 w-3" />
                                              </Button>
                                              <span className="w-8 text-center text-sm font-medium tabular-nums">{item.quantity}</span>
                                              <Button
                                                type="button" variant="ghost" size="icon" className="h-6 w-6"
                                                onClick={() => field.onChange(items.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                                                data-testid={`button-inc-qty-${idx}`}
                                              >
                                                <Plus className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                                onClick={() => field.onChange(items.filter((_, i) => i !== idx))}
                                                data-testid={`button-remove-item-${idx}`}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      <p className="text-xs text-muted-foreground">
                                        {items.length} item{items.length !== 1 ? "s" : ""} · {totalUnits} unidade{totalUnits !== 1 ? "s" : ""} no total
                                      </p>
                                    </div>
                                  )}
                                  {items.length === 0 && (
                                    <p className="text-xs text-muted-foreground">Nenhum item adicionado à movimentação.</p>
                                  )}
                                  {productOptions.length > 0 ? (
                                    <FormControl>
                                      <SearchableSelect
                                        value=""
                                        onChange={(val) => { if (val) field.onChange([...items, { productId: val, quantity: 1 }]); }}
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
                                  ) : items.length > 0 ? (
                                    <p className="text-xs text-muted-foreground">Todos os produtos foram adicionados.</p>
                                  ) : null}
                                </div>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* ╔══ STEP 3: Logística ═══════════════════════════════════╗ */}
                {(effectiveStep === 3 || isEditMode) && (
                  <>
                    {/* BLOCO: Dados logísticos */}
                    <div>
                      <BlockSection
                        icon={Truck}
                        title="Dados logísticos"
                        description="Veículo e doca vinculados a esta movimentação."
                      />
                      <div className="space-y-4">
                        {/* Placa */}
                        <FormField
                          control={form.control}
                          name="vehiclePlate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Placa do veículo</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex.: ABC-1234"
                                  data-testid="input-vehicle-plate"
                                  className="h-10"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setAutoFilledFields((prev) => { const n = new Set(prev); n.delete("vehiclePlate"); return n; });
                                  }}
                                />
                              </FormControl>
                              {autoFilledFields.has("vehiclePlate") ? (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Preenchido automaticamente via plano de viagens.
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Informe a placa quando não houver plano de viagens vinculado.
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Doca */}
                        <FormField
                          control={form.control}
                          name="dockId"
                          render={({ field }) => {
                            const dockOptions = docks.map((d) => ({
                              value: d.id, label: d.name,
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
                                      placeholder="Selecionar doca (opcional)"
                                      searchPlaceholder="Buscar doca por nome..."
                                      emptyText="Nenhuma doca encontrada"
                                      dataTestid="select-dock"
                                      renderSelected={(val) => {
                                        const dock = docks.find((d) => d.id === val);
                                        return dock ? (
                                          <span className="truncate">{dock.name}</span>
                                        ) : (
                                          <span className="text-muted-foreground">Selecionar doca (opcional)</span>
                                        );
                                      }}
                                    />
                                  ) : (
                                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                      <SelectTrigger data-testid="select-dock" className="h-10 bg-card">
                                        <SelectValue placeholder="Selecionar doca (opcional)" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {docks.map((dock) => (
                                          <SelectItem key={dock.id} value={dock.id}>{dock.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </FormControl>
                                {autoFilledFields.has("dockId") && (
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Preenchido automaticamente via plano de viagens.
                                  </p>
                                )}
                                {docks.length === 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">Nenhuma doca cadastrada.</p>
                                )}
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </div>
                    </div>

                    {/* BLOCO: Observações */}
                    <div>
                      <BlockSection
                        icon={StickyNote}
                        title="Observações"
                        description="Informações adicionais para a equipe operacional."
                      />
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                placeholder="Ex.: carga parcial, materiais frágeis, saída prevista às 18h, prioridade alta, etc."
                                className="resize-none min-h-[80px]"
                                data-testid="input-movement-notes"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              </div>
              {/* end left col */}

              {/* ─ RIGHT: Review panel ──────────────────────────────────── */}
              <div
                className="w-[300px] shrink-0 border-l border-border flex flex-col overflow-hidden"
                style={{ minWidth: 260, maxWidth: 320 }}
              >
                {/* Panel header */}
                <div className="px-4 py-3 border-b border-border/60 bg-muted/30 shrink-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Resumo da movimentação
                  </p>
                </div>

                {/* Panel body */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                  {/* Core info */}
                  <div className="p-4 space-y-3 border-b border-border/40">
                    {/* Name */}
                    <ReviewRow icon={FileText} label="Nome">
                      {watchedValues.name ? (
                        <p className="font-medium leading-snug text-foreground">{watchedValues.name}</p>
                      ) : (
                        <p className="text-muted-foreground italic">Não informado</p>
                      )}
                    </ReviewRow>

                    {/* Type */}
                    <ReviewRow icon={Tag} label="Tipo">
                      {selectedType ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <p className="font-medium leading-snug text-foreground">{movementTypeFriendlyLabel(selectedType.name)}</p>
                          {selectedType.nature === "inbound" && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Entrada</Badge>
                          )}
                          {selectedType.nature === "outbound" && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">Saída</Badge>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">Não selecionado</p>
                      )}
                    </ReviewRow>

                    {/* Events */}
                    <ReviewRow icon={MapPin} label="Evento">
                      {selectedEvents.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {selectedEvents.map((e) => (
                            <Badge key={e.id} variant="outline" className="text-[9px] px-1 py-0 max-w-[200px] truncate">{e.name}</Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">Não vinculado</p>
                      )}
                    </ReviewRow>

                    {/* Trips */}
                    {selectedTrips.length > 0 && (
                      <ReviewRow icon={Route} label="Plano de viagens">
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {selectedTrips.map((t) => (
                            <Badge key={t.id} variant="outline" className="text-[9px] px-1 py-0 max-w-[200px] truncate">
                              {t.description || `Plano ${t.id.substring(0, 8)}`}
                            </Badge>
                          ))}
                        </div>
                      </ReviewRow>
                    )}

                    {/* Order or Requests */}
                    {selectedOrder && (
                      <ReviewRow icon={ClipboardList} label="Ordem de carregamento">
                        <p className="font-medium leading-snug text-foreground">{selectedOrder.orderNumber}</p>
                      </ReviewRow>
                    )}
                    {selectedRequests.length > 0 && (
                      <ReviewRow icon={FileText} label={`Requisiç${selectedRequests.length === 1 ? "ão" : "ões"} (${selectedRequests.length})`}>
                        <div className="space-y-0.5 mt-0.5">
                          {selectedRequests.map((req) => (
                            <p key={req.id} className="font-medium leading-snug text-foreground truncate text-xs">
                              {req.event?.name ? `${req.event.name} — ` : ""}{req.area}
                            </p>
                          ))}
                        </div>
                      </ReviewRow>
                    )}

                    {/* Vehicle */}
                    <ReviewRow icon={Truck} label="Veículo">
                      {(() => {
                        const tripVehicleType = selectedTrips.find(t => t.vehicleType)?.vehicleType;
                        const plate = watchedValues.vehiclePlate;
                        if (tripVehicleType || plate) {
                          return (
                            <div>
                              {tripVehicleType && <p className="font-medium leading-snug text-foreground">{tripVehicleType.name}</p>}
                              {plate && <p className="leading-snug text-muted-foreground">{plate}</p>}
                            </div>
                          );
                        }
                        return <p className="text-muted-foreground italic">Não informado</p>;
                      })()}
                    </ReviewRow>

                    {/* Driver */}
                    {selectedTrips.some(t => t.driver) && (
                      <ReviewRow icon={User} label="Motorista">
                        <p className="font-medium leading-snug text-foreground">
                          {selectedTrips.find(t => t.driver)?.driver?.name}
                        </p>
                      </ReviewRow>
                    )}

                    {/* Dock */}
                    <ReviewRow icon={Warehouse} label="Doca">
                      {selectedDock ? (
                        <p className="font-medium leading-snug text-foreground">{selectedDock.name}</p>
                      ) : (
                        <p className="text-muted-foreground italic">Não vinculada</p>
                      )}
                    </ReviewRow>

                    {/* Pre-loaded items (create mode) */}
                    {!isEditMode && productItems.length > 0 && (
                      <ReviewRow icon={Package} label="Itens pré-carregados">
                        <p className="font-medium text-foreground">
                          {productItems.length} produto{productItems.length !== 1 ? "s" : ""} · {totalUnits} un.
                        </p>
                      </ReviewRow>
                    )}

                    {/* Notes */}
                    {watchedValues.notes && (
                      <ReviewRow icon={StickyNote} label="Observações">
                        <p className="text-foreground leading-snug line-clamp-3">{watchedValues.notes}</p>
                      </ReviewRow>
                    )}
                  </div>

                  {/* Trip detail collapsible */}
                  {selectedTrips.length > 0 && (
                    <div className="border-b border-border/40">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                        onClick={() => setTripDetailExpanded(v => !v)}
                      >
                        <div className="flex items-center gap-2">
                          <Route className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Detalhe do plano
                          </span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {selectedTrips.length}
                          </Badge>
                        </div>
                        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", tripDetailExpanded && "rotate-180")} />
                      </button>
                      {tripDetailExpanded && <TripDetailPanel trips={selectedTrips} />}
                    </div>
                  )}

                  {/* Consolidated items from requests */}
                  {linkType === "request" && selectedRequests.length > 0 && (
                    <div>
                      <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Itens das requisições
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        {reqItemsLoading ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Carregando itens...
                          </div>
                        ) : consolidatedReqItems.length > 0 ? (
                          <div className="space-y-1.5">
                            {selectedRequests.length > 1 && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {consolidatedReqItems.length} produto{consolidatedReqItems.length !== 1 ? "s" : ""} consolidados de {selectedRequests.length} requisições
                              </p>
                            )}
                            {consolidatedReqItems.map((item) => (
                              <div key={item.productId} className="flex items-center justify-between text-xs">
                                <div className="min-w-0 flex-1">
                                  <p className="text-foreground truncate">{item.name}</p>
                                  {item.sku && <p className="text-muted-foreground text-[10px]">{item.sku}</p>}
                                </div>
                                <span className="text-muted-foreground shrink-0 ml-2 tabular-nums font-medium">{item.qty} un</span>
                              </div>
                            ))}
                            <div className="border-t border-border/40 pt-1.5 mt-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Total</span>
                                <span className="font-semibold text-foreground tabular-nums">
                                  {consolidatedReqItems.reduce((s, i) => s + i.qty, 0)} un
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Nenhum item nas requisições selecionadas.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Items from loading order */}
                  {linkType === "order" && selectedOrder && (
                    <div>
                      <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Itens da ordem
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        {orderItemsRaw.length > 0 ? (
                          <div className="space-y-1.5">
                            {orderItemsRaw.map((item) => {
                              const prod = products.find(p => p.id === item.productId);
                              return (
                                <div key={item.id} className="flex items-center justify-between text-xs">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-foreground truncate">{prod?.name || item.productId}</p>
                                    {prod?.sku && <p className="text-muted-foreground text-[10px]">{prod.sku}</p>}
                                  </div>
                                  <span className="text-muted-foreground shrink-0 ml-2 tabular-nums font-medium">{item.consolidatedQuantity} un</span>
                                </div>
                              );
                            })}
                            <div className="border-t border-border/40 pt-1.5 mt-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Total</span>
                                <span className="font-semibold text-foreground tabular-nums">
                                  {orderItemsRaw.reduce((s, i) => s + i.consolidatedQuantity, 0)} un
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Nenhum item na ordem.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* end right col */}

            </div>
            {/* end body flex row */}

            {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
            <div className="shrink-0 border-t border-border bg-muted/40 px-5 py-3 flex items-center justify-between gap-4">
              {/* Left: status text */}
              <div className="text-xs text-muted-foreground min-w-0">
                {isEditMode ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Pronto para salvar
                  </span>
                ) : step === 1 ? (
                  step1Valid ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Etapa 1 completa — avance para continuar
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      Preencha {step1Missing.join(" e ")} para avançar
                    </span>
                  )
                ) : step === 2 ? (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Etapa 2 — vincule origens e itens (opcional)
                  </span>
                ) : (
                  step1Valid ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pronta para criação
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      Volte e preencha {step1Missing.join(" e ")}
                    </span>
                  )
                )}
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Cancel */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>

                {/* Back (steps 2 and 3 in create mode) */}
                {!isEditMode && step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    data-testid="button-back"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                )}

                {/* Next (steps 1 and 2 in create mode) */}
                {!isEditMode && step < 3 && (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={step === 1 && !step1Valid}
                    data-testid="button-next"
                  >
                    Próxima etapa
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}

                {/* Submit (step 3 in create, or always in edit) */}
                {(isEditMode || step === 3) && (isEditMode ? userCanEditMovement(user) : userCanCreateMovement(user)) && (
                  <Button
                    type="submit"
                    disabled={!step1Valid || isPending}
                    data-testid="button-submit"
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
            </div>

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

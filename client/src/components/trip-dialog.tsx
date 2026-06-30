import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Trip, InsertTrip, Event, VehicleType, Vehicle, Driver, Dock } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, X, MapPin, AlertTriangle, ArrowRight, Truck, User, Anchor,
  Check, ChevronDown, Calendar, Clock, Building2, PackageCheck,
  RotateCcw, ChevronsRight, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Destination {
  id: string;
  location: string;
  arrivalDateTime: string;
  notes?: string;
}

interface TripFormData {
  description?: string;
  eventId?: string;
  vehicleId?: string;
  vehicleTypeId?: string;
  driverId?: string;
  dockId?: string;
  vehiclePlate?: string;
  // Ida — CD → Evento
  loadingLocation?: string;
  loadingStartTime?: string;
  loadingEndTime?: string;
  departureDateTime?: string;
  outboundArrivalDateTime?: string;
  outboundArrivalLocation?: string;
  unloadingLocation?: string;
  unloadingStartTime?: string;
  unloadingEndTime?: string;
  // Volta — Evento → CD
  sameTransportReturn?: boolean;
  returnVehicleTypeId?: string;
  returnDriverId?: string;
  returnDockId?: string;
  returnLoadingLocation?: string;
  returnLoadingStartTime?: string;
  returnLoadingEndTime?: string;
  returnDepartureDateTime?: string;
  returnArrivalDateTime?: string;
  returnUnloadingLocation?: string;
  returnUnloadingStartTime?: string;
  returnUnloadingEndTime?: string;
  // Geral
  status?: string;
  notes?: string;
}

const EMPTY_FORM: TripFormData = {
  description: "",
  eventId: "",
  vehicleId: "",
  vehicleTypeId: "",
  driverId: "",
  dockId: "",
  vehiclePlate: "",
  sameTransportReturn: true,
  status: "planned",
  notes: "",
};

const STATUS_OPTIONS = [
  { value: "planned", label: "Planejada" },
  { value: "loading", label: "Carregando" },
  { value: "loaded", label: "Carregada" },
  { value: "in_transit", label: "Em Trânsito" },
  { value: "at_destination", label: "No Destino" },
  { value: "unloading", label: "Descarregando" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

const STEP_LABELS = ["Identificação", "Ida ao evento", "Retorno ao CD", "Revisão"];

// ── Helper: combine date + time strings into ISO datetime ────────────────────

function combineDT(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

function splitDT(iso?: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const [date, timeFull] = iso.split("T");
  return { date: date || "", time: (timeFull || "").slice(0, 5) };
}

function parseDTField(v?: string) {
  return v ? new Date(v) : null;
}

function fmtDT(iso?: string) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  try {
    return format(new Date(d as string), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center px-6 py-3 border-b border-border/40 bg-muted/20">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
              i + 1 < current && "bg-emerald-500/20 text-emerald-500",
              i + 1 === current && "bg-primary text-primary-foreground",
              i + 1 > current && "bg-muted text-muted-foreground"
            )}>
              {i + 1 < current ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={cn(
              "text-xs font-medium hidden sm:block",
              i + 1 === current ? "text-foreground" : "text-muted-foreground"
            )}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={cn(
              "flex-1 h-px mx-2",
              i + 1 < current ? "bg-primary/40" : "bg-border/40"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── DateTimeField ─────────────────────────────────────────────────────────────

interface DateTimeFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  shortcuts?: Array<{ label: string; value: () => string }>;
}

function DateTimeField({ label, value, onChange, error, hint, required, shortcuts }: DateTimeFieldProps) {
  const { date, time } = splitDT(value);
  const handleDate = (d: string) => onChange(d ? combineDT(d, time) : "");
  const handleTime = (t: string) => onChange(date ? combineDT(date, t) : "");

  return (
    <div className="space-y-1">
      <Label className={cn("text-xs", required && "after:content-['*'] after:text-destructive after:ml-0.5")}>
        {label}
      </Label>
      <div className="flex gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            value={date}
            onChange={(e) => handleDate(e.target.value)}
            className={cn("pl-7 text-sm h-8", error && "border-destructive")}
          />
        </div>
        <div className="relative w-24 shrink-0">
          <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            type="time"
            value={time}
            onChange={(e) => handleTime(e.target.value)}
            className={cn("pl-7 text-sm h-8", error && "border-destructive")}
            disabled={!date}
          />
        </div>
      </div>
      {shortcuts && shortcuts.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onChange(s.value())}
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover-elevate text-muted-foreground hover:text-foreground transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}
      {hint && !error && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ label, description, icon: Icon }: {
  label: string; description?: string; icon?: React.ElementType
}) {
  return (
    <div className="pb-2 border-b border-border/40">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      {description && <p className="text-xs text-muted-foreground mt-0.5 ml-5">{description}</p>}
    </div>
  );
}

// ── TimelineStrip ─────────────────────────────────────────────────────────────

function TimelineStrip({ steps }: { steps: string[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap rounded-md bg-muted/30 border border-border/30 px-3 py-2 text-xs text-muted-foreground">
      {steps.map((s, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="font-medium text-foreground/80">{s}</span>
          {i < steps.length - 1 && <ChevronsRight className="h-3 w-3 shrink-0" />}
        </span>
      ))}
    </div>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: Event }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-1.5 text-sm">
      <div className="font-semibold text-foreground leading-tight">{event.name}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        <span className="text-muted-foreground">Cliente</span>
        <span className="font-medium truncate">{event.client}</span>
        <span className="text-muted-foreground">Local</span>
        <span className="font-medium truncate">{event.location}</span>
        {event.setupDate && <>
          <span className="text-muted-foreground">Montagem</span>
          <span className="font-medium">{fmtDate(event.setupDate)}</span>
        </>}
        <span className="text-muted-foreground">Evento</span>
        <span className="font-medium">{fmtDate(event.eventDate)}</span>
        <span className="text-muted-foreground">Desmontagem</span>
        <span className="font-medium">{fmtDate(event.teardownDate)}</span>
      </div>
    </div>
  );
}

// ── ValidationError ───────────────────────────────────────────────────────────

function ValidationError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-destructive">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </div>
  );
}

// ── ReviewRow ─────────────────────────────────────────────────────────────────

function ReviewRow({ label, value, dim }: { label: string; value?: string; dim?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground text-xs w-36 shrink-0 pt-0.5">{label}</span>
      <span className={cn("font-medium leading-tight", dim && "text-muted-foreground")}>{value}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface TripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip;
}

export function TripDialog({ open, onOpenChange, trip }: TripDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<TripFormData>(EMPTY_FORM);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [eventOpen, setEventOpen] = useState(false);

  // ── Data queries ──
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: vehicleTypes = [] } = useQuery<VehicleType[]>({ queryKey: ["/api/vehicle-types"] });
  const { data: vehicles = [] } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: drivers = [] } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: docks = [] } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  // ── Init form ──
  useEffect(() => {
    if (trip && open) {
      const ts = (t?: string | Date | null) =>
        t ? format(new Date(t as string), "yyyy-MM-dd'T'HH:mm") : "";
      setFormData({
        description: trip.description || "",
        eventId: trip.eventId || "",
        vehicleTypeId: trip.vehicleTypeId || "",
        driverId: trip.driverId || "",
        dockId: trip.dockId || "",
        vehiclePlate: (trip as any).vehiclePlate || "",
        loadingLocation: trip.loadingLocation || "",
        loadingStartTime: ts(trip.loadingStartTime),
        loadingEndTime: ts(trip.loadingEndTime),
        departureDateTime: ts(trip.departureDateTime),
        outboundArrivalDateTime: ts((trip as any).outboundArrivalDateTime),
        outboundArrivalLocation: (trip as any).outboundArrivalLocation || "",
        unloadingLocation: trip.unloadingLocation || "",
        unloadingStartTime: ts(trip.unloadingStartTime),
        unloadingEndTime: ts(trip.unloadingEndTime),
        sameTransportReturn: (trip as any).sameTransportReturn !== false,
        returnVehicleTypeId: (trip as any).returnVehicleTypeId || "",
        returnDriverId: (trip as any).returnDriverId || "",
        returnDockId: (trip as any).returnDockId || "",
        returnLoadingLocation: (trip as any).returnLoadingLocation || "",
        returnLoadingStartTime: ts((trip as any).returnLoadingStartTime),
        returnLoadingEndTime: ts((trip as any).returnLoadingEndTime),
        returnDepartureDateTime: ts((trip as any).returnDepartureDateTime),
        returnArrivalDateTime: ts((trip as any).returnArrivalDateTime),
        returnUnloadingLocation: (trip as any).returnUnloadingLocation || "",
        returnUnloadingStartTime: ts((trip as any).returnUnloadingStartTime),
        returnUnloadingEndTime: ts((trip as any).returnUnloadingEndTime),
        status: trip.status || "planned",
        notes: trip.notes || "",
      });
      if ((trip as any).destinations?.length) {
        setDestinations((trip as any).destinations.map((d: any) => ({
          id: d.id || crypto.randomUUID(),
          location: d.location || "",
          arrivalDateTime: d.arrivalDateTime
            ? format(new Date(d.arrivalDateTime), "yyyy-MM-dd'T'HH:mm")
            : "",
          notes: d.notes || "",
        })));
      } else {
        setDestinations([]);
      }
    } else if (!trip && !open) {
      setFormData(EMPTY_FORM);
      setDestinations([]);
      setStep(1);
    }
  }, [trip, open]);

  const update = useCallback((patch: Partial<TripFormData>) =>
    setFormData((prev) => ({ ...prev, ...patch })), []);

  // ── Derived lookups ──
  const selectedEvent = events.find((e) => String(e.id) === formData.eventId);
  const selectedVehicleType = vehicleTypes.find((v) => String(v.id) === formData.vehicleTypeId);
  const selectedVehicle = vehicles.find((v) => v.id === formData.vehicleId);
  const selectedDriver = drivers.find((d) => d.id === formData.driverId);
  const selectedDock = docks.find((d) => d.id === formData.dockId);
  const selectedReturnVehicleType = vehicleTypes.find((v) => String(v.id) === formData.returnVehicleTypeId);
  const selectedReturnDriver = drivers.find((d) => d.id === formData.returnDriverId);
  const selectedReturnDock = docks.find((d) => d.id === formData.returnDockId);

  // ── Auto-fill from selected vehicle ──
  useEffect(() => {
    if (!formData.vehicleId || formData.vehicleId === "__none__") return;
    const veh = vehicles.find((v) => v.id === formData.vehicleId);
    if (!veh) return;
    const patch: Partial<TripFormData> = {};
    if (veh.plate) patch.vehiclePlate = veh.plate;
    if (veh.vehicleTypeId) patch.vehicleTypeId = String(veh.vehicleTypeId);
    update(patch);
  }, [formData.vehicleId]);

  // ── Auto-suggest description ──
  useEffect(() => {
    if (!trip && selectedEvent && selectedVehicleType && !formData.description) {
      const city = selectedEvent.location?.split(",")[0]?.trim() || selectedEvent.location;
      const year = selectedEvent.eventDate
        ? new Date(selectedEvent.eventDate).getFullYear()
        : "";
      const count = formData.vehicleTypeId
        ? events.filter(() => false).length + 1
        : 1;
      update({ description: `${selectedVehicleType.name} ${count} — ${selectedEvent.name} — ${city} ${year}` });
    }
  }, [formData.vehicleTypeId, formData.eventId]);

  // ── Validations ──
  const v = useMemo(() => {
    const err: Record<string, string> = {};
    const lt = (a?: string, b?: string, msg?: string) => {
      if (a && b && a > b) err[msg || ""] = msg || "";
    };
    // Outbound sequence
    lt(formData.loadingStartTime, formData.loadingEndTime
      ? undefined : undefined);
    if (formData.loadingStartTime && formData.loadingEndTime &&
      formData.loadingStartTime > formData.loadingEndTime)
      err.loadingRange = "O fim do carregamento não pode ser anterior ao início.";
    if (formData.loadingEndTime && formData.departureDateTime &&
      formData.departureDateTime < formData.loadingEndTime)
      err.departure = "A saída não pode ser anterior ao término do carregamento.";
    if (formData.departureDateTime && formData.outboundArrivalDateTime &&
      formData.outboundArrivalDateTime < formData.departureDateTime)
      err.outboundArrival = "A chegada ao evento não pode ser anterior à saída do CD.";
    if (formData.outboundArrivalDateTime && formData.unloadingStartTime &&
      formData.unloadingStartTime < formData.outboundArrivalDateTime)
      err.unloadingStart = "A descarga no evento não pode começar antes da chegada.";
    if (formData.unloadingStartTime && formData.unloadingEndTime &&
      formData.unloadingStartTime > formData.unloadingEndTime)
      err.unloadingRange = "O fim da descarga não pode ser anterior ao início.";
    // Return sequence
    if (formData.returnLoadingStartTime && formData.returnLoadingEndTime &&
      formData.returnLoadingStartTime > formData.returnLoadingEndTime)
      err.returnLoadingRange = "O fim do carregamento de retorno não pode ser anterior ao início.";
    if (formData.returnLoadingEndTime && formData.returnDepartureDateTime &&
      formData.returnDepartureDateTime < formData.returnLoadingEndTime)
      err.returnDeparture = "A saída do evento não pode ser anterior ao término do carregamento.";
    if (formData.returnDepartureDateTime && formData.returnArrivalDateTime &&
      formData.returnArrivalDateTime < formData.returnDepartureDateTime)
      err.returnArrival = "A chegada ao CD não pode ser anterior à saída do evento.";
    if (formData.returnArrivalDateTime && formData.returnUnloadingStartTime &&
      formData.returnUnloadingStartTime < formData.returnArrivalDateTime)
      err.returnUnloadingStart = "A descarga no CD não pode começar antes da chegada.";
    if (formData.returnUnloadingStartTime && formData.returnUnloadingEndTime &&
      formData.returnUnloadingStartTime > formData.returnUnloadingEndTime)
      err.returnUnloadingRange = "O fim da descarga no CD não pode ser anterior ao início.";
    return err;
  }, [formData]);

  const hasErrors = Object.keys(v).length > 0;
  const missingRequired = !formData.eventId || !formData.vehicleTypeId;

  // ── Step validation ──
  const canProceedStep1 = !!formData.eventId && !!formData.vehicleTypeId;

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (data: InsertTrip) => apiRequest("POST", "/api/trips", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ description: "Plano de viagens criado com sucesso" });
      onOpenChange(false);
    },
    onError: () => toast({ description: "Erro ao criar plano de viagens", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertTrip>) =>
      apiRequest("PATCH", `/api/trips/${trip?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ description: "Plano de viagens atualizado com sucesso" });
      onOpenChange(false);
    },
    onError: () => toast({ description: "Erro ao atualizar plano de viagens", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (missingRequired) {
      toast({ description: "Preencha Evento e Tipo de Veículo (obrigatórios)", variant: "destructive" });
      return;
    }
    if (hasErrors) {
      toast({ description: "Corrija os erros de data antes de salvar", variant: "destructive" });
      return;
    }
    const dt = (s?: string) => (s ? new Date(s) : null);
    const submitData: any = {
      description: formData.description || null,
      eventId: formData.eventId,
      vehicleTypeId: formData.vehicleTypeId,
      driverId: formData.driverId || null,
      dockId: formData.dockId || null,
      vehiclePlate: formData.vehiclePlate || null,
      loadingLocation: formData.loadingLocation || null,
      loadingStartTime: dt(formData.loadingStartTime),
      loadingEndTime: dt(formData.loadingEndTime),
      departureDateTime: dt(formData.departureDateTime),
      outboundArrivalDateTime: dt(formData.outboundArrivalDateTime),
      outboundArrivalLocation: formData.outboundArrivalLocation || null,
      unloadingLocation: formData.unloadingLocation || null,
      unloadingStartTime: dt(formData.unloadingStartTime),
      unloadingEndTime: dt(formData.unloadingEndTime),
      sameTransportReturn: formData.sameTransportReturn !== false,
      returnVehicleTypeId: formData.sameTransportReturn ? null : (formData.returnVehicleTypeId || null),
      returnDriverId: formData.sameTransportReturn ? null : (formData.returnDriverId || null),
      returnDockId: formData.returnDockId || null,
      returnLoadingLocation: formData.returnLoadingLocation || null,
      returnLoadingStartTime: dt(formData.returnLoadingStartTime),
      returnLoadingEndTime: dt(formData.returnLoadingEndTime),
      returnDepartureDateTime: dt(formData.returnDepartureDateTime),
      returnArrivalDateTime: dt(formData.returnArrivalDateTime),
      returnUnloadingLocation: formData.returnUnloadingLocation || null,
      returnUnloadingStartTime: dt(formData.returnUnloadingStartTime),
      returnUnloadingEndTime: dt(formData.returnUnloadingEndTime),
      status: formData.status || "planned",
      notes: formData.notes || null,
      destinations: destinations.filter((d) => d.location).map((d) => ({
        location: d.location,
        arrivalDateTime: d.arrivalDateTime,
        notes: d.notes || undefined,
      })),
    };
    if (trip) updateMutation.mutate(submitData);
    else createMutation.mutate(submitData);
  };

  // ── Destination helpers ──
  const addDestination = () =>
    setDestinations((p) => [...p, { id: crypto.randomUUID(), location: "", arrivalDateTime: "", notes: "" }]);
  const removeDestination = (id: string) =>
    setDestinations((p) => p.filter((d) => d.id !== id));
  const updateDest = (id: string, field: keyof Destination, value: string) =>
    setDestinations((p) => p.map((d) => d.id === id ? { ...d, [field]: value } : d));

  // ── Shortcut helpers ──
  const toISO = (d?: Date | string | null, h = 8, m = 0) => {
    if (!d) return "";
    const dt = new Date(d as string);
    dt.setHours(h, m, 0, 0);
    return format(dt, "yyyy-MM-dd'T'HH:mm");
  };
  const addMinutes = (iso?: string, mins = 60) => {
    if (!iso) return "";
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + mins);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  };

  // ── Render helpers ──

  const renderNoneOption = (label = "Nenhum") => <SelectItem value="__none__">{label}</SelectItem>;
  const noneVal = (v?: string) => v === "__none__" ? "" : (v || "");

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Identificação e Transporte
  // ═══════════════════════════════════════════════════════════════════════════

  const step1 = (
    <div className="space-y-5">
      {/* — Identificação — */}
      <SectionLabel label="Identificação" icon={Building2} />

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs">Descrição do plano</Label>
        <Input
          id="description"
          placeholder="Ex: Carreta 1 — Desafio Energia Petrobras — São Paulo 2026"
          value={formData.description || ""}
          onChange={(e) => update({ description: e.target.value })}
          data-testid="input-description"
        />
        <p className="text-[10px] text-muted-foreground">
          Sugestão gerada automaticamente ao preencher evento e tipo de veículo. Editável.
        </p>
      </div>

      {/* Evento — combobox com busca */}
      <div className="space-y-1.5">
        <Label className="text-xs after:content-['*'] after:text-destructive after:ml-0.5">
          Evento
        </Label>
        <Popover open={eventOpen} onOpenChange={setEventOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal text-sm h-9"
              data-testid="button-select-event"
            >
              <span className={cn(!selectedEvent && "text-muted-foreground")}>
                {selectedEvent ? selectedEvent.name : "Pesquisar evento..."}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full min-w-[340px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Nome, cliente, local, data..." />
              <CommandList>
                <CommandEmpty>Nenhum evento encontrado.</CommandEmpty>
                <CommandGroup>
                  {events.map((ev) => (
                    <CommandItem
                      key={ev.id}
                      value={`${ev.name} ${ev.client} ${ev.location} ${fmtDate(ev.eventDate)}`}
                      onSelect={() => {
                        update({ eventId: String(ev.id) });
                        setEventOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-3.5 w-3.5", String(ev.id) === formData.eventId ? "opacity-100" : "opacity-0")} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{ev.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {ev.client} · {ev.location} · {fmtDate(ev.eventDate)}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedEvent && <EventCard event={selectedEvent} />}
      </div>

      {/* — Transporte — */}
      <SectionLabel label="Transporte" icon={Truck} description="Selecione o veículo ou preencha manualmente o tipo e a placa." />

      {/* Veículo cadastrado (opcional) */}
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1.5">
          Veículo
          <span className="text-muted-foreground font-normal">(opcional — preenche tipo e placa automaticamente)</span>
        </Label>
        <Select
          value={formData.vehicleId || "__none__"}
          onValueChange={(v) => update({ vehicleId: noneVal(v), ...(v === "__none__" ? { vehiclePlate: "", vehicleTypeId: "" } : {}) })}
        >
          <SelectTrigger className="h-8 text-sm" data-testid="select-vehicle">
            <SelectValue placeholder="Selecionar veículo cadastrado..." />
          </SelectTrigger>
          <SelectContent>
            {renderNoneOption("Nenhum (preencher manualmente)")}
            {vehicles.map((vh) => {
              const typeName = vehicleTypes.find((vt) => String(vt.id) === String(vh.vehicleTypeId))?.name;
              const label = [vh.plate || vh.truckPlate, vh.model, typeName].filter(Boolean).join(" · ");
              return (
                <SelectItem key={vh.id} value={vh.id}>
                  {label || `Veículo ${vh.id.slice(0, 8)}`}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedVehicle && (
          <p className="text-[10px] text-muted-foreground">
            Tipo e placa preenchidos a partir do veículo selecionado. Editáveis abaixo.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="vehicleTypeId" className="text-xs after:content-['*'] after:text-destructive after:ml-0.5">
            Tipo de Veículo
          </Label>
          <Select value={formData.vehicleTypeId || ""} onValueChange={(v) => update({ vehicleTypeId: v })}>
            <SelectTrigger id="vehicleTypeId" className="h-8 text-sm" data-testid="select-vehicle-type">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {vehicleTypes.map((vt) => (
                <SelectItem key={vt.id} value={String(vt.id)}>{vt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="driverId" className="text-xs">Motorista</Label>
          <Select
            value={formData.driverId || "__none__"}
            onValueChange={(v) => update({ driverId: noneVal(v) })}
          >
            <SelectTrigger id="driverId" className="h-8 text-sm" data-testid="select-driver">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {renderNoneOption("Sem motorista")}
              {drivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="vehiclePlate" className="text-xs">Placa</Label>
          <Input
            id="vehiclePlate"
            value={formData.vehiclePlate || ""}
            onChange={(e) => update({ vehiclePlate: e.target.value.toUpperCase() })}
            placeholder="ABC-1234"
            className="h-8 text-sm font-mono"
            data-testid="input-plate"
          />
        </div>

      </div>

      {/* Same-transport toggle */}
      <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2.5">
        <div>
          <div className="text-sm font-medium">Usar o mesmo transporte na volta</div>
          <div className="text-xs text-muted-foreground">Reutiliza veículo, motorista e placa no retorno.</div>
        </div>
        <Switch
          checked={formData.sameTransportReturn !== false}
          onCheckedChange={(v) => update({ sameTransportReturn: v })}
          data-testid="switch-same-transport"
        />
      </div>

      {/* Return transport (only when toggle is off) */}
      {formData.sameTransportReturn === false && (
        <div className="space-y-3 rounded-md border border-border/60 p-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Transporte do Retorno
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Veículo (volta)</Label>
              <Select
                value={formData.returnVehicleTypeId || "__none__"}
                onValueChange={(v) => update({ returnVehicleTypeId: noneVal(v) })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {renderNoneOption("Mesmo da ida")}
                  {vehicleTypes.map((vt) => (
                    <SelectItem key={vt.id} value={String(vt.id)}>{vt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Motorista (volta)</Label>
              <Select
                value={formData.returnDriverId || "__none__"}
                onValueChange={(v) => update({ returnDriverId: noneVal(v) })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {renderNoneOption("Mesmo motorista")}
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Ida: CD → Evento
  // ═══════════════════════════════════════════════════════════════════════════

  const step2 = (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-foreground">Ida — CD para o Evento</div>
        <p className="text-xs text-muted-foreground">
          Planejamento da retirada dos materiais no CD, saída do veículo, chegada e descarga no evento.
        </p>
        <TimelineStrip steps={["Carregamento no CD", "Saída do CD", "Chegada ao evento", "Descarga no evento"]} />
      </div>

      {/* A. Carregamento no CD */}
      <div className="space-y-3">
        <SectionLabel label="Carregamento no CD" icon={PackageCheck} />
        <div className="space-y-1">
          <Label className="text-xs">Doca de carregamento</Label>
          <Select
            value={formData.dockId || "__none__"}
            onValueChange={(v) => update({ dockId: noneVal(v) })}
          >
            <SelectTrigger className="h-8 text-sm" data-testid="select-loading-dock">
              <SelectValue placeholder="Selecione a doca de saída" />
            </SelectTrigger>
            <SelectContent>
              {renderNoneOption("Nenhuma doca")}
              {docks.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DateTimeField
            label="Início do carregamento"
            value={formData.loadingStartTime || ""}
            onChange={(v) => update({ loadingStartTime: v })}
            shortcuts={selectedEvent?.setupDate ? [
              { label: "Usar data da montagem", value: () => toISO(selectedEvent.setupDate, 8) },
            ] : []}
          />
          <DateTimeField
            label="Término do carregamento"
            value={formData.loadingEndTime || ""}
            onChange={(v) => update({ loadingEndTime: v })}
            error={v.loadingRange}
            shortcuts={formData.loadingStartTime ? [
              { label: "+2h", value: () => addMinutes(formData.loadingStartTime, 120) },
              { label: "+4h", value: () => addMinutes(formData.loadingStartTime, 240) },
            ] : []}
          />
        </div>
      </div>

      {/* B. Saída do CD */}
      <div className="space-y-3">
        <SectionLabel label="Saída do CD" icon={Truck} />
        <div className="sm:w-1/2">
          <DateTimeField
            label="Data e hora de saída"
            value={formData.departureDateTime || ""}
            onChange={(v) => update({ departureDateTime: v })}
            error={v.departure}
            hint="Sugerido: após o término do carregamento."
            shortcuts={formData.loadingEndTime ? [
              { label: "Saída após carregamento (+30min)", value: () => addMinutes(formData.loadingEndTime, 30) },
            ] : []}
          />
        </div>
      </div>

      {/* C. Chegada ao Evento */}
      <div className="space-y-3">
        <SectionLabel label="Chegada ao Evento" icon={MapPin} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DateTimeField
            label="Data e hora de chegada"
            value={formData.outboundArrivalDateTime || ""}
            onChange={(v) => update({ outboundArrivalDateTime: v })}
            error={v.outboundArrival}
            shortcuts={formData.departureDateTime ? [
              { label: "Chegada após saída (+2h)", value: () => addMinutes(formData.departureDateTime, 120) },
              { label: "+4h", value: () => addMinutes(formData.departureDateTime, 240) },
            ] : []}
          />
          <div className="space-y-1">
            <Label className="text-xs">Local de chegada</Label>
            <Input
              value={formData.outboundArrivalLocation || ""}
              onChange={(e) => update({ outboundArrivalLocation: e.target.value })}
              placeholder={selectedEvent?.location || "Ex: Entrada principal — Portão A"}
              className="h-8 text-sm"
            />
            {selectedEvent?.location && !formData.outboundArrivalLocation && (
              <button
                type="button"
                className="text-[10px] text-primary hover:underline"
                onClick={() => update({ outboundArrivalLocation: selectedEvent.location })}
              >
                Usar local do evento
              </button>
            )}
          </div>
        </div>
      </div>

      {/* D. Descarga no Evento */}
      <div className="space-y-3">
        <SectionLabel label="Descarga no Evento — Ida" icon={PackageCheck}
          description="Descarga dos materiais no local do evento após a chegada do veículo." />
        <div className="space-y-1">
          <Label className="text-xs">Local de descarga</Label>
          <Input
            value={formData.unloadingLocation || ""}
            onChange={(e) => update({ unloadingLocation: e.target.value })}
            placeholder="Ex: Área de serviço — Pavilhão 3"
            className="h-8 text-sm"
            data-testid="input-unloading-location"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DateTimeField
            label="Início da descarga"
            value={formData.unloadingStartTime || ""}
            onChange={(v) => update({ unloadingStartTime: v })}
            error={v.unloadingStart}
            shortcuts={formData.outboundArrivalDateTime ? [
              { label: "Após chegada", value: () => formData.outboundArrivalDateTime! },
            ] : []}
          />
          <DateTimeField
            label="Término da descarga"
            value={formData.unloadingEndTime || ""}
            onChange={(v) => update({ unloadingEndTime: v })}
            error={v.unloadingRange}
            shortcuts={formData.unloadingStartTime ? [
              { label: "+1h", value: () => addMinutes(formData.unloadingStartTime, 60) },
              { label: "+2h", value: () => addMinutes(formData.unloadingStartTime, 120) },
            ] : []}
          />
        </div>
      </div>

      {/* E. Paradas intermediárias */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div>
            <div className="text-sm font-semibold">Paradas Intermediárias</div>
            <div className="text-xs text-muted-foreground">Destinos adicionais antes do evento principal.</div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addDestination}
            data-testid="button-add-destination">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Adicionar parada
          </Button>
        </div>

        {/* Route visualization */}
        {(destinations.length > 0 || selectedEvent) && (
          <div className="flex items-center flex-wrap gap-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">CD</Badge>
            {destinations.map((d, i) => (
              <span key={d.id} className="flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                <Badge variant="outline" className="text-[10px]">{d.location || `Parada ${i + 1}`}</Badge>
              </span>
            ))}
            {selectedEvent && (
              <>
                <ArrowRight className="h-3 w-3" />
                <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">{selectedEvent.name}</Badge>
              </>
            )}
          </div>
        )}

        {destinations.length > 0 && (
          <div className="space-y-2">
            {destinations.map((dest, idx) => (
              <div key={dest.id} className="flex items-start gap-2 p-2.5 border border-border/60 rounded-md"
                data-testid={`card-destination-${idx}`}>
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Local / Endereço</Label>
                    <Input value={dest.location} onChange={(e) => updateDest(dest.id, "location", e.target.value)}
                      placeholder="Endereço da parada" className="h-7 text-xs"
                      data-testid={`input-destination-location-${idx}`} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">Chegada prevista</Label>
                    <Input type="datetime-local" value={dest.arrivalDateTime}
                      onChange={(e) => updateDest(dest.id, "arrivalDateTime", e.target.value)}
                      className="h-7 text-xs"
                      data-testid={`input-destination-arrival-${idx}`} />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon"
                  onClick={() => removeDestination(dest.id)}
                  data-testid={`button-remove-destination-${idx}`}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Volta: Evento → CD
  // ═══════════════════════════════════════════════════════════════════════════

  const step3 = (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-foreground">Volta — Evento para o CD</div>
        <p className="text-xs text-muted-foreground">
          Planejamento do carregamento durante a desmontagem, retorno do veículo e descarga dos materiais no CD.
        </p>
        <TimelineStrip steps={["Carregamento no evento", "Saída do evento", "Chegada ao CD", "Descarga no CD"]} />
      </div>

      {/* Transport summary (if same) */}
      {formData.sameTransportReturn !== false && (
        <div className="flex items-center gap-2 rounded-md bg-muted/30 border border-border/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Usando o mesmo veículo e motorista da ida:
          <span className="font-medium text-foreground">{selectedVehicleType?.name}</span>
          {selectedDriver && <><span>·</span><span className="font-medium text-foreground">{selectedDriver.name}</span></>}
        </div>
      )}

      {/* A. Carregamento no Evento — Desmontagem */}
      <div className="space-y-3">
        <SectionLabel label="Carregamento no Evento — Desmontagem" icon={PackageCheck}
          description="Período em que os materiais serão recolhidos e carregados após o evento." />
        <div className="space-y-1">
          <Label className="text-xs">Local de carregamento</Label>
          <Input
            value={formData.returnLoadingLocation || ""}
            onChange={(e) => update({ returnLoadingLocation: e.target.value })}
            placeholder={formData.unloadingLocation || selectedEvent?.location || "Local de carregamento no evento"}
            className="h-8 text-sm"
          />
          {formData.unloadingLocation && !formData.returnLoadingLocation && (
            <button type="button" className="text-[10px] text-primary hover:underline"
              onClick={() => update({ returnLoadingLocation: formData.unloadingLocation })}>
              Usar mesmo local da descarga de ida
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DateTimeField
            label="Início do carregamento"
            value={formData.returnLoadingStartTime || ""}
            onChange={(v) => update({ returnLoadingStartTime: v })}
            shortcuts={selectedEvent?.teardownDate ? [
              { label: "Usar data da desmontagem", value: () => toISO(selectedEvent.teardownDate, 8) },
            ] : []}
          />
          <DateTimeField
            label="Término do carregamento"
            value={formData.returnLoadingEndTime || ""}
            onChange={(v) => update({ returnLoadingEndTime: v })}
            error={v.returnLoadingRange}
            shortcuts={formData.returnLoadingStartTime ? [
              { label: "+2h", value: () => addMinutes(formData.returnLoadingStartTime, 120) },
              { label: "+4h", value: () => addMinutes(formData.returnLoadingStartTime, 240) },
            ] : []}
          />
        </div>
      </div>

      {/* B. Saída do Evento */}
      <div className="space-y-3">
        <SectionLabel label="Saída do Evento" icon={Truck} />
        <div className="sm:w-1/2">
          <DateTimeField
            label="Data e hora de saída"
            value={formData.returnDepartureDateTime || ""}
            onChange={(v) => update({ returnDepartureDateTime: v })}
            error={v.returnDeparture}
            shortcuts={formData.returnLoadingEndTime ? [
              { label: "Saída após carregamento (+30min)", value: () => addMinutes(formData.returnLoadingEndTime, 30) },
            ] : []}
          />
        </div>
      </div>

      {/* C. Chegada ao CD */}
      <div className="space-y-3">
        <SectionLabel label="Chegada ao CD" icon={MapPin}
          description="Chegada física do veículo ao centro de distribuição. Pode ocorrer antes do início da descarga." />
        <div className="sm:w-1/2">
          <DateTimeField
            label="Data e hora de chegada"
            value={formData.returnArrivalDateTime || ""}
            onChange={(v) => update({ returnArrivalDateTime: v })}
            error={v.returnArrival}
            shortcuts={formData.returnDepartureDateTime ? [
              { label: "Chegada após saída (+2h)", value: () => addMinutes(formData.returnDepartureDateTime, 120) },
              { label: "+4h", value: () => addMinutes(formData.returnDepartureDateTime, 240) },
            ] : []}
          />
        </div>
      </div>

      {/* D. Descarga no CD */}
      <div className="space-y-3">
        <SectionLabel label="Descarga no CD — Retorno" icon={PackageCheck}
          description="Período em que os materiais retornados serão retirados do veículo e recebidos no estoque." />
        <div className="space-y-1">
          <Label className="text-xs">Doca de descarga</Label>
          <Select
            value={formData.returnDockId || "__none__"}
            onValueChange={(v) => update({ returnDockId: noneVal(v) })}
          >
            <SelectTrigger className="h-8 text-sm" data-testid="select-return-dock">
              <SelectValue placeholder="Selecione a doca de retorno" />
            </SelectTrigger>
            <SelectContent>
              {renderNoneOption("Nenhuma doca")}
              {docks.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DateTimeField
            label="Início da descarga no CD"
            value={formData.returnUnloadingStartTime || ""}
            onChange={(v) => update({ returnUnloadingStartTime: v })}
            error={v.returnUnloadingStart}
            shortcuts={formData.returnArrivalDateTime ? [
              { label: "Após chegada ao CD", value: () => formData.returnArrivalDateTime! },
            ] : []}
          />
          <DateTimeField
            label="Término da descarga no CD"
            value={formData.returnUnloadingEndTime || ""}
            onChange={(v) => update({ returnUnloadingEndTime: v })}
            error={v.returnUnloadingRange}
            shortcuts={formData.returnUnloadingStartTime ? [
              { label: "+1h", value: () => addMinutes(formData.returnUnloadingStartTime, 60) },
              { label: "+2h", value: () => addMinutes(formData.returnUnloadingStartTime, 120) },
            ] : []}
          />
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Revisão
  // ═══════════════════════════════════════════════════════════════════════════

  const step4 = (
    <div className="space-y-5">
      <div className="text-sm font-semibold">Revisão do Plano de Viagens</div>

      {/* Identificação */}
      <div className="rounded-md border border-border/60 p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> Identificação e Transporte
        </div>
        <ReviewRow label="Descrição" value={formData.description || "—"} />
        <ReviewRow label="Evento" value={selectedEvent?.name} />
        <ReviewRow label="Tipo de Veículo" value={selectedVehicleType?.name} />
        <ReviewRow label="Motorista" value={selectedDriver?.name} dim />
        <ReviewRow label="Placa" value={formData.vehiclePlate} dim />
        <ReviewRow label="Doca de carregamento" value={selectedDock?.name} dim />
      </div>

      {/* Ida */}
      <div className="rounded-md border border-border/60 p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5" /> Ida — CD → Evento
        </div>
        <ReviewRow label="Local carregamento" value={formData.loadingLocation} dim />
        <ReviewRow label="Início carregamento" value={fmtDT(formData.loadingStartTime)} dim />
        <ReviewRow label="Fim carregamento" value={fmtDT(formData.loadingEndTime)} dim />
        <ReviewRow label="Saída do CD" value={fmtDT(formData.departureDateTime)} dim />
        <ReviewRow label="Chegada ao evento" value={fmtDT(formData.outboundArrivalDateTime)} dim />
        <ReviewRow label="Local de chegada" value={formData.outboundArrivalLocation} dim />
        <ReviewRow label="Descarga início" value={fmtDT(formData.unloadingStartTime)} dim />
        <ReviewRow label="Descarga fim" value={fmtDT(formData.unloadingEndTime)} dim />
        {destinations.length > 0 && (
          <ReviewRow label="Paradas" value={`${destinations.length} parada${destinations.length > 1 ? "s" : ""} intermediária${destinations.length > 1 ? "s" : ""}`} dim />
        )}
      </div>

      {/* Volta */}
      <div className="rounded-md border border-border/60 p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Volta — Evento → CD
        </div>
        {formData.sameTransportReturn !== false
          ? <ReviewRow label="Transporte" value="Mesmo da ida" dim />
          : <>
            <ReviewRow label="Tipo de Veículo" value={selectedReturnVehicleType?.name || selectedVehicleType?.name} dim />
            <ReviewRow label="Motorista" value={selectedReturnDriver?.name || selectedDriver?.name} dim />
          </>
        }
        <ReviewRow label="Doca de retorno" value={selectedReturnDock?.name} dim />
        <ReviewRow label="Carregamento início" value={fmtDT(formData.returnLoadingStartTime)} dim />
        <ReviewRow label="Carregamento fim" value={fmtDT(formData.returnLoadingEndTime)} dim />
        <ReviewRow label="Saída do evento" value={fmtDT(formData.returnDepartureDateTime)} dim />
        <ReviewRow label="Chegada ao CD" value={fmtDT(formData.returnArrivalDateTime)} dim />
        <ReviewRow label="Descarga início" value={fmtDT(formData.returnUnloadingStartTime)} dim />
        <ReviewRow label="Descarga fim" value={fmtDT(formData.returnUnloadingEndTime)} dim />
      </div>

      {/* Status e Observações */}
      <div className="space-y-3">
        <SectionLabel label="Status e Observações" />
        <div className="space-y-1.5">
          <Label htmlFor="status" className="text-xs">Status</Label>
          <Select value={formData.status as string} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger id="status" className="h-8 text-sm" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs">Observações gerais</Label>
          <Textarea
            id="notes"
            value={formData.notes || ""}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Observações sobre o plano de viagens..."
            rows={3}
            data-testid="input-notes"
          />
        </div>
      </div>

      {/* Errors summary */}
      {hasErrors && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
          <div className="text-xs font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Inconsistências de datas detectadas
          </div>
          {Object.values(v).map((msg, i) => (
            <p key={i} className="text-xs text-destructive">· {msg}</p>
          ))}
        </div>
      )}
    </div>
  );

  // ── Step content map ──
  const stepContent = [step1, step2, step3, step4];

  // ── Footer helpers ──
  const isLastStep = step === 4;
  const canGoBack = step > 1;
  const canGoNext = step < 4 && (step !== 1 || canProceedStep1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 border-border/60 flex flex-col gap-0"
        style={{
          maxWidth: "min(1280px, 94vw)",
          width: "min(1280px, 94vw)",
          maxHeight: "90vh",
        }}
      >
        {/* Fixed Header */}
        <DialogHeader className="px-6 pt-5 pb-0 flex-none">
          <DialogTitle className="text-base">
            {trip ? "Editar Plano de Viagens" : "Novo Plano de Viagens"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Organize veículo, rota, carregamento e descarregamento — ida e volta.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <Stepper current={step} />

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0" style={{ scrollbarWidth: "thin" }}>
          {stepContent[step - 1]}
        </div>

        {/* Fixed Footer */}
        <div className="flex-none border-t border-border/40 px-6 py-4 flex items-center justify-between gap-3 bg-background">
          {/* Left: validation hints */}
          <div className="text-xs text-muted-foreground">
            {step === 1 && missingRequired && (
              <span className="text-amber-500 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Preencha Evento e Tipo de Veículo para continuar.
              </span>
            )}
            {step === 4 && hasErrors && (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Corrija os erros de data antes de criar.
              </span>
            )}
          </div>

          {/* Right: navigation buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="ghost" size="sm"
              onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {canGoBack && (
              <Button type="button" variant="outline" size="sm"
                onClick={() => setStep((s) => s - 1)}>
                Voltar
              </Button>
            )}
            {!isLastStep && (
              <Button type="button" size="sm"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && !canProceedStep1}
                data-testid="button-next-step">
                Continuar
              </Button>
            )}
            {isLastStep && (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canProceedStep1 || hasErrors || isPending}
                data-testid="button-submit-trip"
              >
                {isPending
                  ? "Salvando..."
                  : trip
                  ? "Salvar Plano de Viagens"
                  : "Criar Plano de Viagens"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Trip, InsertTrip, Event, VehicleType, Driver, Dock } from "@shared/schema";
import { format } from "date-fns";
import { Plus, X, MapPin, AlertTriangle, ArrowRight, Truck, User, Anchor } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";

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
  description?: string;
  eventId?: string;
  vehicleTypeId?: string;
  driverId?: string;
  dockId?: string;
  loadingLocation?: string;
  loadingStartTime?: string;
  loadingEndTime?: string;
  departureDateTime?: string;
  unloadingLocation?: string;
  unloadingStartTime?: string;
  unloadingEndTime?: string;
  status?: string;
  notes?: string;
}

function SectionLabel({ label, description }: { label: string; description?: string }) {
  return (
    <div className="pb-2 border-b border-border/40">
      <div className="text-sm font-semibold text-foreground">{label}</div>
      {description && (
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      )}
    </div>
  );
}

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

function formatDt(dt?: string) {
  if (!dt) return "—";
  try {
    return format(new Date(dt), "dd/MM HH:mm");
  } catch {
    return "—";
  }
}

export function TripDialog({ open, onOpenChange, trip }: TripDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<TripFormData>({
    description: "",
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
        description: trip.description || "",
        eventId: trip.eventId || "",
        vehicleTypeId: trip.vehicleTypeId || "",
        driverId: trip.driverId || "",
        dockId: trip.dockId || "",
        loadingLocation: trip.loadingLocation || "",
        loadingStartTime: trip.loadingStartTime
          ? format(new Date(trip.loadingStartTime), "yyyy-MM-dd'T'HH:mm")
          : "",
        loadingEndTime: trip.loadingEndTime
          ? format(new Date(trip.loadingEndTime), "yyyy-MM-dd'T'HH:mm")
          : "",
        departureDateTime: trip.departureDateTime
          ? format(new Date(trip.departureDateTime), "yyyy-MM-dd'T'HH:mm")
          : "",
        unloadingLocation: trip.unloadingLocation || "",
        unloadingStartTime: trip.unloadingStartTime
          ? format(new Date(trip.unloadingStartTime), "yyyy-MM-dd'T'HH:mm")
          : "",
        unloadingEndTime: trip.unloadingEndTime
          ? format(new Date(trip.unloadingEndTime), "yyyy-MM-dd'T'HH:mm")
          : "",
        status: trip.status || "planned",
        notes: trip.notes || "",
      });
      if ((trip as any).destinations && Array.isArray((trip as any).destinations)) {
        setDestinations(
          (trip as any).destinations.map((dest: any) => ({
            id: dest.id || crypto.randomUUID(),
            location: dest.location || "",
            arrivalDateTime: dest.arrivalDateTime
              ? format(new Date(dest.arrivalDateTime), "yyyy-MM-dd'T'HH:mm")
              : "",
          }))
        );
      } else {
        setDestinations([]);
      }
    } else if (!trip && !open) {
      setFormData({
        description: "",
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
    mutationFn: async (data: InsertTrip) => apiRequest("POST", "/api/trips", data),
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
    mutationFn: async (data: Partial<InsertTrip>) =>
      apiRequest("PATCH", `/api/trips/${trip?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ description: "Viagem atualizada com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao atualizar viagem", variant: "destructive" });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Validações reativas de datas ──
  const loadingDateError = useMemo(() => {
    if (formData.loadingStartTime && formData.loadingEndTime) {
      return formData.loadingStartTime > formData.loadingEndTime;
    }
    return false;
  }, [formData.loadingStartTime, formData.loadingEndTime]);

  const unloadingDateError = useMemo(() => {
    if (formData.unloadingStartTime && formData.unloadingEndTime) {
      return formData.unloadingStartTime > formData.unloadingEndTime;
    }
    return false;
  }, [formData.unloadingStartTime, formData.unloadingEndTime]);

  const hasDateErrors = loadingDateError || unloadingDateError;
  const missingRequired = !formData.eventId || !formData.vehicleTypeId;
  const canSubmit = !hasDateErrors && !missingRequired && !isPending;

  // Dados para resumo
  const selectedEvent = events?.find((e) => String(e.id) === formData.eventId);
  const selectedVehicleType = vehicleTypes?.find((v) => String(v.id) === formData.vehicleTypeId);
  const selectedDriver = drivers?.find((d) => d.id === formData.driverId);
  const selectedDock = docks?.find((d) => d.id === formData.dockId);
  const selectedStatus = STATUS_OPTIONS.find((s) => s.value === formData.status);

  const addDestination = () =>
    setDestinations((prev) => [
      ...prev,
      { id: crypto.randomUUID(), location: "", arrivalDateTime: "" },
    ]);

  const removeDestination = (id: string) =>
    setDestinations((prev) => prev.filter((d) => d.id !== id));

  const updateDestination = (id: string, field: keyof Destination, value: string) =>
    setDestinations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );

  const update = (patch: Partial<TripFormData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (missingRequired) {
      toast({
        description: "Preencha os campos obrigatórios: Evento e Tipo de Veículo",
        variant: "destructive",
      });
      return;
    }
    if (hasDateErrors) {
      toast({
        description: "Corrija as datas antes de salvar",
        variant: "destructive",
      });
      return;
    }

    const submitData: any = {
      description: formData.description || null,
      eventId: formData.eventId,
      vehicleTypeId: formData.vehicleTypeId,
      driverId: formData.driverId || null,
      dockId: formData.dockId || null,
      loadingLocation: formData.loadingLocation || null,
      loadingStartTime: formData.loadingStartTime ? new Date(formData.loadingStartTime) : null,
      loadingEndTime: formData.loadingEndTime ? new Date(formData.loadingEndTime) : null,
      departureDateTime: formData.departureDateTime ? new Date(formData.departureDateTime) : null,
      unloadingLocation: formData.unloadingLocation || null,
      unloadingStartTime: formData.unloadingStartTime
        ? new Date(formData.unloadingStartTime)
        : null,
      unloadingEndTime: formData.unloadingEndTime ? new Date(formData.unloadingEndTime) : null,
      status: formData.status || "planned",
      notes: formData.notes || null,
    };

    if (destinations.length > 0) {
      submitData.destinations = destinations.map((d) => ({
        location: d.location,
        arrivalDateTime: d.arrivalDateTime,
      }));
    }

    if (trip) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-0 border-border/60 flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* ── Header fixo ── */}
        <DialogHeader className="px-6 py-4 border-b border-border/40 flex-none">
          <DialogTitle>{trip ? "Editar Viagem" : "Nova Viagem"}</DialogTitle>
          <DialogDescription>
            Planeje veículo, rota, carregamento e descarregamento da operação.
          </DialogDescription>
        </DialogHeader>

        {/* ── Corpo rolável ── */}
        <form
          id="trip-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
          style={{ scrollbarWidth: "thin" }}
        >
          {/* A. Identificação */}
          <div className="space-y-4">
            <SectionLabel
              label="Identificação"
              description="Descreva e vincule a viagem ao evento correto."
            />
            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                placeholder="Ex: Carreta 1 — Night Run Belo Horizonte"
                value={formData.description || ""}
                onChange={(e) => update({ description: e.target.value })}
                data-testid="input-description"
              />
              <p className="text-xs text-muted-foreground">
                Use uma descrição curta para identificar a viagem na operação.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eventId">
                Evento <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.eventId}
                onValueChange={(v) => update({ eventId: v })}
              >
                <SelectTrigger
                  id="eventId"
                  className={!formData.eventId ? "border-border" : ""}
                  data-testid="select-event"
                >
                  <SelectValue placeholder="Selecione um evento" />
                </SelectTrigger>
                <SelectContent>
                  {events?.map((ev) => (
                    <SelectItem key={ev.id} value={String(ev.id)}>
                      <div className="leading-tight">
                        <div>{ev.name}</div>
                        {ev.eventDate && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(ev.eventDate).toLocaleDateString("pt-BR")}
                            {ev.location ? ` — ${ev.location}` : ""}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEvent && (
                <p className="text-xs text-muted-foreground">
                  {selectedEvent.name}
                  {selectedEvent.location ? ` • ${selectedEvent.location}` : ""}
                </p>
              )}
            </div>
          </div>

          {/* B. Transporte */}
          <div className="space-y-4">
            <SectionLabel
              label="Transporte"
              description="Informe o veículo, motorista e doca de operação."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="vehicleTypeId">
                  Tipo de Veículo <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.vehicleTypeId}
                  onValueChange={(v) => update({ vehicleTypeId: v })}
                >
                  <SelectTrigger id="vehicleTypeId" data-testid="select-vehicle-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes?.map((vt) => (
                      <SelectItem key={vt.id} value={String(vt.id)}>
                        {vt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="driverId">Motorista</Label>
                <Select
                  value={formData.driverId || "none"}
                  onValueChange={(v) => update({ driverId: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="driverId" data-testid="select-driver">
                    <SelectValue placeholder="Selecione um motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum motorista</SelectItem>
                    {drivers?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dockId">Doca (Opcional)</Label>
              <Select
                value={formData.dockId || "none"}
                onValueChange={(v) => update({ dockId: v === "none" ? undefined : v })}
              >
                <SelectTrigger id="dockId" data-testid="select-dock">
                  <SelectValue placeholder="Selecione uma doca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma doca</SelectItem>
                  {docks?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* C. Destinos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div>
                <div className="text-sm font-semibold">Destinos</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Adicione um ou mais destinos para a rota.
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addDestination}
                data-testid="button-add-destination"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Incluir Destino
              </Button>
            </div>

            {destinations.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="Nenhum destino adicionado"
                description='Clique em "Incluir Destino" para definir os pontos de entrega.'
                compact
              />
            ) : (
              <div className="space-y-2">
                {destinations.map((dest, index) => (
                  <div
                    key={dest.id}
                    className="flex items-start gap-3 p-3 border border-border/60 rounded-md"
                    data-testid={`card-destination-${index}`}
                  >
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`dest-loc-${dest.id}`} className="text-xs">
                          Endereço
                        </Label>
                        <Input
                          id={`dest-loc-${dest.id}`}
                          value={dest.location}
                          onChange={(e) => updateDestination(dest.id, "location", e.target.value)}
                          placeholder="Ex: Rua ABC, 123 — Bairro"
                          className="h-8 text-sm"
                          data-testid={`input-destination-location-${index}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`dest-arr-${dest.id}`} className="text-xs">
                          Data e Hora de Chegada
                        </Label>
                        <Input
                          id={`dest-arr-${dest.id}`}
                          type="datetime-local"
                          value={dest.arrivalDateTime}
                          onChange={(e) =>
                            updateDestination(dest.id, "arrivalDateTime", e.target.value)
                          }
                          className="h-8 text-sm"
                          data-testid={`input-destination-arrival-${index}`}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDestination(dest.id)}
                      data-testid={`button-remove-destination-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* D. Carregamento */}
          <div className="space-y-4">
            <SectionLabel
              label="Carregamento"
              description="Local, horário de início/fim e saída do veículo."
            />
            <div className="space-y-1.5">
              <Label htmlFor="loadingLocation">Local de Carregamento</Label>
              <Input
                id="loadingLocation"
                value={formData.loadingLocation || ""}
                onChange={(e) => update({ loadingLocation: e.target.value })}
                placeholder="Ex: Armazém Central"
                data-testid="input-loading-location"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="loadingStartTime">Início do Carregamento</Label>
                <Input
                  id="loadingStartTime"
                  type="datetime-local"
                  value={formData.loadingStartTime || ""}
                  onChange={(e) => update({ loadingStartTime: e.target.value })}
                  className={loadingDateError ? "border-destructive" : ""}
                  data-testid="input-loading-start"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loadingEndTime">Fim do Carregamento</Label>
                <Input
                  id="loadingEndTime"
                  type="datetime-local"
                  value={formData.loadingEndTime || ""}
                  onChange={(e) => update({ loadingEndTime: e.target.value })}
                  className={loadingDateError ? "border-destructive" : ""}
                  data-testid="input-loading-end"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="departureDateTime">Saída do Veículo</Label>
                <Input
                  id="departureDateTime"
                  type="datetime-local"
                  value={formData.departureDateTime || ""}
                  onChange={(e) => update({ departureDateTime: e.target.value })}
                  data-testid="input-departure"
                />
              </div>
            </div>
            {loadingDateError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Início do carregamento deve ser anterior ao fim
              </div>
            )}
          </div>

          {/* E. Descarregamento */}
          <div className="space-y-4">
            <SectionLabel
              label="Descarregamento"
              description="Local e horário de início/fim no destino."
            />
            <div className="space-y-1.5">
              <Label htmlFor="unloadingLocation">Local de Descarregamento</Label>
              <Input
                id="unloadingLocation"
                value={formData.unloadingLocation || ""}
                onChange={(e) => update({ unloadingLocation: e.target.value })}
                placeholder="Ex: Local do Evento"
                data-testid="input-unloading-location"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="unloadingStartTime">Início do Descarregamento</Label>
                <Input
                  id="unloadingStartTime"
                  type="datetime-local"
                  value={formData.unloadingStartTime || ""}
                  onChange={(e) => update({ unloadingStartTime: e.target.value })}
                  className={unloadingDateError ? "border-destructive" : ""}
                  data-testid="input-unloading-start"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unloadingEndTime">Fim do Descarregamento</Label>
                <Input
                  id="unloadingEndTime"
                  type="datetime-local"
                  value={formData.unloadingEndTime || ""}
                  onChange={(e) => update({ unloadingEndTime: e.target.value })}
                  className={unloadingDateError ? "border-destructive" : ""}
                  data-testid="input-unloading-end"
                />
              </div>
            </div>
            {unloadingDateError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Início do descarregamento deve ser anterior ao fim
              </div>
            )}
          </div>

          {/* F. Status e Observações */}
          <div className="space-y-4">
            <SectionLabel label="Status e Observações" />
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status as string}
                onValueChange={(v) => update({ status: v })}
              >
                <SelectTrigger id="status" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) => update({ notes: e.target.value })}
                placeholder="Notas sobre a viagem..."
                rows={2}
                data-testid="input-notes"
              />
            </div>
          </div>

          {/* G. Timeline operacional */}
          {(formData.loadingStartTime ||
            formData.loadingEndTime ||
            formData.departureDateTime ||
            formData.unloadingStartTime) && (
            <div className="space-y-3">
              <SectionLabel label="Cronograma da Operação" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Início Carga", value: formData.loadingStartTime, color: "bg-primary/10 border-primary/30 text-primary" },
                  { label: "Fim Carga / Saída", value: formData.loadingEndTime || formData.departureDateTime, color: "bg-chart-2/10 border-chart-2/30 text-chart-2" },
                  { label: "Início Desc.", value: formData.unloadingStartTime, color: "bg-chart-5/10 border-chart-5/30 text-chart-5" },
                  { label: "Fim Desc.", value: formData.unloadingEndTime, color: "bg-chart-4/10 border-chart-4/30 text-chart-4" },
                ].map(({ label, value, color }, idx, arr) => (
                  <div key={label} className="relative">
                    <div
                      className={`rounded-md border p-2.5 text-center text-xs ${
                        value ? color : "border-border/40 text-muted-foreground"
                      }`}
                    >
                      <div className="text-[10px] font-medium uppercase tracking-wide opacity-70 mb-1">
                        {label}
                      </div>
                      <div className="font-semibold tabular-nums">{formatDt(value)}</div>
                    </div>
                    {idx < arr.length - 1 && (
                      <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* H. Resumo */}
          <div className="space-y-3">
            <SectionLabel label="Resumo da Viagem" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Veículo</div>
                  <div className="font-medium leading-tight truncate">
                    {selectedVehicleType?.name || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Motorista</div>
                  <div className="font-medium leading-tight truncate">
                    {selectedDriver?.name || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Anchor className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Doca</div>
                  <div className="font-medium leading-tight truncate">
                    {selectedDock?.name || "—"}
                  </div>
                </div>
              </div>

              {(formData.loadingLocation || formData.unloadingLocation) && (
                <div className="col-span-2 sm:col-span-3 flex items-center gap-1.5 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {formData.loadingLocation || "—"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">
                    {formData.unloadingLocation || "—"}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Status:</div>
                {formData.status && <StatusBadge status={formData.status} />}
              </div>
            </div>
          </div>
        </form>

        {/* ── Footer fixo ── */}
        <div className="flex-none border-t border-border/40 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          {hasDateErrors && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              Corrija os erros de data antes de salvar
            </div>
          )}
          {missingRequired && !hasDateErrors && (
            <p className="text-xs text-muted-foreground">
              Preencha Evento e Tipo de Veículo (obrigatórios)
            </p>
          )}
          {!hasDateErrors && !missingRequired && (
            <div className="hidden sm:block" />
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="trip-form"
              disabled={!canSubmit}
              data-testid="button-submit-trip"
            >
              {isPending
                ? "Salvando..."
                : trip
                ? "Salvar Viagem"
                : "Planejar Viagem"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

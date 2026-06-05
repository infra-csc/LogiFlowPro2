import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LoadingOrder, InsertLoadingOrder, Event, MaterialRequest, Trip } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badge";
import {
  AlertTriangle, Loader2, Calendar, Package, Truck, FileText,
  X, MapPin, Clock, User, MessageSquare, Check, Plus, ChevronDown,
  ArrowRight
} from "lucide-react";

interface LoadingOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: LoadingOrder;
}

export function LoadingOrderDialog({ open, onOpenChange, order }: LoadingOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [formData, setFormData] = useState<{
    eventId: string;
    orderNumber: string;
    plannedStartTime: string;
    plannedEndTime: string;
    status: string;
    createdBy: string;
    notes?: string;
  }>({
    eventId: "",
    orderNumber: "",
    plannedStartTime: "",
    plannedEndTime: "",
    status: "draft",
    createdBy: user?.name || "",
    notes: "",
  });

  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [eventOpen, setEventOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState("");

  const { data: events } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: allRequests } = useQuery<MaterialRequest[]>({ queryKey: ["/api/requests"] });
  const { data: allTrips } = useQuery<Trip[]>({ queryKey: ["/api/trips"] });

  const { data: canEditData } = useQuery<{ canEdit: boolean; reason?: string; activeMovements?: any[] }>({
    queryKey: [`/api/loading-orders/${order?.id}/can-edit`],
    enabled: !!order?.id && open,
  });

  const { data: linkedTrips } = useQuery<any[]>({
    queryKey: [`/api/loading-orders/${order?.id}/trips`],
    enabled: !!order?.id && open,
  });

  const approvedRequests = allRequests?.filter(
    (req) =>
      req.status === "approved" &&
      selectedEventId &&
      req.eventId === selectedEventId
  ) || [];

  const reqNumericIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!allRequests) return map;
    const sorted = [...allRequests].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    sorted.forEach((req, idx) => map.set(req.id, String(idx + 1).padStart(3, "0")));
    return map;
  }, [allRequests]);

  const availableTrips = allTrips?.filter(
    (trip) => selectedEventId && trip.eventId === selectedEventId
  ) || [];

  const selectedEvent = events?.find(e => e.id === selectedEventId);

  const userName = user?.name || "";
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && order) {
      const key = order.id;
      if (initializedRef.current === key) return;
      initializedRef.current = key;

      setFormData({
        eventId: order.eventId || "",
        orderNumber: order.orderNumber || "",
        plannedStartTime: order.plannedStartTime ? format(new Date(order.plannedStartTime), "yyyy-MM-dd'T'HH:mm") : "",
        plannedEndTime: order.plannedEndTime ? format(new Date(order.plannedEndTime), "yyyy-MM-dd'T'HH:mm") : "",
        status: order.status || "draft",
        createdBy: order.createdBy || userName,
        notes: order.notes || "",
      });
      setSelectedEventId(order.eventId || "");

      if (linkedTrips) {
        setSelectedTripIds(linkedTrips.map((lt: any) => lt.tripId));
      }
    } else if (!open) {
      initializedRef.current = null;
      setFormData({
        eventId: "",
        orderNumber: "",
        plannedStartTime: "",
        plannedEndTime: "",
        status: "draft",
        createdBy: userName,
        notes: "",
      });
      setSelectedRequestIds([]);
      setSelectedTripIds([]);
      setSelectedEventId("");
      setEventOpen(false);
      setEventSearch("");
    }
  }, [open, order, userName, linkedTrips]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertLoadingOrder & { requestIds: string[]; tripIds: string[] }) => {
      const response = await apiRequest("POST", "/api/loading-orders", data);
      const loadingOrder = await response.json() as LoadingOrder;

      for (const tripId of data.tripIds) {
        await apiRequest("POST", `/api/loading-orders/${loadingOrder.id}/trips`, { tripId });
      }

      return loadingOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loading-orders"] });
      toast({ description: "Ordem de carregamento criada com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Falha ao criar ordem de carregamento", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertLoadingOrder> & { tripIds?: string[] }) => {
      const response = await apiRequest("PATCH", `/api/loading-orders/${order?.id}`, data);
      const updatedOrder = await response.json();

      if (data.tripIds !== undefined) {
        await apiRequest("DELETE", `/api/loading-orders/${order?.id}/trips`);

        for (const tripId of data.tripIds) {
          await apiRequest("POST", `/api/loading-orders/${order?.id}/trips`, { tripId });
        }
      }

      return updatedOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loading-orders"] });
      toast({ description: "Ordem de carregamento atualizada com sucesso" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const message = error?.message || "Falha ao atualizar ordem de carregamento";
      toast({ description: message, variant: "destructive" });
    },
  });

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    setFormData({ ...formData, eventId });
    setSelectedRequestIds([]);
    setSelectedTripIds([]);
    setEventOpen(false);
    setEventSearch("");
  };

  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(requestId)
        ? prev.filter((id) => id !== requestId)
        : [...prev, requestId]
    );
  };

  const toggleTripSelection = (tripId: string) => {
    setSelectedTripIds((prev) =>
      prev.includes(tripId)
        ? prev.filter((id) => id !== tripId)
        : [...prev, tripId]
    );
  };

  const canWriteLogistics = userCanWriteLogistics(user);
  const canEdit = canWriteLogistics && (!order || (canEditData?.canEdit !== false));
  const canLinkTrips = canWriteLogistics;

  const isStartValid = !!formData.plannedStartTime;
  const isEndValid = !!formData.plannedEndTime;
  const isEndAfterStart = !formData.plannedStartTime || !formData.plannedEndTime ||
    new Date(formData.plannedEndTime) >= new Date(formData.plannedStartTime);

  const isFormValid =
    !!formData.eventId &&
    !!formData.orderNumber &&
    isStartValid &&
    isEndValid &&
    isEndAfterStart &&
    !!formData.createdBy;

  const isCreateValid = isFormValid && (order || selectedRequestIds.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canWriteLogistics) {
      toast({
        description: "Apenas administradores ou logística podem gerenciar ordens de carregamento",
        variant: "destructive",
      });
      return;
    }

    if (!canEdit) {
      toast({ description: "Esta ordem não pode ser editada no momento", variant: "destructive" });
      return;
    }

    if (!isFormValid) {
      toast({ description: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    if (!order && selectedRequestIds.length === 0) {
      toast({ description: "Selecione pelo menos uma requisição", variant: "destructive" });
      return;
    }

    const submitData: InsertLoadingOrder = {
      eventId: formData.eventId,
      orderNumber: formData.orderNumber,
      plannedStartTime: new Date(formData.plannedStartTime),
      plannedEndTime: new Date(formData.plannedEndTime),
      status: formData.status as any || "draft",
      createdBy: formData.createdBy,
      notes: formData.notes,
    };

    if (order) {
      updateMutation.mutate({ ...submitData, tripIds: selectedTripIds });
    } else {
      createMutation.mutate({ ...submitData, requestIds: selectedRequestIds, tripIds: selectedTripIds });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const filteredEvents = events?.filter(e =>
    e.name.toLowerCase().includes(eventSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden border-border/60">
        {/* Header - fixo */}
        <DialogHeader className="p-5 pb-4 border-b border-border/40 bg-muted/20 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold tracking-tight">
                {order ? "Editar Ordem de Carregamento" : "Nova Ordem de Carregamento"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {order
                  ? "Atualize as informações da ordem de carregamento."
                  : "Consolide requisições aprovadas e associe planos de viagens para o carregamento."}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-dialog"
              aria-label="Fechar modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content - scrollável */}
        <div className="overflow-y-auto max-h-[60vh] p-5 space-y-6">
          {/* Scrollbar customizada */}
          <style>{`
            .overflow-y-auto::-webkit-scrollbar {
              width: 6px;
            }
            .overflow-y-auto::-webkit-scrollbar-track {
              background: transparent;
            }
            .overflow-y-auto::-webkit-scrollbar-thumb {
              background: hsl(var(--border) / 0.6);
              border-radius: 3px;
            }
            .overflow-y-auto::-webkit-scrollbar-thumb:hover {
              background: hsl(var(--border));
            }
          `}</style>

          {order && canEditData && !canEditData.canEdit && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {canEditData.reason}
                {canEditData.activeMovements && canEditData.activeMovements.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-sm">Movimentações ativas:</p>
                    <ul className="list-disc list-inside mt-1 text-sm">
                      {canEditData.activeMovements.map((mov: any) => (
                        <li key={mov.id}>{mov.movementNumber} - {mov.status}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* ============== ETAPA 1: DADOS DA ORDEM ============== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                1
              </div>
              <h3 className="text-sm font-semibold text-foreground">Dados da Ordem</h3>
            </div>

            {/* Evento - Combobox */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                Evento <span className="text-destructive">*</span>
              </Label>
              <Popover open={eventOpen && canEdit && !order} onOpenChange={setEventOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={eventOpen}
                    disabled={!!order || !canEdit}
                    className="w-full justify-between h-10 bg-card font-normal"
                    data-testid="select-event"
                  >
                    <span className="truncate">
                      {selectedEvent ? selectedEvent.name : "Selecione o evento"}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar evento..."
                      value={eventSearch}
                      onValueChange={setEventSearch}
                    />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>Nenhum evento encontrado</CommandEmpty>
                      {filteredEvents?.map((event) => (
                        <CommandItem
                          key={event.id}
                          value={event.id}
                          onSelect={() => handleEventChange(event.id)}
                          data-testid={`option-event-${event.id}`}
                          className="cursor-pointer"
                        >
                          <span className="truncate">{event.name}</span>
                          {selectedEventId === event.id && (
                            <Check className="h-4 w-4 ml-auto shrink-0 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedEvent && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Evento selecionado: <span className="font-medium text-foreground">{selectedEvent.name}</span>
                </p>
              )}
            </div>

            {/* Número da Ordem */}
            <div className="space-y-1.5">
              <Label htmlFor="orderNumber" className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Número da Ordem <span className="text-destructive">*</span>
              </Label>
              <Input
                id="orderNumber"
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                placeholder="Ex: LO-2026-001"
                disabled={!canEdit}
                className="h-10 bg-card"
                data-testid="input-order-number"
              />
            </div>

            {/* Datas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="plannedStart" className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Início Planejado <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="plannedStart"
                  type="datetime-local"
                  value={formData.plannedStartTime}
                  onChange={(e) => setFormData({ ...formData, plannedStartTime: e.target.value })}
                  disabled={!canEdit}
                  className={`h-10 bg-card ${!isStartValid ? 'border-destructive' : ''}`}
                  data-testid="input-planned-start"
                />
                {!isStartValid && (
                  <p className="text-xs text-destructive">Informe a data de início</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plannedEnd" className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Fim Planejado <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="plannedEnd"
                  type="datetime-local"
                  value={formData.plannedEndTime}
                  onChange={(e) => setFormData({ ...formData, plannedEndTime: e.target.value })}
                  disabled={!canEdit}
                  className={`h-10 bg-card ${!isEndValid || !isEndAfterStart ? 'border-destructive' : ''}`}
                  data-testid="input-planned-end"
                />
                {!isEndValid && (
                  <p className="text-xs text-destructive">Informe a data de fim</p>
                )}
                {isEndValid && !isEndAfterStart && (
                  <p className="text-xs text-destructive">Fim deve ser igual ou posterior ao início</p>
                )}
              </div>
            </div>

            {/* Criado por - readonly visual */}
            <div className="space-y-1.5">
              <Label htmlFor="createdBy" className="text-sm font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Criado por
              </Label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-muted/50 border border-border/40 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>{formData.createdBy || "-"}</span>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm font-semibold flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                Observações
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais sobre a ordem..."
                disabled={!canEdit}
                rows={3}
                className="bg-card resize-none"
                data-testid="textarea-notes"
              />
            </div>
          </div>

          {/* Separador */}
          <div className="border-t border-border/40" />

          {/* ============== ETAPA 2: REQUISIÇÕES APROVADAS ============== */}
          {!order && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Requisições Aprovadas</h3>
                  <p className="text-xs text-muted-foreground">
                    Selecione as requisições para consolidar nesta ordem
                  </p>
                </div>
                {selectedEventId && (
                  <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {selectedRequestIds.length} de {approvedRequests.length} selecionadas
                  </span>
                )}
              </div>

              {!selectedEventId ? (
                <div className="rounded-md border border-border/60 bg-muted/20 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Selecione um evento para visualizar as requisições aprovadas
                  </p>
                </div>
              ) : approvedRequests.length === 0 ? (
                <div className="rounded-md border border-border/60 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma requisição aprovada encontrada para este evento
                  </p>
                </div>
              ) : (
                <div className="border border-border/60 rounded-lg overflow-hidden bg-card/50">
                  {/* Header */}
                  <div className="grid grid-cols-[40px_1fr_1fr_80px] gap-2 px-3 py-2 bg-muted/50 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <span></span>
                    <span>ID</span>
                    <span>Área</span>
                    <span className="text-right">Status</span>
                  </div>
                  <div className="max-h-[180px] overflow-y-auto">
                    {approvedRequests.map((request, index) => (
                      <div
                        key={request.id}
                        className={`grid grid-cols-[40px_1fr_1fr_80px] gap-2 px-3 py-2.5 border-b border-border/20 items-center transition-colors cursor-pointer hover-elevate ${
                          selectedRequestIds.includes(request.id)
                            ? "bg-primary/5"
                            : ""
                        }`}
                        onClick={() => toggleRequestSelection(request.id)}
                        data-testid={`request-item-${request.id}`}
                        role="button"
                        aria-pressed={selectedRequestIds.includes(request.id)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleRequestSelection(request.id);
                          }
                        }}
                      >
                        <Checkbox
                          id={`req-${request.id}`}
                          checked={selectedRequestIds.includes(request.id)}
                          onCheckedChange={() => toggleRequestSelection(request.id)}
                          data-testid={`checkbox-request-${request.id}`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Selecionar requisição ${request.area}`}
                        />
                        <span className="text-xs font-mono text-muted-foreground">REQ-{reqNumericIdMap.get(request.id) || request.id.slice(0, 6).toUpperCase()}</span>
                        <span className="text-sm font-medium truncate">{request.area}</span>
                        <span className="text-xs text-muted-foreground text-right flex justify-end">
                          <StatusBadge status={request.status} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Separador */}
          {(!order && selectedEventId) && <div className="border-t border-border/40" />}

          {/* ============== ETAPA 3: VIAGENS ============== */}
          {selectedEventId && availableTrips.length > 0 && canLinkTrips && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {order ? "2" : "3"}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Planos de Viagens</h3>
                  <p className="text-xs text-muted-foreground">
                    Selecione os planos de viagens associados (opcional)
                  </p>
                </div>
                <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  {selectedTripIds.length} de {availableTrips.length} selecionadas
                </span>
              </div>

              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {availableTrips.map((trip, index) => (
                  <Card
                    key={trip.id}
                    className={`cursor-pointer transition-colors border hover-elevate ${
                      selectedTripIds.includes(trip.id)
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60"
                    }`}
                    onClick={() => canEdit && toggleTripSelection(trip.id)}
                    data-testid={`trip-item-${trip.id}`}
                    role="button"
                    aria-pressed={selectedTripIds.includes(trip.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        canEdit && toggleTripSelection(trip.id);
                      }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`trip-${trip.id}`}
                          checked={selectedTripIds.includes(trip.id)}
                          onCheckedChange={() => canEdit && toggleTripSelection(trip.id)}
                          disabled={!canEdit}
                          data-testid={`checkbox-trip-${trip.id}`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Selecionar plano de viagens ${trip.description || trip.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {trip.description || 'Sem descrição'}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground shrink-0">#{trip.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {trip.loadingLocation || 'Local não definido'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {trip.scheduledStart ? format(new Date(trip.scheduledStart), "dd MMM, HH:mm") : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Separador */}
          {(selectedEventId && availableTrips.length > 0 && canLinkTrips) && <div className="border-t border-border/40" />}

          {/* ============== RESUMO FINAL ============== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <Check className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Resumo</h3>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Evento</span>
                  <span className="font-medium text-foreground">
                    {selectedEvent?.name || <span className="text-muted-foreground">-</span>}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Número</span>
                  <span className="font-medium text-foreground">
                    {formData.orderNumber || <span className="text-muted-foreground">-</span>}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Período</span>
                  <span className="font-medium text-foreground">
                    {formData.plannedStartTime && formData.plannedEndTime ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(formData.plannedStartTime), "dd MMM HH:mm", { locale: ptBR })} -
                        {format(new Date(formData.plannedEndTime), "dd MMM HH:mm", { locale: ptBR })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Criado por</span>
                  <span className="font-medium text-foreground">{formData.createdBy || "-"}</span>
                </div>
              </div>

              {!order && (
                <div className="border-t border-border/40 pt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Requisições</span>
                    <span className="font-medium text-foreground">
                      {selectedRequestIds.length > 0 ? (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {selectedRequestIds.length} selecionada{selectedRequestIds.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Planos de Viagens</span>
                    <span className="font-medium text-foreground">
                      {selectedTripIds.length > 0 ? (
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          {selectedTripIds.length} selecionada{selectedTripIds.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Nenhuma (opcional)</span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {formData.notes && (
                <div className="border-t border-border/40 pt-3">
                  <span className="text-xs text-muted-foreground block">Observações</span>
                  <span className="text-sm text-foreground">{formData.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - fixo */}
        <DialogFooter className="p-5 pt-4 border-t border-border/40 bg-muted/20 flex items-center gap-3 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading || !canEdit || !isCreateValid}
            data-testid="button-submit"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </span>
            ) : order ? (
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4" />
                Atualizar Ordem
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Criar Ordem
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

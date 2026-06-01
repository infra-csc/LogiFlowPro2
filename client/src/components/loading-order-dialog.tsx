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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LoadingOrder, InsertLoadingOrder, Event, MaterialRequest, Trip } from "@shared/schema";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Calendar, Package, Truck, FileText } from "lucide-react";

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

  const { data: events } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: allRequests } = useQuery<MaterialRequest[]>({ queryKey: ["/api/requests"] });
  const { data: allTrips } = useQuery<Trip[]>({ queryKey: ["/api/trips"] });

  // Check if order can be edited
  const { data: canEditData } = useQuery<{ canEdit: boolean; reason?: string; activeMovements?: any[] }>({
    queryKey: [`/api/loading-orders/${order?.id}/can-edit`],
    enabled: !!order?.id && open,
  });

  // Load linked trips when editing
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

  const availableTrips = allTrips?.filter(
    (trip) => selectedEventId && trip.eventId === selectedEventId
  ) || [];

  useEffect(() => {
    if (open && order) {
      setFormData({
        eventId: order.eventId || "",
        orderNumber: order.orderNumber || "",
        plannedStartTime: order.plannedStartTime ? format(new Date(order.plannedStartTime), "yyyy-MM-dd'T'HH:mm") : "",
        plannedEndTime: order.plannedEndTime ? format(new Date(order.plannedEndTime), "yyyy-MM-dd'T'HH:mm") : "",
        status: order.status || "draft",
        createdBy: order.createdBy || user?.name || "",
        notes: order.notes || "",
      });
      setSelectedEventId(order.eventId || "");
      
      if (linkedTrips) {
        setSelectedTripIds(linkedTrips.map((lt: any) => lt.tripId));
      }
    } else if (!open) {
      setFormData({
        eventId: "",
        orderNumber: "",
        plannedStartTime: "",
        plannedEndTime: "",
        status: "draft",
        createdBy: user?.name || "",
        notes: "",
      });
      setSelectedRequestIds([]);
      setSelectedTripIds([]);
      setSelectedEventId("");
    }
  }, [open, order, user, linkedTrips]);

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

    if (!formData.eventId || !formData.orderNumber || 
        !formData.plannedStartTime || !formData.plannedEndTime ||
        !formData.createdBy) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/40">
          <DialogTitle className="text-lg font-semibold">
            {order ? "Editar Ordem de Carregamento" : "Nova Ordem de Carregamento"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {order 
              ? "Atualize as informações da ordem de carregamento" 
              : "Crie uma ordem consolidando requisições aprovadas"}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 pt-4">
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

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Linha 1: Evento + Número */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="event" className="text-sm font-medium">
                  Evento <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.eventId}
                  onValueChange={handleEventChange}
                  disabled={!!order || !canEdit}
                >
                  <SelectTrigger id="event" className="h-10" data-testid="select-event">
                    <SelectValue placeholder="Selecione o evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map((event) => (
                      <SelectItem key={event.id} value={event.id} data-testid={`option-event-${event.id}`}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orderNumber" className="text-sm font-medium">
                  Número da Ordem <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="orderNumber"
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  placeholder="Ex: LO-2026-001"
                  disabled={!canEdit}
                  className="h-10"
                  data-testid="input-order-number"
                />
              </div>
            </div>

            {/* Linha 2: Datas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="plannedStart" className="text-sm font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    Início Planejado <span className="text-destructive">*</span>
                  </span>
                </Label>
                <Input
                  id="plannedStart"
                  type="datetime-local"
                  value={formData.plannedStartTime}
                  onChange={(e) => setFormData({ ...formData, plannedStartTime: e.target.value })}
                  disabled={!canEdit}
                  className="h-10"
                  data-testid="input-planned-start"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plannedEnd" className="text-sm font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    Fim Planejado <span className="text-destructive">*</span>
                  </span>
                </Label>
                <Input
                  id="plannedEnd"
                  type="datetime-local"
                  value={formData.plannedEndTime}
                  onChange={(e) => setFormData({ ...formData, plannedEndTime: e.target.value })}
                  disabled={!canEdit}
                  className="h-10"
                  data-testid="input-planned-end"
                />
              </div>
            </div>

            {/* Linha 3: Criado por */}
            <div className="space-y-1.5">
              <Label htmlFor="createdBy" className="text-sm font-medium">
                Criado por <span className="text-destructive">*</span>
              </Label>
              <Input
                id="createdBy"
                value={formData.createdBy}
                onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                placeholder="Nome do responsável"
                disabled={!canEdit}
                className="h-10"
                data-testid="input-created-by"
              />
            </div>

            {/* Linha 4: Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm font-medium">
                Observações
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais sobre a ordem..."
                disabled={!canEdit}
                rows={3}
                data-testid="textarea-notes"
              />
            </div>

            {/* Seleção de Requisições (apenas criação) */}
            {!order && selectedEventId && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      Requisições Aprovadas ({approvedRequests.length})
                    </span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione as requisições para consolidar nesta ordem
                  </p>
                </div>
                
                {approvedRequests.length === 0 ? (
                  <Card className="border-border/60">
                    <CardContent className="py-6">
                      <p className="text-center text-sm text-muted-foreground">
                        Nenhuma requisição aprovada encontrada para este evento
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-card/50">
                    {approvedRequests.map((request) => (
                      <div
                        key={request.id}
                        className={`flex items-center gap-3 p-2.5 rounded-md border transition-colors ${
                          selectedRequestIds.includes(request.id)
                            ? "border-primary/40 bg-primary/5"
                            : "border-transparent hover:bg-muted/50"
                        }`}
                        data-testid={`request-item-${request.id}`}
                      >
                        <Checkbox
                          id={`req-${request.id}`}
                          checked={selectedRequestIds.includes(request.id)}
                          onCheckedChange={() => toggleRequestSelection(request.id)}
                          data-testid={`checkbox-request-${request.id}`}
                        />
                        <Label
                          htmlFor={`req-${request.id}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <div className="font-medium">{request.area}</div>
                          <div className="text-xs text-muted-foreground">
                            Requisição #{request.id.slice(0, 8)}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Seleção de Viagens */}
            {selectedEventId && availableTrips.length > 0 && canLinkTrips && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      Viagens ({availableTrips.length})
                    </span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione as viagens associadas a esta ordem (opcional)
                  </p>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-card/50">
                  {availableTrips.map((trip) => (
                    <div
                      key={trip.id}
                      className={`flex items-center gap-3 p-2.5 rounded-md border transition-colors ${
                        selectedTripIds.includes(trip.id)
                          ? "border-primary/40 bg-primary/5"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                      data-testid={`trip-item-${trip.id}`}
                    >
                      <Checkbox
                        id={`trip-${trip.id}`}
                        checked={selectedTripIds.includes(trip.id)}
                        onCheckedChange={() => toggleTripSelection(trip.id)}
                        disabled={!canEdit}
                        data-testid={`checkbox-trip-${trip.id}`}
                      />
                      <Label
                        htmlFor={`trip-${trip.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <div className="font-medium">{trip.description || 'Sem descrição'}</div>
                        <div className="text-xs text-muted-foreground">
                          Viagem #{trip.id.slice(0, 8)} - {trip.loadingLocation || 'Local não definido'}
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 pt-4 border-t border-border/40 bg-muted/30">
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
            disabled={isLoading || !canEdit}
            data-testid="button-submit"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </span>
            ) : order ? (
              "Atualizar"
            ) : (
              "Criar Ordem"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

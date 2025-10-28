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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

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
      // Load existing order data when editing
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
      
      // Load linked trips
      if (linkedTrips) {
        setSelectedTripIds(linkedTrips.map((lt: any) => lt.tripId));
      }
    } else if (!open) {
      // Reset form when closing
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
      
      // Add trips to the loading order
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
      
      // Update trips if provided
      if (data.tripIds !== undefined) {
        // Delete existing trips
        await apiRequest("DELETE", `/api/loading-orders/${order?.id}/trips`);
        
        // Add new trips
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

  const canEdit = !order || (canEditData?.canEdit !== false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {order ? "Editar Ordem de Carregamento" : "Nova Ordem de Carregamento"}
          </DialogTitle>
          <DialogDescription>
            {order 
              ? "Atualize as informações da ordem de carregamento" 
              : "Crie uma ordem consolidando requisições aprovadas"}
          </DialogDescription>
        </DialogHeader>

        {order && canEditData && !canEditData.canEdit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {canEditData.reason}
              {canEditData.activeMovements && canEditData.activeMovements.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Movimentações ativas:</p>
                  <ul className="list-disc list-inside mt-1">
                    {canEditData.activeMovements.map((mov: any) => (
                      <li key={mov.id}>{mov.movementNumber} - {mov.status}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="event" className="required">Evento</Label>
                <Select
                  value={formData.eventId}
                  onValueChange={handleEventChange}
                  disabled={!!order}
                >
                  <SelectTrigger id="event" data-testid="select-event">
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

              <div>
                <Label htmlFor="orderNumber" className="required">Número da Ordem</Label>
                <Input
                  id="orderNumber"
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  placeholder="Ex: LO-001"
                  disabled={!canEdit}
                  data-testid="input-order-number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plannedStart" className="required">Início Planejado</Label>
                <Input
                  id="plannedStart"
                  type="datetime-local"
                  value={formData.plannedStartTime}
                  onChange={(e) => setFormData({ ...formData, plannedStartTime: e.target.value })}
                  disabled={!canEdit}
                  data-testid="input-planned-start"
                />
              </div>

              <div>
                <Label htmlFor="plannedEnd" className="required">Fim Planejado</Label>
                <Input
                  id="plannedEnd"
                  type="datetime-local"
                  value={formData.plannedEndTime}
                  onChange={(e) => setFormData({ ...formData, plannedEndTime: e.target.value })}
                  disabled={!canEdit}
                  data-testid="input-planned-end"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="createdBy" className="required">Criado por</Label>
              <Input
                id="createdBy"
                value={formData.createdBy}
                onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                placeholder="Nome do responsável"
                disabled={!canEdit}
                data-testid="input-created-by"
              />
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais..."
                disabled={!canEdit}
                data-testid="textarea-notes"
              />
            </div>

            {!order && selectedEventId && (
              <div>
                <Label>Requisições Aprovadas ({approvedRequests.length})</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione as requisições para consolidar nesta ordem
                </p>
                
                {approvedRequests.length === 0 ? (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-center text-sm text-muted-foreground">
                        Nenhuma requisição aprovada encontrada para este evento
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                    {approvedRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center space-x-3 p-2 rounded hover-elevate"
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

            {selectedEventId && availableTrips.length > 0 && (
              <div>
                <Label>Viagens ({availableTrips.length})</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione as viagens associadas a esta ordem (opcional)
                </p>
                
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                  {availableTrips.map((trip) => (
                    <div
                      key={trip.id}
                      className="flex items-center space-x-3 p-2 rounded hover-elevate"
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || !canEdit}
              data-testid="button-submit"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Salvando..."
                : order
                ? "Atualizar"
                : "Criar Ordem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

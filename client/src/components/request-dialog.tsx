import { useState, useMemo } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { MaterialRequest, InsertMaterialRequest, Event } from "@shared/schema";

interface RequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: MaterialRequest;
}

export function RequestDialog({ open, onOpenChange, request }: RequestDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    eventId: request?.eventId || "",
    area: request?.area || "",
    notes: request?.notes || "",
  });

  const { data: events } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  const selectedEvent = useMemo(() => {
    return events?.find(e => e.id === formData.eventId);
  }, [events, formData.eventId]);

  const requestWindowInfo = useMemo(() => {
    if (!selectedEvent?.requestWindowStart || !selectedEvent?.requestWindowEnd) {
      return null;
    }

    const now = new Date();
    const start = new Date(selectedEvent.requestWindowStart);
    const end = new Date(selectedEvent.requestWindowEnd);

    const formatDate = (date: Date) => {
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const isBeforeWindow = now < start;
    const isAfterWindow = now > end;
    const isWithinWindow = !isBeforeWindow && !isAfterWindow;

    return {
      start: formatDate(start),
      end: formatDate(end),
      isBeforeWindow,
      isAfterWindow,
      isWithinWindow
    };
  }, [selectedEvent]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertMaterialRequest) => {
      const response = await apiRequest("POST", "/api/requests", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ description: "Requisição criada com sucesso" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      let description = "Erro ao criar requisição";
      
      // Check if error contains window information
      if (error?.windowStart && error?.windowEnd) {
        const start = new Date(error.windowStart);
        const end = new Date(error.windowEnd);
        description = `${error.error}\n\nPeríodo permitido: ${start.toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })} até ${end.toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      } else if (error?.error) {
        description = error.error;
      }
      
      toast({ 
        description: description, 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertMaterialRequest>) => {
      return apiRequest("PATCH", `/api/requests/${request?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ description: "Requisição atualizada com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao atualizar requisição", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.eventId || !formData.area) {
      toast({ description: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    const submitData: InsertMaterialRequest = {
      eventId: formData.eventId,
      area: formData.area,
      notes: formData.notes || undefined,
      status: "draft",
      requestedBy: user?.id || "sistema",
    };

    if (request) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{request ? "Editar Requisição" : "Nova Requisição"}</DialogTitle>
          <DialogDescription>
            {request ? "Atualize os dados da requisição" : "Crie uma requisição de materiais"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eventId">Evento *</Label>
            <Select 
              value={formData.eventId}
              onValueChange={(value) => setFormData({ ...formData, eventId: value })}
            >
              <SelectTrigger data-testid="select-event">
                <SelectValue placeholder="Selecione o evento" />
              </SelectTrigger>
              <SelectContent>
                {events?.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {requestWindowInfo && (
              <Alert variant={requestWindowInfo.isWithinWindow ? "default" : "destructive"} className="mt-2">
                <div className="flex items-start gap-2">
                  {requestWindowInfo.isWithinWindow ? (
                    <Calendar className="h-4 w-4 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                  )}
                  <AlertDescription className="text-sm">
                    {requestWindowInfo.isWithinWindow && (
                      <span>
                        <strong>Período permitido:</strong> {requestWindowInfo.start} até {requestWindowInfo.end}
                      </span>
                    )}
                    {requestWindowInfo.isBeforeWindow && (
                      <span>
                        <strong>Atenção:</strong> Requisições para este evento ainda não estão permitidas.
                        <br />
                        <span className="text-xs">Período: {requestWindowInfo.start} até {requestWindowInfo.end}</span>
                      </span>
                    )}
                    {requestWindowInfo.isAfterWindow && (
                      <span>
                        <strong>Atenção:</strong> O período de requisição para este evento já foi encerrado.
                        <br />
                        <span className="text-xs">Período permitido era: {requestWindowInfo.start} até {requestWindowInfo.end}</span>
                      </span>
                    )}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">Nome da Requisição *</Label>
            <Input
              id="area"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              placeholder="Ex: Cenografia Palco Principal"
              data-testid="input-area"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações sobre a requisição (opcional)"
              data-testid="input-notes"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-request">
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-request"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : (request ? "Atualizar" : "Criar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

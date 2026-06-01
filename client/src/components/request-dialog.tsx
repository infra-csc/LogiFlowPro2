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
      toast({ description: "Requisicao criada com sucesso" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      let description = "Erro ao criar requisicao";
      
      if (error?.windowStart && error?.windowEnd) {
        const start = new Date(error.windowStart);
        const end = new Date(error.windowEnd);
        description = `${error.error}\n\nPeriodo permitido: ${start.toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })} ate ${end.toLocaleString('pt-BR', { 
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
      toast({ description: "Requisicao atualizada com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao atualizar requisicao", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.eventId || !formData.area) {
      toast({ description: "Preencha todos os campos obrigatorios", variant: "destructive" });
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
      <DialogContent className="max-w-md overflow-hidden p-0">
        {/* Header with border */}
        <div className="p-6 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{request ? "Editar Requisicao" : "Nova Requisicao"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {request
                ? "Atualize os dados da requisicao."
                : "Crie uma requisicao de materiais. Ela comeca como rascunho e so pode ser enviada para aprovacao dentro do periodo permitido pelo evento."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Evento */}
          <div className="space-y-2">
            <Label htmlFor="eventId" className="text-sm font-medium">Evento *</Label>
            <Select
              value={formData.eventId}
              onValueChange={(value) => setFormData({ ...formData, eventId: value })}
            >
              <SelectTrigger data-testid="select-event" className="h-10">
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
                    <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <AlertDescription className="text-sm">
                    {requestWindowInfo.isWithinWindow && (
                      <span>
                        <strong>Periodo permitido:</strong> {requestWindowInfo.start} ate {requestWindowInfo.end}
                      </span>
                    )}
                    {requestWindowInfo.isBeforeWindow && (
                      <span>
                        <strong>Atencao:</strong> Requisicoes para este evento ainda nao estao permitidas.
                        <br />
                        <span className="text-xs">Periodo: {requestWindowInfo.start} ate {requestWindowInfo.end}</span>
                      </span>
                    )}
                    {requestWindowInfo.isAfterWindow && (
                      <span>
                        <strong>Atencao:</strong> O periodo de requisicao para este evento ja foi encerrado.
                        <br />
                        <span className="text-xs">Periodo permitido era: {requestWindowInfo.start} ate {requestWindowInfo.end}</span>
                      </span>
                    )}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="area" className="text-sm font-medium">Nome da Requisicao *</Label>
            <Input
              id="area"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              placeholder="Ex: Cenografia Palco Principal"
              data-testid="input-area"
              className="h-10"
            />
          </div>

          {/* Observacoes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Observacoes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observacoes sobre a requisicao (opcional)"
              data-testid="input-notes"
              rows={3}
            />
          </div>
        </form>

        {/* Footer bar */}
        <div className="bg-muted/50 p-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-request">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit-request"
          >
            {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : (request ? "Atualizar" : "Criar")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

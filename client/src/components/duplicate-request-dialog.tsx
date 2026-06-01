import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Calendar, AlertCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Event } from "@shared/schema";
import { useLocation } from "wouter";

interface DuplicateRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  currentArea: string;
  itemCount: number;
}

export function DuplicateRequestDialog({ 
  open, 
  onOpenChange, 
  requestId,
  currentArea,
  itemCount 
}: DuplicateRequestDialogProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState({
    eventId: "",
    area: `${currentArea} (Cópia)`,
    notes: "",
  });

  const { data: events } = useQuery<Event[]>({ 
    queryKey: ["/api/events"],
    enabled: open 
  });

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

  const duplicateMutation = useMutation({
    mutationFn: async (data: { eventId: string; area: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/requests/${requestId}/duplicate`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Requisição duplicada",
        description: "A requisição foi duplicada com sucesso" 
      });
      onOpenChange(false);
      // Redirecionar para a nova requisição
      navigate(`/requests/${data.id}`);
    },
    onError: (error: any) => {
      let description = "Não foi possível duplicar a requisição";
      
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.eventId || !formData.area) {
      toast({ 
        description: "Preencha o evento e o nome da requisição", 
        variant: "destructive" 
      });
      return;
    }

    duplicateMutation.mutate({
      eventId: formData.eventId,
      area: formData.area,
      notes: formData.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicar Requisição
          </DialogTitle>
          <DialogDescription>
            Cria uma nova requisição como rascunho, copiando todos os {itemCount} {itemCount === 1 ? "item" : "itens"} desta requisição. Você pode alterar o evento e o nome antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eventId">Evento *</Label>
            <Select 
              value={formData.eventId}
              onValueChange={(value) => setFormData({ ...formData, eventId: value })}
            >
              <SelectTrigger data-testid="select-duplicate-event">
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
              data-testid="input-duplicate-area"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações sobre a requisição (opcional)"
              data-testid="input-duplicate-notes"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              data-testid="button-cancel-duplicate"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={duplicateMutation.isPending}
              data-testid="button-confirm-duplicate"
            >
              {duplicateMutation.isPending ? "Duplicando..." : "Duplicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

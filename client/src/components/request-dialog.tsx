import { useState, useMemo, useEffect } from "react";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, AlertCircle, Check, ChevronsUpDown, Loader2, PartyPopper, Clock, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { MaterialRequest, InsertMaterialRequest, Event } from "@shared/schema";
import { cn } from "@/lib/utils";

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
  const [eventOpen, setEventOpen] = useState(false);

  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  useEffect(() => {
    if (open) {
      setFormData({
        eventId: request?.eventId || "",
        area: request?.area || "",
        notes: request?.notes || "",
      });
    }
  }, [open, request]);

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

  const isValid = formData.eventId && formData.area.trim().length > 0;
  const isPending = createMutation.isPending || updateMutation.isPending;

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

  const windowBadge = requestWindowInfo
    ? requestWindowInfo.isWithinWindow
      ? { label: "Requisições abertas", icon: PartyPopper, color: "bg-chart-4/10 text-chart-4 border-chart-4/20" }
      : requestWindowInfo.isBeforeWindow
        ? { label: "Período ainda não iniciado", icon: Clock, color: "bg-chart-5/10 text-chart-5 border-chart-5/20" }
        : { label: "Período encerrado", icon: Lock, color: "bg-destructive/10 text-destructive border-destructive/20" }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {request ? "Editar Requisição" : "Nova Requisição"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {request
                ? "Atualize os dados da requisição."
                : "Crie uma requisição de materiais. Ela começa como rascunho e só pode ser enviada para aprovação dentro do período permitido pelo evento."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Bloco 1: Evento */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Evento *</Label>
            <Popover open={eventOpen} onOpenChange={setEventOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={eventOpen}
                  className="w-full justify-between h-10 font-normal"
                  data-testid="combobox-event"
                >
                  {selectedEvent ? selectedEvent.name : "Selecione o evento"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar evento por nome..." />
                  <CommandList className="max-h-[280px]">
                    {eventsLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando eventos...
                      </div>
                    ) : events?.length === 0 ? (
                      <CommandEmpty>
                        <div className="flex flex-col items-center py-4 gap-2">
                          <AlertCircle className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm">Nenhum evento encontrado</span>
                        </div>
                      </CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {events?.map((event) => (
                          <CommandItem
                            key={event.id}
                            value={event.name}
                            onSelect={() => {
                              setFormData({ ...formData, eventId: event.id });
                              setEventOpen(false);
                            }}
                            data-testid={`event-option-${event.id}`}
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-sm font-medium truncate">{event.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {event.eventDate ? new Date(event.eventDate).toLocaleDateString('pt-BR') : ''}
                                {event.location ? ` · ${event.location}` : ''}
                              </span>
                            </div>
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4 shrink-0",
                                formData.eventId === event.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Resumo do evento selecionado */}
            {selectedEvent && (
              <Card className="border-border/60 bg-muted/30">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <PartyPopper className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{selectedEvent.name}</span>
                  </div>
                  {requestWindowInfo ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {requestWindowInfo.start} até {requestWindowInfo.end}
                        </span>
                      </div>
                      {windowBadge && (
                        <Badge variant="outline" className={cn("text-[10px] font-medium", windowBadge.color)}>
                          <windowBadge.icon className="h-3 w-3 mr-1" />
                          {windowBadge.label}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sem período de requisição configurado para este evento.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Alerta de janela de requisição */}
            {requestWindowInfo && !requestWindowInfo.isWithinWindow && (
              <Alert variant="destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <AlertDescription className="text-sm">
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

          {/* Bloco 2: Identificação */}
          <div className="space-y-3">
            <Label htmlFor="area" className="text-sm font-medium">
              Área / Nome da requisição *
            </Label>
            <Input
              id="area"
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              placeholder="Ex: Cenografia — Palco Principal"
              data-testid="input-area"
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Use um nome que ajude a identificar o setor ou uso dos materiais.
            </p>
          </div>

          {/* Bloco 3: Observações */}
          <div className="space-y-3">
            <Label htmlFor="notes" className="text-sm font-medium">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações sobre a requisição (opcional)"
              data-testid="input-notes"
              rows={3}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="bg-muted/50 p-4 flex flex-col sm:flex-row justify-end gap-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-request"
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            data-testid="button-submit-request"
            className="w-full sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              request ? "Atualizar" : "Criar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

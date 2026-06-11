import { useState, useMemo, useEffect } from "react";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar, AlertCircle, Check, ChevronsUpDown, Loader2, PartyPopper,
  Clock, Lock, Package, LayoutTemplate, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { MaterialRequest, InsertMaterialRequest, Event, RequestAreaTemplate } from "@shared/schema";
import { cn } from "@/lib/utils";

// ── types ───────────────────────────────────────────────────────────────────

type TemplateItem = {
  id: string;
  productId: string;
  itemNotes: string | null;
  productName: string | null;
  productSku: string | null;
  productUnit: string | null;
};

type TemplateWithItems = RequestAreaTemplate & { items: TemplateItem[] };

// ── helpers ──────────────────────────────────────────────────────────────────

function getEventWindowStatus(event: Event) {
  if (!event.requestWindowStart || !event.requestWindowEnd) return null;
  const now = new Date();
  const start = new Date(event.requestWindowStart);
  const end = new Date(event.requestWindowEnd);
  if (now < start) return { label: "Futuro", color: "bg-chart-5/10 text-chart-5 border-chart-5/20" as const, icon: Clock };
  if (now > end) return { label: "Encerrado", color: "bg-destructive/10 text-destructive border-destructive/20" as const, icon: Lock };
  return { label: "Aberto", color: "bg-chart-4/10 text-chart-4 border-chart-4/20" as const, icon: PartyPopper };
}

// ── component ─────────────────────────────────────────────────────────────────

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
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [showTemplateItems, setShowTemplateItems] = useState(false);

  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: allTemplates } = useQuery<RequestAreaTemplate[]>({ queryKey: ["/api/request-templates"] });
  const templates = allTemplates?.filter((t) => t.isActive);
  const { data: selectedTemplateDetail } = useQuery<TemplateWithItems>({
    queryKey: ["/api/request-templates", templateId],
    enabled: !!templateId,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        eventId: request?.eventId || "",
        area: request?.area || "",
        notes: request?.notes || "",
      });
      setTemplateId(null);
      setShowTemplateItems(false);
    }
  }, [open, request]);

  const selectedEvent = useMemo(() => events?.find(e => e.id === formData.eventId), [events, formData.eventId]);

  const requestWindowInfo = useMemo(() => {
    if (!selectedEvent?.requestWindowStart || !selectedEvent?.requestWindowEnd) return null;
    const now = new Date();
    const start = new Date(selectedEvent.requestWindowStart);
    const end = new Date(selectedEvent.requestWindowEnd);
    const formatDate = (d: Date) =>
      d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return {
      start: formatDate(start),
      end: formatDate(end),
      isBeforeWindow: now < start,
      isAfterWindow: now > end,
      isWithinWindow: now >= start && now <= end,
    };
  }, [selectedEvent]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertMaterialRequest & { templateId?: string }) => {
      const response = await apiRequest("POST", "/api/requests", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      return response.json();
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
        const fmt = (d: Date) =>
          d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        description = `${error.error}\n\nPeríodo permitido: ${fmt(start)} até ${fmt(end)}`;
      } else if (error?.error) {
        description = error.error;
      }
      toast({ description, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertMaterialRequest>) =>
      apiRequest("PATCH", `/api/requests/${request?.id}`, data),
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
    const submitData = {
      eventId: formData.eventId,
      area: formData.area,
      notes: formData.notes || undefined,
      status: "draft" as const,
      requestedBy: user?.id || "sistema",
    };
    if (request) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate({ ...submitData, templateId: templateId || undefined });
    }
  };

  const windowBadge = requestWindowInfo
    ? requestWindowInfo.isWithinWindow
      ? { label: "Requisições abertas", icon: PartyPopper, color: "bg-chart-4/10 text-chart-4 border-chart-4/20" }
      : requestWindowInfo.isBeforeWindow
        ? { label: "Período ainda não iniciado", icon: Clock, color: "bg-chart-5/10 text-chart-5 border-chart-5/20" }
        : { label: "Período encerrado", icon: Lock, color: "bg-destructive/10 text-destructive border-destructive/20" }
    : null;

  const templateItemCount = selectedTemplateDetail?.items.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 flex flex-col">
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

        <form onSubmit={handleSubmit} className="space-y-6 p-6 overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>

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
                        {events?.map((event) => {
                          const windowStatus = getEventWindowStatus(event);
                          const WindowIcon = windowStatus?.icon;
                          return (
                            <CommandItem
                              key={event.id}
                              value={event.name}
                              onSelect={() => {
                                setFormData({ ...formData, eventId: event.id });
                                setEventOpen(false);
                              }}
                              data-testid={`event-option-${event.id}`}
                            >
                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium truncate">{event.name}</span>
                                  <Check className={cn("h-4 w-4 shrink-0", formData.eventId === event.id ? "opacity-100" : "opacity-0")} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {event.eventDate ? new Date(event.eventDate).toLocaleDateString("pt-BR") : ""}
                                    {event.location ? ` · ${event.location}` : ""}
                                  </span>
                                  {windowStatus && (
                                    <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0 h-4", windowStatus.color)}>
                                      {WindowIcon && <WindowIcon className="h-2.5 w-2.5 mr-1" />}
                                      {windowStatus.label}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Resumo do evento */}
            {selectedEvent && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{selectedEvent.name}</span>
                </div>
                {requestWindowInfo ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{requestWindowInfo.start} até {requestWindowInfo.end}</span>
                    </div>
                    {windowBadge && (
                      <Badge variant="outline" className={cn("text-[10px] font-medium", windowBadge.color)}>
                        <windowBadge.icon className="h-3 w-3 mr-1" />
                        {windowBadge.label}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem período de requisição configurado.</p>
                )}
              </div>
            )}

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

          {/* Bloco 2: Área — template ou personalizada */}
          {!request && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Área / Template *</Label>

              {/* Template combobox */}
              {templates && templates.length > 0 && (
                <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-10 font-normal"
                      data-testid="combobox-template"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <LayoutTemplate className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {templateId
                            ? templates.find((t) => t.id === templateId)?.name
                            : "Selecionar template de área"}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar template..." />
                      <CommandList className="max-h-60">
                        <CommandEmpty>Nenhum template encontrado</CommandEmpty>
                        <CommandGroup>
                          {templateId && (
                            <CommandItem
                              value="__none__"
                              onSelect={() => {
                                setTemplateId(null);
                                setFormData({ ...formData, area: "" });
                                setTemplateOpen(false);
                                setShowTemplateItems(false);
                              }}
                            >
                              <span className="text-muted-foreground text-sm">Sem template (personalizado)</span>
                            </CommandItem>
                          )}
                          {templates.map((t) => (
                            <CommandItem
                              key={t.id}
                              value={`${t.name} ${t.area}`}
                              onSelect={() => {
                                setTemplateId(t.id);
                                setFormData({ ...formData, area: t.area });
                                setTemplateOpen(false);
                                setShowTemplateItems(true);
                              }}
                              data-testid={`template-option-${t.id}`}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", templateId === t.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-sm font-medium truncate">{t.name}</span>
                                <Badge variant="secondary" className="text-xs shrink-0">{t.area}</Badge>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              {/* Nome da área (editável mesmo quando template selecionado) */}
              <Input
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="Nome da área / requisição"
                data-testid="input-area"
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                {templateId
                  ? "Nome pré-preenchido pelo template. Edite se necessário."
                  : templates && templates.length > 0
                  ? "Selecione um template acima ou escreva um nome personalizado."
                  : "Use um nome que identifique o setor ou uso dos materiais."}
              </p>

              {/* Preview dos itens do template */}
              {templateId && selectedTemplateDetail && (
                <div className="rounded-md border border-border/60 bg-muted/20 overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover-elevate"
                    onClick={() => setShowTemplateItems(!showTemplateItems)}
                    data-testid="button-toggle-template-preview"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span>
                        {templateItemCount === 0
                          ? "Template sem itens cadastrados"
                          : `${templateItemCount} ${templateItemCount === 1 ? "produto será carregado" : "produtos serão carregados"} — quantidades zeradas`}
                      </span>
                    </div>
                    {templateItemCount > 0 && (
                      showTemplateItems
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {showTemplateItems && templateItemCount > 0 && (
                    <div className="border-t border-border/40 divide-y divide-border/30">
                      {selectedTemplateDetail.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 px-3 py-1.5">
                          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1 truncate">{item.productName}</span>
                          {item.productUnit && (
                            <Badge variant="outline" className="text-xs shrink-0">{item.productUnit}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {templateItemCount > 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2 border-t border-border/30">
                      Preencha as quantidades após criar a requisição.
                    </p>
                  )}
                  {templateItemCount === 0 && (
                    <p className="text-xs text-muted-foreground px-3 pb-2">
                      A requisição será criada sem itens pré-preenchidos.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Área simples para edição */}
          {request && (
            <div className="space-y-3">
              <Label htmlFor="area" className="text-sm font-medium">Área / Nome da requisição *</Label>
              <Input
                id="area"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="Ex: Cenografia — Palco Principal"
                data-testid="input-area"
                className="h-10"
              />
            </div>
          )}

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
            ) : request ? (
              "Atualizar"
            ) : templateId ? (
              "Criar com template"
            ) : (
              "Criar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

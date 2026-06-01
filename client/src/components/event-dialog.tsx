import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Event, InsertEvent } from "@shared/schema";
import { insertEventSchema } from "@shared/schema";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect } from "react";
import { AlertCircle, CalendarRange } from "lucide-react";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event;
}

const STATUS_LABELS: Record<string, string> = {
  planning: "Planejamento",
  approved: "Aprovado",
  in_progress: "Em Andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}

function formatDatetimeLocal(val: Date | string | null | undefined): string {
  if (!val) return "";
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function fmtDisplay(val: Date | string | null | undefined): string {
  if (!val) return "—";
  try {
    const d = val instanceof Date ? val : new Date(val as string);
    if (isNaN(d.getTime())) return "—";
    return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function fmtShort(val: Date | string | null | undefined): string {
  if (!val) return "—";
  try {
    const d = val instanceof Date ? val : new Date(val as string);
    if (isNaN(d.getTime())) return "—";
    return format(d, "dd/MM/yy", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function EventDialog({ open, onOpenChange, event }: EventDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertEvent>({
    resolver: zodResolver(insertEventSchema),
    defaultValues: {
      sku: "",
      name: "",
      client: "",
      location: "",
      setupDate: new Date(),
      eventDate: new Date(),
      teardownDate: new Date(),
      requestWindowStart: undefined,
      requestWindowEnd: undefined,
      status: "planning",
      notes: "",
      cutoffConfig: {},
    },
  });

  useEffect(() => {
    if (open) {
      if (event) {
        form.reset({
          sku: event.sku || "",
          name: event.name,
          client: event.client,
          location: event.location,
          setupDate: new Date(event.setupDate),
          eventDate: new Date(event.eventDate),
          teardownDate: new Date(event.teardownDate),
          requestWindowStart: event.requestWindowStart
            ? new Date(event.requestWindowStart)
            : undefined,
          requestWindowEnd: event.requestWindowEnd
            ? new Date(event.requestWindowEnd)
            : undefined,
          status: event.status,
          notes: event.notes || "",
          cutoffConfig: event.cutoffConfig || {},
        });
      } else {
        form.reset({
          sku: "",
          name: "",
          client: "",
          location: "",
          setupDate: new Date(),
          eventDate: new Date(),
          teardownDate: new Date(),
          requestWindowStart: undefined,
          requestWindowEnd: undefined,
          status: "planning",
          notes: "",
          cutoffConfig: {},
        });
      }
    }
  }, [event, open]);

  // Watch all date fields for reactive validation and summary
  const [
    watchedSetup,
    watchedEvent,
    watchedTeardown,
    watchedWindowStart,
    watchedWindowEnd,
    watchedName,
    watchedClient,
    watchedLocation,
    watchedStatus,
  ] = useWatch({
    control: form.control,
    name: [
      "setupDate",
      "eventDate",
      "teardownDate",
      "requestWindowStart",
      "requestWindowEnd",
      "name",
      "client",
      "location",
      "status",
    ],
  });

  // Date order validation
  const setupAfterEvent =
    watchedSetup && watchedEvent && new Date(watchedSetup) > new Date(watchedEvent);
  const teardownBeforeEvent =
    watchedTeardown && watchedEvent && new Date(watchedTeardown) < new Date(watchedEvent);
  const windowStartAfterEnd =
    watchedWindowStart &&
    watchedWindowEnd &&
    new Date(watchedWindowStart) > new Date(watchedWindowEnd);

  // Window status (live)
  const now = new Date();
  const wsStart = watchedWindowStart ? new Date(watchedWindowStart) : null;
  const wsEnd = watchedWindowEnd ? new Date(watchedWindowEnd) : null;
  let windowStatus = "none";
  if (wsStart || wsEnd) {
    if (wsStart && now < wsStart) windowStatus = "future";
    else if (wsEnd && now > wsEnd) windowStatus = "closed";
    else windowStatus = "open";
  }

  const createMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      return apiRequest("POST", "/api/events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-events"] });
      toast({ description: "Evento criado com sucesso." });
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err?.message || "Falha ao criar evento.";
      toast({ description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      return apiRequest("PATCH", `/api/events/${event?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-events"] });
      toast({ description: "Evento atualizado com sucesso." });
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg = err?.message || "Falha ao atualizar evento.";
      toast({ description: msg, variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertEvent) => {
    if (event) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col p-0 gap-0 max-h-[90vh] border-border/60">
        {/* Fixed header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle>{event ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          <DialogDescription>
            Configure datas, cliente, local e janela de requisição de materiais.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Scrollable body */}
            <div
              className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
              style={{ scrollbarWidth: "thin" }}
            >
              {/* ── A. Identificação ───────────────────────────────── */}
              <SectionLabel>Identificação</SectionLabel>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nome do Evento <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Night Run Belo Horizonte"
                          data-testid="input-event-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Cliente <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Tatica Mkt"
                          data-testid="input-client"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Local <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Praça Nova da Pampulha"
                        data-testid="input-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU do Evento</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Código para integração, se houver"
                        data-testid="input-sku"
                        className="font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── B. Cronograma ──────────────────────────────────── */}
              <SectionLabel>Cronograma do Evento</SectionLabel>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="setupDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Montagem <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={formatDatetimeLocal(field.value)}
                          onChange={(e) =>
                            field.onChange(e.target.value ? new Date(e.target.value) : null)
                          }
                          data-testid="input-setup-date"
                          aria-invalid={!!setupAfterEvent}
                          className={setupAfterEvent ? "border-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Data do Evento <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={formatDatetimeLocal(field.value)}
                          onChange={(e) =>
                            field.onChange(e.target.value ? new Date(e.target.value) : null)
                          }
                          data-testid="input-event-date"
                          className={
                            setupAfterEvent || teardownBeforeEvent ? "border-amber-500" : ""
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teardownDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Desmontagem <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={formatDatetimeLocal(field.value)}
                          onChange={(e) =>
                            field.onChange(e.target.value ? new Date(e.target.value) : null)
                          }
                          data-testid="input-teardown-date"
                          aria-invalid={!!teardownBeforeEvent}
                          className={teardownBeforeEvent ? "border-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Date order warnings */}
              {setupAfterEvent && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  A data de montagem deve ser anterior à data do evento.
                </div>
              )}
              {teardownBeforeEvent && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  A data de desmontagem deve ser posterior à data do evento.
                </div>
              )}

              {/* ── C. Janela de Requisição ────────────────────────── */}
              <SectionLabel>Período de Requisição de Materiais</SectionLabel>

              <p className="text-xs text-muted-foreground -mt-2">
                Defina quando os usuários poderão criar e enviar requisições para este evento.
                Se nenhuma janela for definida, não haverá restrição por data.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="requestWindowStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início da Janela</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={formatDatetimeLocal(field.value)}
                          onChange={(e) =>
                            field.onChange(e.target.value ? new Date(e.target.value) : undefined)
                          }
                          data-testid="input-request-window-start"
                          aria-invalid={!!windowStartAfterEnd}
                          className={windowStartAfterEnd ? "border-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requestWindowEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fim da Janela</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={formatDatetimeLocal(field.value)}
                          onChange={(e) =>
                            field.onChange(e.target.value ? new Date(e.target.value) : undefined)
                          }
                          data-testid="input-request-window-end"
                          aria-invalid={!!windowStartAfterEnd}
                          className={windowStartAfterEnd ? "border-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Window validation warning */}
              {windowStartAfterEnd && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  O início da janela de requisição deve ser anterior ao fim.
                </div>
              )}

              {/* Live window status */}
              {(wsStart || wsEnd) && !windowStartAfterEnd && (
                <div className="flex items-center gap-2 text-xs">
                  <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {windowStatus === "open" && (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
                      Requisições abertas agora
                    </Badge>
                  )}
                  {windowStatus === "future" && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10">
                      Janela ainda não iniciou
                    </Badge>
                  )}
                  {windowStatus === "closed" && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50">
                      Período encerrado
                    </Badge>
                  )}
                </div>
              )}

              {/* ── D. Status e Observações ────────────────────────── */}
              <SectionLabel>Status e Observações</SectionLabel>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Detalhes adicionais do evento..."
                        rows={3}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── E. Resumo ──────────────────────────────────────── */}
              {(watchedName || watchedClient || watchedLocation) && (
                <>
                  <SectionLabel>Resumo</SectionLabel>
                  <div className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border/40">
                      {[
                        { label: "Evento", value: watchedName || "—" },
                        { label: "Cliente", value: watchedClient || "—" },
                        { label: "Local", value: watchedLocation || "—" },
                        { label: "Montagem", value: fmtShort(watchedSetup) },
                        { label: "Data do Evento", value: fmtShort(watchedEvent) },
                        { label: "Desmontagem", value: fmtShort(watchedTeardown) },
                        {
                          label: "Início da Janela",
                          value: watchedWindowStart ? fmtDisplay(watchedWindowStart) : "Não definido",
                        },
                        {
                          label: "Fim da Janela",
                          value: watchedWindowEnd ? fmtDisplay(watchedWindowEnd) : "Não definido",
                        },
                        {
                          label: "Status",
                          value: STATUS_LABELS[watchedStatus || "planning"] || watchedStatus || "—",
                        },
                      ].map((cell) => (
                        <div key={cell.label} className="bg-card px-3 py-2.5">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            {cell.label}
                          </p>
                          <p className="text-xs font-medium text-foreground truncate mt-0.5">
                            {cell.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Fixed footer */}
            <DialogFooter className="px-6 py-4 border-t border-border/40 shrink-0 flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending || !!setupAfterEvent || !!teardownBeforeEvent || !!windowStartAfterEnd}
                data-testid="button-submit-event"
              >
                {isPending
                  ? "Salvando..."
                  : event
                  ? "Salvar Evento"
                  : "Criar Evento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

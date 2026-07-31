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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Event, InsertEvent } from "@shared/schema";
import { insertEventSchema } from "@shared/schema";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useEffect } from "react";
import { AlertCircle, CalendarRange } from "lucide-react";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}

function getDatePart(val: Date | string | null | undefined): string {
  if (!val) return "";
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    return format(d, "yyyy-MM-dd");
  } catch {
    return "";
  }
}

function getTimePart(val: Date | string | null | undefined): string {
  if (!val) return "";
  try {
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    return format(d, "HH:mm");
  } catch {
    return "";
  }
}

function combineDateTime(datePart: string, timePart: string): Date | undefined {
  if (!datePart) return undefined;
  const d = new Date(`${datePart}T${timePart || "00:00"}`);
  return isNaN(d.getTime()) ? undefined : d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Date + optional time pair bound to a single Date form field. */
function DateTimeFields({
  value,
  onChange,
  invalid,
  dateTestId,
  timeTestId,
  hideTime = false,
}: {
  value: Date | string | null | undefined;
  onChange: (d: Date | undefined) => void;
  invalid?: boolean;
  dateTestId?: string;
  timeTestId?: string;
  hideTime?: boolean;
}) {
  const datePart = getDatePart(value);
  const timePart = getTimePart(value);
  return (
    <div className={cn("grid gap-2", hideTime ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_96px]")}>
      <Input
        type="date"
        value={datePart}
        onChange={(e) => onChange(combineDateTime(e.target.value, hideTime ? "00:00" : timePart))}
        className={cn("min-w-0", invalid && "border-destructive")}
        data-testid={dateTestId}
      />
      {!hideTime && (
        <Input
          type="time"
          value={timePart}
          onChange={(e) => onChange(combineDateTime(datePart, e.target.value))}
          className={cn("min-w-0", invalid && "border-destructive")}
          data-testid={timeTestId}
        />
      )}
    </div>
  );
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
      setupDate: undefined,
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
          setupDate: event.setupDate ? new Date(event.setupDate) : undefined,
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
          setupDate: undefined,
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

  // Watch date + identity fields for reactive validation
  const [
    watchedSetup,
    watchedEvent,
    watchedTeardown,
    watchedWindowStart,
    watchedWindowEnd,
  ] = useWatch({
    control: form.control,
    name: [
      "setupDate",
      "eventDate",
      "teardownDate",
      "requestWindowStart",
      "requestWindowEnd",
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

  // Window shortcuts (front-end only — just fill fields)
  const eventBase = watchedEvent ? new Date(watchedEvent) : null;
  const applyOpen7DaysBefore = () => {
    if (!eventBase) return;
    form.setValue("requestWindowStart", addDays(eventBase, -7), { shouldValidate: true });
  };
  const applyCloseDayBefore = () => {
    if (!eventBase) return;
    form.setValue("requestWindowEnd", addDays(eventBase, -1), { shouldValidate: true });
  };
  const applyNoWindow = () => {
    form.setValue("requestWindowStart", undefined, { shouldValidate: true });
    form.setValue("requestWindowEnd", undefined, { shouldValidate: true });
  };

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
  // The setup/teardown ordering relative to the event date is a warning, not a
  // block — real schedules sometimes need dates the strict order would reject,
  // and blocking the save was preventing free date editing. Only a request
  // window whose start is after its end stays blocking, since that window would
  // never open.
  const hasBlockingError = !!windowStartAfterEnd;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1100px)] max-w-[calc(100vw-2rem)] flex flex-col p-0 gap-0 max-h-[92vh] overflow-hidden border-border/60">
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
            {/* Body — fits without scroll on desktop; scrolls only if needed (mobile) */}
            <div
              className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0"
              style={{ scrollbarWidth: "thin" }}
            >
              {/* ── A. Identificação ───────────────────────────────── */}
              <SectionLabel>Identificação</SectionLabel>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0 [&>*]:min-w-0">
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

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Endereço <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Av. Otacílio Negrão de Lima, 1000 — Pampulha, Belo Horizonte/MG"
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
              </div>

              {/* ── B. Cronograma ──────────────────────────────────── */}
              <SectionLabel>Cronograma do Evento</SectionLabel>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0 [&>*]:min-w-0">
                <FormField
                  control={form.control}
                  name="setupDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montagem</FormLabel>
                      <FormControl>
                        <DateTimeFields
                          value={field.value}
                          onChange={field.onChange}
                          invalid={!!setupAfterEvent}
                          dateTestId="input-setup-date"
                          timeTestId="input-setup-time"
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
                        <DateTimeFields
                          value={field.value}
                          onChange={field.onChange}
                          dateTestId="input-event-date"
                          timeTestId="input-event-time"
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
                        <DateTimeFields
                          value={field.value}
                          onChange={field.onChange}
                          invalid={!!teardownBeforeEvent}
                          dateTestId="input-teardown-date"
                          timeTestId="input-teardown-time"
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
                  A montagem não pode ocorrer depois do evento.
                </div>
              )}
              {teardownBeforeEvent && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  A desmontagem não pode ocorrer antes do evento.
                </div>
              )}

              {/* ── C. Janela de Requisição ────────────────────────── */}
              <SectionLabel>Janela de Requisição</SectionLabel>

              <p className="text-xs text-muted-foreground -mt-1">
                Defina quando materiais poderão ser requisitados. Deixe vazio para não
                restringir por data.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0 [&>*]:min-w-0">
                <FormField
                  control={form.control}
                  name="requestWindowStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início da Janela</FormLabel>
                      <FormControl>
                        <DateTimeFields
                          value={field.value}
                          onChange={field.onChange}
                          invalid={!!windowStartAfterEnd}
                          dateTestId="input-request-window-start"
                          timeTestId="input-request-window-start-time"
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
                        <DateTimeFields
                          value={field.value}
                          onChange={field.onChange}
                          invalid={!!windowStartAfterEnd}
                          dateTestId="input-request-window-end"
                          timeTestId="input-request-window-end-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Window shortcuts + live status */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyOpen7DaysBefore}
                  disabled={!eventBase}
                  data-testid="button-window-open-7d"
                >
                  Abrir 7 dias antes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyCloseDayBefore}
                  disabled={!eventBase}
                  data-testid="button-window-close-1d"
                >
                  Fechar 1 dia antes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyNoWindow}
                  data-testid="button-window-none"
                >
                  Sem janela
                </Button>

                {windowStartAfterEnd ? (
                  <span className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    O início da janela não pode ser depois do fim.
                  </span>
                ) : wsStart || wsEnd ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {windowStatus === "open" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                      >
                        Janela aberta
                      </Badge>
                    )}
                    {windowStatus === "future" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                      >
                        Janela futura
                      </Badge>
                    )}
                    {windowStatus === "closed" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground border-border/50"
                      >
                        Janela encerrada
                      </Badge>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Sem janela definida</span>
                )}
              </div>

              {/* ── D. Observações ─────────────────────────────────── */}
              <SectionLabel>Observações</SectionLabel>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Detalhes adicionais do evento..."
                        className="min-h-[72px] resize-none"
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Fixed footer */}
            <DialogFooter className="px-6 py-4 border-t border-border/40 shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="w-full sm:w-auto"
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending || hasBlockingError}
                className="w-full sm:w-auto"
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

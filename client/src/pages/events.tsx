import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Calendar,
  MapPin,
  Building2,
  Edit,
  Trash2,
  Search,
  X,
  Clock,
  CheckCircle2,
  CalendarRange,
  ClipboardList,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Event } from "@shared/schema";
import { EventDialog } from "@/components/event-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin } from "@/lib/authz";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WindowStatus = "open" | "future" | "closed" | "none";

function getWindowStatus(event: Event): WindowStatus {
  const now = new Date();
  const start = event.requestWindowStart ? new Date(event.requestWindowStart) : null;
  const end = event.requestWindowEnd ? new Date(event.requestWindowEnd) : null;
  if (!start && !end) return "none";
  if (start && now < start) return "future";
  if (end && now > end) return "closed";
  return "open";
}

function WindowBadge({ status }: { status: WindowStatus }) {
  if (status === "none") {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50">
        Sem janela definida
      </Badge>
    );
  }
  if (status === "open") {
    return (
      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
        Requisições abertas
      </Badge>
    );
  }
  if (status === "future") {
    return (
      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10">
        Janela futura
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50">
      Período encerrado
    </Badge>
  );
}

function fmtDate(val: string | Date | null | undefined) {
  if (!val) return "—";
  try {
    return format(new Date(val as string), "dd/MM/yy", { locale: ptBR });
  } catch {
    return "—";
  }
}

export default function Events() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const canWrite = userIsAdmin(user);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Event | undefined>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [windowFilter, setWindowFilter] = useState("all");
  // Date range over the event date (eventDate). Empty string = open-ended.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Evento excluído com sucesso." });
      setDeleteTarget(undefined);
    },
    onError: () => {
      toast({ title: "Erro ao excluir evento.", variant: "destructive" });
      setDeleteTarget(undefined);
    },
  });

  const handleEdit = (e: Event) => {
    setSelectedEvent(e);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedEvent(undefined);
    setShowDialog(false);
  };

  const uniqueStatuses = useMemo(() => {
    const s = new Set(events?.map((e) => e.status) || []);
    return Array.from(s);
  }, [events]);

  const activeFilters = [statusFilter !== "all", windowFilter !== "all", !!dateFrom, !!dateTo].filter(Boolean).length;
  const clearFilters = () => {
    setStatusFilter("all");
    setWindowFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const filtered = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      const q = search.toLowerCase();
      if (
        q &&
        !e.name.toLowerCase().includes(q) &&
        !e.client.toLowerCase().includes(q) &&
        !e.location.toLowerCase().includes(q) &&
        !(e.sku || "").toLowerCase().includes(q)
      )
        return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (windowFilter !== "all") {
        const ws = getWindowStatus(e);
        if (windowFilter === "open" && ws !== "open") return false;
        if (windowFilter === "future" && ws !== "future") return false;
        if (windowFilter === "closed" && ws !== "closed") return false;
      }
      // Date-range filter over the event date. Compare on the calendar day so a
      // "from" of the event's own day still matches regardless of time.
      if (dateFrom || dateTo) {
        if (!e.eventDate) return false;
        const eventDay = new Date(e.eventDate);
        eventDay.setHours(0, 0, 0, 0);
        if (dateFrom) {
          const from = new Date(dateFrom + "T00:00:00");
          if (eventDay < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo + "T00:00:00");
          if (eventDay > to) return false;
        }
      }
      return true;
    });
  }, [events, search, statusFilter, windowFilter, dateFrom, dateTo]);

  // Stats
  const totalEvents = events?.length || 0;
  const planning = events?.filter((e) => e.status === "planning").length || 0;
  const inProgress = events?.filter((e) => e.status === "in_progress").length || 0;
  const completed = events?.filter((e) => e.status === "completed").length || 0;
  const openWindow = events?.filter((e) => getWindowStatus(e) === "open").length || 0;

  if (isLoading) return <PageLoading message="Carregando eventos..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Gerencie cronogramas, janelas de requisição e logística de eventos"
      >
        {canWrite && (
          <Button onClick={() => setShowDialog(true)} data-testid="button-create-event">
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        )}
      </PageHeader>

      {/* ── Stats chips ─────────────────────────────────────────── */}
      {totalEvents > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "Total", count: totalEvents, icon: ClipboardList },
            { id: "planning", label: "Planejamento", count: planning, icon: Clock },
            { id: "in_progress", label: "Em andamento", count: inProgress, icon: CheckCircle2 },
            { id: "completed", label: "Encerrados", count: completed, icon: CalendarRange },
          ].map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id === "all" ? "all" : statusFilter === id ? "all" : id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover-elevate transition-colors ${
                statusFilter === id
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border/60 text-muted-foreground"
              }`}
              data-testid={`stat-${id}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold tabular-nums">{count}</span>
              <span className="text-xs">{label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setWindowFilter(windowFilter === "open" ? "all" : "open")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover-elevate transition-colors ${
              windowFilter === "open"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "bg-card border-border/60 text-muted-foreground"
            }`}
            data-testid="stat-window-open"
          >
            <CalendarRange className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold tabular-nums">{openWindow}</span>
            <span className="text-xs">Janela aberta</span>
          </button>
        </div>
      )}

      {/* ── Search ──────────────────────────────────────────────── */}
      {totalEvents > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cliente, local ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-10"
            data-testid="input-search"
          />
          {search && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────── */}
      {totalEvents > 0 && (
        <FilterBar
          badgeCount={activeFilters}
          onClear={activeFilters > 0 ? clearFilters : undefined}
          defaultOpen={false}
        >
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="planning">Planejamento</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Janela de Requisição</Label>
            <Select value={windowFilter} onValueChange={setWindowFilter}>
              <SelectTrigger data-testid="filter-window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer situação</SelectItem>
                <SelectItem value="open">Requisições abertas</SelectItem>
                <SelectItem value="future">Janela futura</SelectItem>
                <SelectItem value="closed">Período encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data do evento — de</Label>
            <Input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="filter-date-from"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data do evento — até</Label>
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="filter-date-to"
            />
          </div>
        </FilterBar>
      )}

      {/* ── Content ─────────────────────────────────────────────── */}
      {totalEvents === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nenhum evento cadastrado"
          description="Crie eventos para organizar requisições, carregamentos e movimentações."
          action={canWrite ? { label: "Novo Evento", onClick: () => setShowDialog(true) } : undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum evento encontrado"
          description="Tente ajustar a busca ou limpar os filtros."
          action={{ label: "Limpar filtros", onClick: () => { setSearch(""); clearFilters(); } }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => {
            const ws = getWindowStatus(event);
            return (
              <Card
                key={event.id}
                className="border-border/60 flex flex-col hover-elevate cursor-pointer"
                data-testid={`card-event-${event.id}`}
                onClick={() => navigate(`/events/${event.id}`)}
              >
                <CardContent className="p-4 flex flex-col flex-1">
                  {/* Status + edit button */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={event.status} />
                      {event.sku && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {event.sku}
                        </span>
                      )}
                    </div>
                    {canWrite && (
                      <div className="flex items-center gap-1 -mr-1 -mt-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleEdit(event); }}
                          data-testid={`button-edit-event-${event.id}`}
                          aria-label={`Editar ${event.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(event); }}
                          data-testid={`button-delete-event-${event.id}`}
                          aria-label={`Excluir ${event.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Event name */}
                  <h3 className="font-semibold text-base text-foreground leading-snug mb-1">
                    {event.name}
                  </h3>

                  {/* Client + Location */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{event.client}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>

                  {/* Mini timeline */}
                  <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 gap-1 text-center">
                    {[
                      { label: "Montagem", date: event.setupDate },
                      { label: "Evento", date: event.eventDate, primary: true },
                      { label: "Desmontagem", date: event.teardownDate },
                    ].map(({ label, date, primary }) => (
                      <div key={label}>
                        <p className={`text-[10px] uppercase tracking-wide font-medium ${primary ? "text-primary" : "text-muted-foreground"}`}>
                          {label}
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${primary ? "text-foreground" : "text-muted-foreground"}`}>
                          {fmtDate(date)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Request window */}
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <WindowBadge status={ws} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EventDialog open={showDialog} onOpenChange={handleClose} event={selectedEvent} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(undefined); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O evento{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>{" "}
              e todos os dados relacionados serão permanentemente excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { EventFilterCombobox } from "@/components/event-filter-combobox";
import { FilterBar } from "@/components/filter-bar";
import { StatusBadge } from "@/components/status-badge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type MaterialRequest = {
  id: string;
  eventId: string;
  area: string;
  status: string;
  requestedBy: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  event?: {
    id: string;
    name: string;
    client: string;
    eventDate: string;
  };
  requestedByUser?: {
    id: string;
    name: string;
    username: string;
  };
};

function fmtDate(iso: string, includeTime = false) {
  return format(
    new Date(iso),
    includeTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy",
    { locale: ptBR }
  );
}

export default function Approvals() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [requesterFilter, setRequesterFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const { data: requests = [], isLoading } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/requests"],
  });

  const uniqueEvents = useMemo(() => {
    const map = new Map<string, NonNullable<MaterialRequest["event"]>>();
    requests.forEach((r) => r.event && map.set(r.event.id, r.event));
    return Array.from(map.values());
  }, [requests]);

  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => r.event?.client && set.add(r.event.client));
    return Array.from(set);
  }, [requests]);

  const uniqueRequesters = useMemo(() => {
    const map = new Map<string, NonNullable<MaterialRequest["requestedByUser"]>>();
    requests.forEach((r) => r.requestedByUser && map.set(r.requestedByUser.id, r.requestedByUser));
    return Array.from(map.values());
  }, [requests]);

  const filteredRequests = useMemo(
    () =>
      requests.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (eventFilter !== "all" && r.eventId !== eventFilter) return false;
        if (requesterFilter !== "all" && r.requestedBy !== requesterFilter) return false;
        if (clientFilter !== "all" && r.event?.client !== clientFilter) return false;
        return true;
      }),
    [requests, statusFilter, eventFilter, requesterFilter, clientFilter]
  );

  const activeFiltersCount = [
    statusFilter !== "all",
    eventFilter !== "all",
    requesterFilter !== "all",
    clientFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("all");
    setEventFilter("all");
    setRequesterFilter("all");
    setClientFilter("all");
  };

  const pendingRequests = filteredRequests.filter(
    (r) => r.status === "pending_approval"
  );
  const processedRequests = filteredRequests
    .filter((r) => r.status === "approved" || r.status === "rejected")
    .sort((a, b) => {
      const da = a.approvedAt ? new Date(a.approvedAt).getTime() : 0;
      const db = b.approvedAt ? new Date(b.approvedAt).getTime() : 0;
      return db - da;
    });

  // Totals on the raw (unfiltered) data for the stat chips
  const totalPending = requests.filter((r) => r.status === "pending_approval").length;
  const totalApproved = requests.filter((r) => r.status === "approved").length;
  const totalRejected = requests.filter((r) => r.status === "rejected").length;

  if (isLoading) {
    return <PageLoading message="Carregando requisições..." />;
  }

  const noResults = filteredRequests.length === 0 && activeFiltersCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovação de Requisições"
        description="Gerencie aprovações de requisições de materiais"
      />

      {/* ── Stats / quick-filter chips ─────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            id: "all",
            label: "Total",
            count: requests.length,
            icon: ClipboardList,
            activeClass: "bg-primary/10 border-primary/30 text-primary",
          },
          {
            id: "pending_approval",
            label: "Pendentes",
            count: totalPending,
            icon: Clock,
            activeClass: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
          },
          {
            id: "approved",
            label: "Aprovados",
            count: totalApproved,
            icon: CheckCircle2,
            activeClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
          },
          {
            id: "rejected",
            label: "Rejeitados",
            count: totalRejected,
            icon: XCircle,
            activeClass: "bg-destructive/10 border-destructive/30 text-destructive",
          },
        ].map(({ id, label, count, icon: Icon, activeClass }) => {
          const active = statusFilter === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() =>
                setStatusFilter(id === "all" ? "all" : statusFilter === id ? "all" : id)
              }
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors hover-elevate ${
                active
                  ? activeClass
                  : "bg-card border-border/60 text-muted-foreground"
              }`}
              data-testid={`stat-${id === "pending_approval" ? "pending" : id}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold tabular-nums">{count}</span>
              <span className="text-xs">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <FilterBar
        badgeCount={activeFiltersCount}
        onClear={activeFiltersCount > 0 ? clearFilters : undefined}
        defaultOpen={false}
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending_approval">Pendente Aprovação</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Evento</Label>
          <EventFilterCombobox
            events={uniqueEvents}
            value={eventFilter === "all" ? "" : eventFilter}
            onValueChange={(v) => setEventFilter(v || "all")}
            data-testid="select-event-filter"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger data-testid="select-client-filter">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {uniqueClients.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Solicitante</Label>
          <Select value={requesterFilter} onValueChange={setRequesterFilter}>
            <SelectTrigger data-testid="select-requester-filter">
              <SelectValue placeholder="Todos os solicitantes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os solicitantes</SelectItem>
              {uniqueRequesters.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {/* ── No-results from filters ───────────────────────────────── */}
      {noResults && (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma aprovação encontrada"
          description="Nenhuma requisição corresponde aos filtros aplicados."
          action={{ label: "Limpar filtros", onClick: clearFilters }}
        />
      )}

      {/* ── Pendentes ─────────────────────────────────────────────── */}
      {!noResults && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            <h2 className="text-sm font-semibold text-foreground">Pendentes</h2>
            <Badge variant="secondary" className="text-xs">
              {pendingRequests.length}
            </Badge>
          </div>

          {pendingRequests.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nenhuma requisição pendente"
              description="Quando novas requisições forem enviadas para aprovação, elas aparecerão aqui."
              compact
            />
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <Card
                  key={request.id}
                  className="hover-elevate border-border/60 cursor-pointer"
                  onClick={() => navigate(`/approvals/${request.id}`)}
                  data-testid={`card-request-${request.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Left: status + id + name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <StatusBadge status={request.status} />
                          <span className="font-mono text-[11px] text-muted-foreground">
                            #{request.id.slice(0, 8)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-base text-foreground leading-snug">
                          {request.event?.name || "—"}
                        </h3>
                        {request.area && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {request.area}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    </div>

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40">
                      {request.event?.client && (
                        <span className="text-xs">
                          <span className="text-muted-foreground">Cliente:</span>{" "}
                          <span className="font-medium">{request.event.client}</span>
                        </span>
                      )}
                      <span className="text-xs">
                        <span className="text-muted-foreground">Solicitante:</span>{" "}
                        <span className="font-medium">
                          {request.requestedByUser?.name || "—"}
                        </span>
                      </span>
                      {request.submittedAt && (
                        <span className="text-xs">
                          <span className="text-muted-foreground">Enviado:</span>{" "}
                          <span className="font-medium">
                            {fmtDate(request.submittedAt, true)}
                          </span>
                        </span>
                      )}
                      {request.event?.eventDate && (
                        <span className="text-xs">
                          <span className="text-muted-foreground">Data do evento:</span>{" "}
                          <span className="font-medium">
                            {fmtDate(request.event.eventDate)}
                          </span>
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Processadas ───────────────────────────────────────────── */}
      {!noResults && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <h2 className="text-sm font-semibold text-foreground">Processadas</h2>
            <Badge variant="secondary" className="text-xs">
              {processedRequests.length}
            </Badge>
          </div>

          {processedRequests.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nenhuma requisição processada"
              description="Requisições aprovadas ou rejeitadas aparecerão aqui."
              compact
            />
          ) : (
            <div className="space-y-2">
              {processedRequests.map((request) => (
                <Card
                  key={request.id}
                  className="hover-elevate border-border/60 cursor-pointer"
                  onClick={() => navigate(`/approvals/${request.id}`)}
                  data-testid={`card-request-${request.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={request.status} />
                          <span className="font-semibold text-sm text-foreground truncate">
                            {request.event?.name || "—"}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                            #{request.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs">
                          {request.event?.client && (
                            <span className="text-muted-foreground">
                              {request.event.client}
                            </span>
                          )}
                          {request.area && (
                            <span className="text-muted-foreground">
                              {request.area}
                            </span>
                          )}
                          {request.approvedBy && (
                            <span className="text-muted-foreground">
                              por{" "}
                              <span className="text-foreground font-medium">
                                {request.approvedBy}
                              </span>
                            </span>
                          )}
                          {request.approvedAt && (
                            <span className="text-muted-foreground">
                              {fmtDate(request.approvedAt, true)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

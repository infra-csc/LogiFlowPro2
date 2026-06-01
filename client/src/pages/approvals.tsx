import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/filter-bar";
import { StatusBadge } from "@/components/status-badge";
import { CheckCircle2, XCircle, Clock, ChevronRight } from "lucide-react";
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

export default function Approvals() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [requesterFilter, setRequesterFilter] = useState<string>("all");

  const { data: requests = [], isLoading } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/requests"],
  });

  const uniqueEvents = useMemo(() => {
    const events = requests
      .map(r => r.event)
      .filter((e): e is NonNullable<typeof e> => !!e);
    const uniqueMap = new Map(events.map(e => [e.id, e]));
    return Array.from(uniqueMap.values());
  }, [requests]);

  const uniqueRequesters = useMemo(() => {
    const requesters = requests
      .map(r => r.requestedByUser)
      .filter((u): u is NonNullable<typeof u> => !!u);
    const uniqueMap = new Map(requesters.map(u => [u.id, u]));
    return Array.from(uniqueMap.values());
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (eventFilter !== "all" && r.eventId !== eventFilter) return false;
      if (requesterFilter !== "all" && r.requestedBy !== requesterFilter) return false;
      return true;
    });
  }, [requests, statusFilter, eventFilter, requesterFilter]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (eventFilter !== "all") count++;
    if (requesterFilter !== "all") count++;
    return count;
  }, [statusFilter, eventFilter, requesterFilter]);

  const clearFilters = () => {
    setStatusFilter("all");
    setEventFilter("all");
    setRequesterFilter("all");
  };

  const pendingRequests = filteredRequests.filter(r => r.status === "pending_approval");
  const processedRequests = filteredRequests
    .filter(r => r.status === "approved" || r.status === "rejected")
    .sort((a, b) => {
      const dateA = a.approvedAt ? new Date(a.approvedAt).getTime() : 0;
      const dateB = b.approvedAt ? new Date(b.approvedAt).getTime() : 0;
      return dateB - dateA;
    });

  const totalPending = requests.filter(r => r.status === "pending_approval").length;
  const totalApproved = requests.filter(r => r.status === "approved").length;
  const totalRejected = requests.filter(r => r.status === "rejected").length;

  if (isLoading) {
    return <PageLoading message="Carregando requisições..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovação de Requisições"
        description="Gerencie aprovações de requisições de materiais"
      />

      {/* Stats Bar — clickable filters */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setStatusFilter("all")}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors hover-elevate ${
            statusFilter === "all"
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-card border-border/60 text-muted-foreground"
          }`}
          data-testid="stat-all"
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">{requests.length}</span>
          <span className="text-xs">Total</span>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "pending_approval" ? "all" : "pending_approval")}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors hover-elevate ${
            statusFilter === "pending_approval"
              ? "bg-chart-3/10 border-chart-3/30 text-chart-3"
              : "bg-card border-border/60 text-muted-foreground"
          }`}
          data-testid="stat-pending"
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="font-medium">{totalPending}</span>
          <span className="text-xs">Pendentes</span>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "approved" ? "all" : "approved")}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors hover-elevate ${
            statusFilter === "approved"
              ? "bg-chart-4/10 border-chart-4/30 text-chart-4"
              : "bg-card border-border/60 text-muted-foreground"
          }`}
          data-testid="stat-approved"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="font-medium">{totalApproved}</span>
          <span className="text-xs">Aprovados</span>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === "rejected" ? "all" : "rejected")}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors hover-elevate ${
            statusFilter === "rejected"
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-card border-border/60 text-muted-foreground"
          }`}
          data-testid="stat-rejected"
        >
          <XCircle className="h-3.5 w-3.5" />
          <span className="font-medium">{totalRejected}</span>
          <span className="text-xs">Rejeitados</span>
        </button>
      </div>

      {/* Filters */}
      <FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearFilters : undefined}>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter" className="h-9 bg-card border-border/60 rounded-md text-sm">
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

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Evento</label>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger data-testid="select-event-filter" className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {uniqueEvents.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Solicitante</label>
          <Select value={requesterFilter} onValueChange={setRequesterFilter}>
            <SelectTrigger data-testid="select-requester-filter" className="h-9 bg-card border-border/60 rounded-md text-sm">
              <SelectValue placeholder="Todos os solicitantes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os solicitantes</SelectItem>
              {uniqueRequesters.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {/* Pending Approvals */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border/40">
          <Clock className="h-5 w-5 text-chart-3" />
          <h2 className="text-lg font-semibold">Pendentes</h2>
          <span className="text-xs text-muted-foreground">({pendingRequests.length})</span>
        </div>

        {pendingRequests.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nenhuma requisição pendente"
            description="Nenhuma requisição aguardando aprovação no momento"
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={request.status} />
                        <span className="text-xs text-muted-foreground font-mono">{request.id.slice(0, 8)}</span>
                      </div>
                      <h3 className="font-semibold text-base text-foreground mt-1">{request.event?.name}</h3>
                      {request.area && (
                        <p className="text-xs text-muted-foreground mt-0.5">{request.area}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground ml-2 flex-shrink-0 mt-1" />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Cliente:</span>{" "}
                      <span className="text-foreground font-medium">{request.event?.client || "—"}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Solicitante:</span>{" "}
                      <span className="text-foreground font-medium">{request.requestedByUser?.name || "—"}</span>
                    </div>
                    {request.submittedAt && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Enviado:</span>{" "}
                        <span className="text-foreground font-medium">{format(new Date(request.submittedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      </div>
                    )}
                    {request.event?.eventDate && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Data do evento:</span>{" "}
                        <span className="text-foreground font-medium">{format(new Date(request.event.eventDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <CheckCircle2 className="h-5 w-5 text-chart-4" />
            <h2 className="text-lg font-semibold">Processadas</h2>
            <span className="text-xs text-muted-foreground">({processedRequests.length})</span>
          </div>

          <div className="space-y-3">
            {processedRequests.map((request) => (
              <Card
                key={request.id}
                className="hover-elevate border-border/60 cursor-pointer"
                onClick={() => navigate(`/approvals/${request.id}`)}
                data-testid={`card-request-${request.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={request.status} />
                        <span className="text-xs text-muted-foreground font-mono">{request.id.slice(0, 8)}</span>
                      </div>
                      <h3 className="font-semibold text-base text-foreground mt-1">{request.event?.name}</h3>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground ml-2 flex-shrink-0 mt-1" />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Cliente:</span>{" "}
                      <span className="text-foreground font-medium">{request.event?.client || "—"}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Área:</span>{" "}
                      <span className="text-foreground font-medium">{request.area}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Aprovador:</span>{" "}
                      <span className="text-foreground font-medium">{request.approvedBy || "—"}</span>
                    </div>
                    {request.approvedAt && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Processado:</span>{" "}
                        <span className="text-foreground font-medium">{format(new Date(request.approvedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

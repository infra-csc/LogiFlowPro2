import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/filter-bar";
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

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, { label: string; className: string }> = {
    pending_approval: { label: "Pendente Aprovação", className: "bg-chart-3 text-white" },
    approved: { label: "Aprovado", className: "bg-chart-4 text-white" },
    rejected: { label: "Rejeitado", className: "bg-destructive text-destructive-foreground" },
  };

  const config = variants[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge className={config.className} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
};

export default function Approvals() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [requesterFilter, setRequesterFilter] = useState<string>("all");

  const { data: requests = [], isLoading } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/requests"],
  });

  // Extract unique values for filters
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

  // Apply filters
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

  // Filter only pending approval requests
  const pendingRequests = filteredRequests.filter(r => r.status === "pending_approval");
  const processedRequests = filteredRequests
    .filter(r => r.status === "approved" || r.status === "rejected")
    .sort((a, b) => {
      const dateA = a.approvedAt ? new Date(a.approvedAt).getTime() : 0;
      const dateB = b.approvedAt ? new Date(b.approvedAt).getTime() : 0;
      return dateB - dateA;
    });

  if (isLoading) {
    return (
      <PageLoading message="Carregando requisições..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovação de Requisições"
        description="Gerencie aprovações de requisições de materiais"
      />

      {/* Filters */}
      <FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearFilters : undefined}>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter" className="h-8 text-sm">
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
          <label className="text-xs text-muted-foreground">Evento</label>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger data-testid="select-event-filter" className="h-8 text-sm">
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

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Solicitante</label>
          <Select value={requesterFilter} onValueChange={setRequesterFilter}>
            <SelectTrigger data-testid="select-requester-filter" className="h-8 text-sm">
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
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-chart-3" />
          <h2 className="text-xl font-semibold">Pendentes ({pendingRequests.length})</h2>
        </div>

        {pendingRequests.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nenhuma requisição pendente"
            description="Nenhuma requisição aguardando aprovação no momento"
          />
        ) : (
          <div className="grid gap-4">
            {pendingRequests.map((request) => (
              <Card
                key={request.id}
                className="hover-elevate cursor-pointer"
                onClick={() => navigate(`/approvals/${request.id}`)}
                data-testid={`card-request-${request.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={request.status} />
                        <h3 className="font-semibold text-base">{request.event?.name}</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 pt-2 border-t border-border/40 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">Cliente</span>
                          <p className="font-medium">{request.event?.client}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Área</span>
                          <p className="font-medium">{request.area}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Solicitante</span>
                          <p className="font-medium">{request.requestedByUser?.name || "Usuário não encontrado"}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {request.submittedAt && (
                          <span>Enviado em {format(new Date(request.submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        )}
                        {request.event?.eventDate && (
                          <span>Evento: {format(new Date(request.event.eventDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground ml-3 flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-chart-4" />
            <h2 className="text-xl font-semibold">Processadas ({processedRequests.length})</h2>
          </div>

          <div className="grid gap-4">
            {processedRequests.map((request) => (
              <Card
                key={request.id}
                className="hover-elevate cursor-pointer opacity-80"
                onClick={() => navigate(`/approvals/${request.id}`)}
                data-testid={`card-request-${request.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={request.status} />
                        <h3 className="font-semibold text-base">{request.event?.name}</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 pt-2 border-t border-border/40 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">Cliente</span>
                          <p className="font-medium">{request.event?.client}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Área</span>
                          <p className="font-medium">{request.area}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Aprovador</span>
                          <p className="font-medium">{request.approvedBy || "-"}</p>
                        </div>
                      </div>

                      {request.approvedAt && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Processado em {format(new Date(request.approvedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground ml-3 flex-shrink-0 mt-1" />
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

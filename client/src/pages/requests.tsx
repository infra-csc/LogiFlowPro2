import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, User, CalendarDays, ClipboardList, CheckCircle2, Clock, XCircle, Lock } from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import type { MaterialRequest as BaseMaterialRequest, Event } from "@shared/schema";
import { RequestDialog } from "@/components/request-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventFilterCombobox } from "@/components/event-filter-combobox";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { StatusBadge } from "@/components/status-badge";

const statusFilterIcon: Record<string, React.ElementType> = {
  draft: Clock,
  pending_approval: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  cutoff_locked: Lock,
};

type MaterialRequest = BaseMaterialRequest & {
  event?: Event;
  requestedByUser?: {
    id: string;
    name: string;
    username: string;
  };
};

export default function Requests() {
  const [, navigate] = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");

  const { user } = useAuth();

  const { data: requests, isLoading } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/requests"],
  });

  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const handleEdit = (request: MaterialRequest) => {
    navigate(`/requests/${request.id}`);
  };

  const handleClose = () => {
    setSelectedRequest(undefined);
    setShowDialog(false);
  };

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    const filtered = requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesEvent = eventFilter === "all" || request.eventId === eventFilter;
      return matchesStatus && matchesEvent;
    });
    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, statusFilter, eventFilter]);

  // Group requisitions under their event — one event, its requisitions listed
  // inside — and render as a list rather than a grid of cards.
  const groupedByEvent = useMemo(() => {
    const groups = new Map<string, { eventName: string; requests: typeof filteredRequests }>();
    for (const r of filteredRequests) {
      const key = r.eventId || "__none__";
      if (!groups.has(key)) {
        groups.set(key, { eventName: r.event?.name || "Evento não vinculado", requests: [] });
      }
      groups.get(key)!.requests.push(r);
    }
    return Array.from(groups.values());
  }, [filteredRequests]);

  const stats = useMemo(() => {
    if (!requests) return { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 };
    return {
      draft: requests.filter((r) => r.status === "draft").length,
      pending: requests.filter((r) => r.status === "pending_approval").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
      total: requests.length,
    };
  }, [requests]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (eventFilter !== "all") count++;
    return count;
  }, [statusFilter, eventFilter]);

  const clearFilters = () => {
    setStatusFilter("all");
    setEventFilter("all");
  };

  const formatDate = (date: string | Date | undefined | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd MMM, yyyy '•' HH:mm");
  };

  const getDateLabel = (status: string) => {
    switch (status) {
      case "approved": return "Aprovado";
      case "rejected": return "Rejeitado";
      case "pending_approval": return "Enviado";
      default: return "Criado";
    }
  };

  const getDateValue = (request: MaterialRequest) => {
    switch (request.status) {
      case "approved":
      case "rejected":
        return request.approvedAt;
      case "pending_approval":
        return request.submittedAt;
      default:
        return request.createdAt;
    }
  };

  const numericIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!requests) return map;
    const sorted = [...requests].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    sorted.forEach((req, index) => {
      map.set(req.id, String(index + 1).padStart(3, "0"));
    });
    return map;
  }, [requests]);

  if (isLoading) {
    return <PageLoading message="Carregando requisições..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requisição de Materiais"
        description="Gerencie requisições de materiais para seus eventos"
      >
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-request">
          <Plus className="h-4 w-4 mr-2" />
          Nova Requisição
        </Button>
      </PageHeader>

      {/* Stats bar */}
      {requests && requests.length > 0 && (
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
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="font-medium">{stats.total}</span>
            <span className="text-xs">Total</span>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "draft" ? "all" : "draft")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors hover-elevate ${
              statusFilter === "draft"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border/60 text-muted-foreground"
            }`}
            data-testid="stat-draft"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">{stats.draft}</span>
            <span className="text-xs">Rascunho</span>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "pending_approval" ? "all" : "pending_approval")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors hover-elevate ${
              statusFilter === "pending_approval"
                ? "bg-chart-5/10 border-chart-5/30 text-chart-5"
                : "bg-card border-border/60 text-muted-foreground"
            }`}
            data-testid="stat-pending"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">{stats.pending}</span>
            <span className="text-xs">Pendente</span>
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
            <span className="font-medium">{stats.approved}</span>
            <span className="text-xs">Aprovado</span>
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
            <span className="font-medium">{stats.rejected}</span>
            <span className="text-xs">Rejeitado</span>
          </button>
        </div>
      )}

      {/* Filtros */}
      {requests && requests.length > 0 && (
        <FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearFilters : undefined} defaultOpen>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter" className="h-9 bg-card border-border/60 rounded-md text-sm">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="pending_approval">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="cutoff_locked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Evento</label>
            <EventFilterCombobox
              events={events ?? []}
              value={eventFilter === "all" ? "" : eventFilter}
              onValueChange={(v) => setEventFilter(v || "all")}
              data-testid="select-event-filter"
            />
          </div>
        </FilterBar>
      )}

      {/* Contador */}
      {filteredRequests.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filteredRequests.length} requisiç{filteredRequests.length > 1 ? "ões" : "ão"} encontrada{filteredRequests.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Lista vazia */}
      {!requests || requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma requisição ainda"
          description="Crie requisições de materiais para seus eventos. Cada requisição começa como rascunho e pode ser enviada para aprovação."
          action={{ label: "Nova Requisição", onClick: () => setShowDialog(true) }}
        />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma requisição encontrada"
          description="Ajuste os filtros para ver mais requisições."
          action={{ label: "Limpar Filtros", onClick: clearFilters }}
        />
      ) : (
        <div className="space-y-6">
          {groupedByEvent.map((group) => (
            <div key={group.eventName} data-testid={`event-group-${group.eventName}`}>
              {/* Event header — the requisitions of this event are listed below */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <h3 className="font-semibold text-sm text-foreground truncate">{group.eventName}</h3>
                <span className="text-xs text-muted-foreground shrink-0">
                  {group.requests.length} {group.requests.length === 1 ? "requisição" : "requisições"}
                </span>
              </div>

              <Card className="border-border/60 overflow-hidden">
                <div className="divide-y divide-border/40">
                  {group.requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 px-4 py-3 hover-elevate"
                      data-testid={`row-request-${request.id}`}
                    >
                      <span className="text-[10px] font-medium text-primary font-mono w-16 shrink-0">
                        REQ-{numericIdMap.get(request.id) || request.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="font-medium text-sm text-foreground truncate flex-1 min-w-0">
                        {request.area}
                      </span>
                      <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[8rem]">{request.requestedByUser?.name || "Usuário"}</span>
                      </div>
                      <span className="hidden md:inline text-xs text-muted-foreground shrink-0 w-28 text-right">
                        {formatDate(getDateValue(request))}
                      </span>
                      <div className="shrink-0">
                        <StatusBadge status={request.status} />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(request)}
                        data-testid={`button-view-request-${request.id}`}
                        className="shrink-0"
                      >
                        <Eye className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">Detalhes</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      <RequestDialog
        open={showDialog}
        onOpenChange={handleClose}
        request={selectedRequest}
      />
    </div>
  );
}

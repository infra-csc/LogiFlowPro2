import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Eye, User, CalendarDays, Layers, ClipboardList } from "lucide-react";
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
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";

// Status color mapping for left border strips
const statusStripColor: Record<string, string> = {
  draft: "bg-primary",
  pending_approval: "bg-chart-5",
  approved: "bg-chart-4",
  rejected: "bg-destructive",
  cutoff_locked: "bg-chart-3",
};

// Status dot color for badge
const statusDotColor: Record<string, string> = {
  draft: "bg-primary",
  pending_approval: "bg-chart-5",
  approved: "bg-chart-4",
  rejected: "bg-destructive",
  cutoff_locked: "bg-chart-3",
};

// Status label
const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  pending_approval: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cutoff_locked: "Bloqueado",
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

  // Backend agora filtra por usuario; o front filtra apenas por status/evento
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesEvent = eventFilter === "all" || request.eventId === eventFilter;
      return matchesStatus && matchesEvent;
    });
  }, [requests, statusFilter, eventFilter]);

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

  if (isLoading) {
    return <PageLoading message="Carregando requisicoes..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requisicao de Materiais"
        description="Gerencie requisicoes de materiais para seus eventos"
      >
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-request">
          <Plus className="h-4 w-4 mr-2" />
          Nova Requisicao
        </Button>
      </PageHeader>

      {/* Filtros */}
      {requests && requests.length > 0 && (
        <FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearFilters : undefined}>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter" className="h-8 text-sm">
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
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Evento</label>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger data-testid="select-event-filter" className="h-8 text-sm">
                <SelectValue placeholder="Todos os eventos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                {events?.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>
      )}

      {/* Contador */}
      {filteredRequests.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filteredRequests.length} requisicao{filteredRequests.length > 1 ? "es" : ""} encontrada{filteredRequests.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Lista vazia */}
      {!requests || requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma requisicao ainda"
          description="Crie requisicoes de materiais para seus eventos. Cada requisicao comeca como rascunho e pode ser enviada para aprovacao."
          action={{ label: "Nova Requisicao", onClick: () => setShowDialog(true) }}
        />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma requisicao encontrada"
          description="Ajuste os filtros para ver mais requisicoes."
          action={{ label: "Limpar Filtros", onClick: clearFilters }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRequests.map((request) => {
            const stripColor = statusStripColor[request.status] || "bg-muted";
            const dotColor = statusDotColor[request.status] || "bg-muted";
            const sLabel = statusLabel[request.status] || request.status;

            return (
              <Card
                key={request.id}
                className="group border-border/60 overflow-hidden relative hover-elevate"
                data-testid={`card-request-${request.id}`}
              >
                {/* Left status strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripColor}`} />

                <CardContent className="p-5 pl-6">
                  {/* Header: ID + Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-primary font-mono mb-1">
                        {request.id.slice(0, 8).toUpperCase()}
                      </span>
                      <h3 className="font-semibold text-base text-foreground truncate">
                        {request.area}
                      </h3>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shrink-0"
                      style={{
                        backgroundColor: "hsl(var(--muted) / 0.5)",
                        borderColor: "hsl(var(--border) / 0.5)",
                      }}
                    >
                      <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
                      {sLabel}
                    </span>
                  </div>

                  {/* Event subtitle */}
                  <p className="text-sm text-muted-foreground truncate mb-4">
                    {request.event?.name || "Evento nao vinculado"}
                  </p>

                  {/* Metadata grid: 2x2 with icon containers */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">
                          Requisitante
                        </p>
                        <p className="text-sm text-foreground truncate">
                          {request.requestedByUser?.name || "Usuario"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">
                          {getDateLabel(request.status)}
                        </p>
                        <p className="text-sm text-foreground truncate">
                          {formatDate(getDateValue(request))}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">
                          Evento
                        </p>
                        <p className="text-sm text-foreground truncate">
                          {request.event?.name || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">
                          Status
                        </p>
                        <p className="text-sm text-foreground truncate">
                          {sLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divider + Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {request.requestedByUser?.name?.charAt(0) || "U"}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {request.requestedByUser?.name || "Usuario"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(request)}
                      data-testid={`button-view-request-${request.id}`}
                      className="text-primary"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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

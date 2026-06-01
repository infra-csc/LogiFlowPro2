import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, Eye } from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
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
import { PageSection } from "@/components/page-section";

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
    return format(new Date(date), "dd/MM/yyyy 'as' HH:mm");
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredRequests.map((request) => (
            <Card
              key={request.id}
              className="hover-elevate border-border/60"
              data-testid={`card-request-${request.id}`}
            >
              <CardContent className="p-4">
                {/* Header: status + id + data */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={request.status} />
                    <span className="text-xs text-muted-foreground font-mono">
                      {request.id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(getDateValue(request))}
                  </span>
                </div>

                {/* Titulo */}
                <h3 className="font-semibold text-base text-foreground truncate">
                  {request.area}
                </h3>

                {/* Evento */}
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {request.event?.name || "Evento nao vinculado"}
                </p>

                {/* Metadados */}
                <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Solicitante</span>
                    <p className="font-medium text-foreground truncate">
                      {request.requestedByUser?.name || "Usuario"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Evento</span>
                    <p className="font-medium text-foreground truncate">
                      {request.event?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{getDateLabel(request.status)}</span>
                    <p className="font-medium text-foreground">
                      {formatDate(getDateValue(request))}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p className="font-medium text-foreground">
                      <StatusBadge status={request.status} />
                    </p>
                  </div>
                </div>

                {/* Acoes */}
                <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(request)}
                    data-testid={`button-view-request-${request.id}`}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
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

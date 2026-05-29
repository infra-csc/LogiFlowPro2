import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";
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

  // Filtrar requisições - sempre mostra apenas requisições do próprio usuário
  const filteredRequests = useMemo(() => {
    if (!requests || !user) return [];
    
    return requests.filter((request) => {
      // Mostra apenas requisições do próprio usuário
      if (request.requestedBy !== user.id) {
        return false;
      }
      
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesEvent = eventFilter === "all" || request.eventId === eventFilter;
      return matchesStatus && matchesEvent;
    });
  }, [requests, statusFilter, eventFilter, user]);

  // Contar filtros ativos
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

  if (isLoading) {
    return (
      <PageLoading message="Carregando requisições..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requisição de Materiais"
        description="Gerencie requisições de materiais para eventos"
      >
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-request">
          <Plus className="h-4 w-4 mr-2" />
          Nova Requisição
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

      {!requests || requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma requisição ainda"
          description="Crie requisições de materiais para seus eventos"
          action={{ label: "Nova Requisição", onClick: () => setShowDialog(true) }}
        />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={statusFilter === "all" && eventFilter === "all" ? "Você não possui requisições" : "Nenhuma requisição encontrada"}
          description={statusFilter === "all" && eventFilter === "all" ? "Crie sua primeira requisição de materiais" : "Ajuste os filtros para ver mais requisições"}
          action={statusFilter === "all" && eventFilter === "all" ? { label: "Nova Requisição", onClick: () => setShowDialog(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <Card
              key={request.id}
              className="hover-elevate cursor-pointer"
              onClick={() => handleEdit(request)}
              data-testid={`card-request-${request.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={request.status} />
                    </div>
                    <h3 className="font-semibold text-base text-foreground truncate">
                      {request.area}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {request.event?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1" data-testid={`text-requester-${request.id}`}>
                      Solicitado por: {request.requestedByUser?.name || "Usuário não encontrado"}
                    </p>
                    {request.status === "approved" && request.approvedAt && (
                      <p className="text-xs text-chart-4 mt-1">
                        Aprovado em {format(new Date(request.approvedAt), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    )}
                    {request.status === "rejected" && request.approvedAt && (
                      <p className="text-xs text-destructive mt-1">
                        Rejeitado em {format(new Date(request.approvedAt), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    )}
                  </div>
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

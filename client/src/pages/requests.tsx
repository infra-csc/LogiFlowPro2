import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import type { MaterialRequest as BaseMaterialRequest, Event } from "@shared/schema";
import { RequestDialog } from "@/components/request-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // Filtrar requisições
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    
    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesEvent = eventFilter === "all" || request.eventId === eventFilter;
      return matchesStatus && matchesEvent;
    });
  }, [requests, statusFilter, eventFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando requisições...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Requisição de Materiais</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie requisições de materiais para eventos</p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-request">
          <Plus className="h-4 w-4 mr-2" />
          Nova Requisição
        </Button>
      </div>

      {/* Filtros */}
      {requests && requests.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle className="text-base">Filtros</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-status-filter">
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
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Evento</label>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger data-testid="select-event-filter">
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
            </div>
          </CardContent>
        </Card>
      )}

      {!requests || requests.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma requisição ainda</h3>
              <p className="mt-2 text-sm text-muted-foreground">Crie requisições de materiais para seus eventos</p>
              <Button onClick={() => setShowDialog(true)} className="mt-4" data-testid="button-create-first-request">
                <Plus className="h-4 w-4 mr-2" />
                Nova Requisição
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma requisição encontrada</h3>
              <p className="mt-2 text-sm text-muted-foreground">Ajuste os filtros para ver mais requisições</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <Card 
              key={request.id}
              className="hover-elevate cursor-pointer"
              onClick={() => handleEdit(request)}
              data-testid={`card-request-${request.id}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-medium truncate">
                      {request.area}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {request.event?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1" data-testid={`text-requester-${request.id}`}>
                      Solicitado por: {request.requestedByUser?.name || "Usuário não encontrado"}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              </CardHeader>
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

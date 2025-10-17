import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const { data: requests = [], isLoading } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/requests"],
  });

  // Filter only pending approval requests
  const pendingRequests = requests.filter(r => r.status === "pending_approval");
  const processedRequests = requests.filter(r => r.status === "approved" || r.status === "rejected");

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Aprovação de Requisições</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie aprovações de requisições de materiais
        </p>
      </div>

      {/* Pending Approvals */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-chart-3" />
          <h2 className="text-xl font-semibold">Pendentes ({pendingRequests.length})</h2>
        </div>

        {pendingRequests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma requisição pendente de aprovação</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingRequests.map((request) => (
              <Card
                key={request.id}
                className="hover-elevate cursor-pointer"
                onClick={() => navigate(`/approvals/${request.id}`)}
                data-testid={`card-request-${request.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={request.status} />
                        <h3 className="font-semibold">{request.event?.name}</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Cliente:</span>
                          <p className="font-medium">{request.event?.client}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Área:</span>
                          <p className="font-medium">{request.area}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Solicitante:</span>
                          <p className="font-medium">{request.requestedBy}</p>
                        </div>
                      </div>

                      {request.submittedAt && (
                        <div className="text-sm text-muted-foreground">
                          Enviado em {format(new Date(request.submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      )}

                      {request.event?.eventDate && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Data do evento:</span>{" "}
                          <span className="font-medium">
                            {format(new Date(request.event.eventDate), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground ml-4" />
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
            {processedRequests.slice(0, 5).map((request) => (
              <Card
                key={request.id}
                className="hover-elevate cursor-pointer opacity-80"
                onClick={() => navigate(`/approvals/${request.id}`)}
                data-testid={`card-request-${request.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={request.status} />
                        <h3 className="font-semibold">{request.event?.name}</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Cliente:</span>
                          <p className="font-medium">{request.event?.client}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Área:</span>
                          <p className="font-medium">{request.area}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Aprovador:</span>
                          <p className="font-medium">{request.approvedBy || "-"}</p>
                        </div>
                      </div>

                      {request.approvedAt && (
                        <div className="text-sm text-muted-foreground">
                          Processado em {format(new Date(request.approvedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground ml-4" />
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

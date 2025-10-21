import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Truck, PlayCircle, PauseCircle, CheckCircle2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import type { Movement, LoadingOrder, Event, Dock } from "@shared/schema";

type MovementWithRelations = Movement & {
  loadingOrder?: LoadingOrder;
  event?: Event;
  dock?: Dock;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    created: "bg-chart-5 text-white",
    in_progress: "bg-primary text-primary-foreground",
    paused: "bg-chart-5 text-white",
    completed: "bg-chart-4 text-white",
    cancelled: "bg-destructive text-destructive-foreground",
  };
  return colors[status] || "bg-muted text-muted-foreground";
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    created: "Criada",
    in_progress: "Em Andamento",
    paused: "Pausada",
    completed: "Finalizada",
    cancelled: "Cancelada",
  };
  return labels[status] || status;
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    outbound_event: "Saída para Evento",
    inbound_event: "Retorno de Evento",
    inbound_purchase: "Entrada Produto Comprado",
    inbound_rental: "Entrada Produto Locado",
    outbound_rental_return: "Devolução Produto Locado",
    internal_transfer: "Transferência Interna",
    inventory_adjustment: "Ajuste de Inventário",
  };
  return labels[type] || type;
};

const formatDuration = (minutes?: number | null) => {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins}min`;
};

export default function Movements() {
  const [, navigate] = useLocation();
  const [filter] = useState("all");

  const { data: movements = [], isLoading } = useQuery<MovementWithRelations[]>({
    queryKey: ["/api/movements"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            🚛 Carga e Descarga
          </h1>
          <p className="text-muted-foreground">
            Gerencie movimentações operacionais do armazém
          </p>
        </div>
        <Button data-testid="button-new-movement">
          <Plus className="h-4 w-4 mr-2" />
          Nova Movimentação
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Badge variant={filter === "all" ? "default" : "outline"} className="cursor-pointer">
          Todas
        </Badge>
        <Badge variant={filter === "today" ? "default" : "outline"} className="cursor-pointer">
          Hoje
        </Badge>
      </div>

      {/* Lista de Movimentações */}
      <div className="space-y-4">
        {movements.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma movimentação encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie uma nova movimentação para começar
              </p>
            </CardContent>
          </Card>
        ) : (
          movements.map((movement) => (
            <Card key={movement.id} className="hover-elevate" data-testid={`card-movement-${movement.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(movement.status)}>
                        {getStatusLabel(movement.status)}
                      </Badge>
                      <h3 className="font-semibold text-lg" data-testid={`text-movement-name-${movement.id}`}>
                        {movement.movementNumber} | {movement.name}
                      </h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Tipo:</span> {getTypeLabel(movement.type)}
                      </div>
                      {movement.loadingOrder && (
                        <div>
                          <span className="font-medium">Ordem:</span> {movement.loadingOrder.orderNumber}
                        </div>
                      )}
                      {movement.vehiclePlate && (
                        <div>
                          <span className="font-medium">Veículo:</span> {movement.vehiclePlate}
                        </div>
                      )}
                      {movement.dock && (
                        <div>
                          <span className="font-medium">Doca:</span> {movement.dock.name}
                        </div>
                      )}
                      {movement.totalDuration && (
                        <div>
                          <span className="font-medium">Duração:</span> {formatDuration(movement.totalDuration)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {movement.status === "created" && (
                      <Button
                        size="sm"
                        data-testid={`button-start-${movement.id}`}
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Iniciar
                      </Button>
                    )}
                    {movement.status === "in_progress" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-pause-${movement.id}`}
                        >
                          <PauseCircle className="h-4 w-4 mr-1" />
                          Pausar
                        </Button>
                        <Button
                          size="sm"
                          data-testid={`button-finish-${movement.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Finalizar
                        </Button>
                      </>
                    )}
                    {movement.status === "paused" && (
                      <Button
                        size="sm"
                        data-testid={`button-continue-${movement.id}`}
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Continuar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/movements/${movement.id}`)}
                      data-testid={`button-details-${movement.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Detalhes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

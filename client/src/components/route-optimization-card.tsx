import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin, TrendingUp, AlertTriangle, Lightbulb, Fuel, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RouteOptimizationCardProps {
  tripId: string;
}

export function RouteOptimizationCard({ tripId }: RouteOptimizationCardProps) {
  const { toast } = useToast();

  // Fetch existing optimizations
  const { data: optimizations, isLoading } = useQuery<any[]>({
    queryKey: ["/api/trips", tripId, "route-optimizations"],
  });

  // Run optimization mutation
  const runOptimization = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/trips/${tripId}/optimize-route`, {});
    },
    onSuccess: () => {
      toast({
        title: "Otimização de rota concluída",
        description: "A sugestão de rota foi gerada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "route-optimizations"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao otimizar rota",
        description: error.message || "Ocorreu um erro ao executar a otimização",
      });
    },
  });

  const latestOptimization = optimizations?.[0];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Carregando...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={latestOptimization ? "border-primary/20" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Otimização de Rota com IA
            </CardTitle>
            <CardDescription className="mt-1">
              {latestOptimization 
                ? `Gerado em ${new Date(latestOptimization.run_created_at).toLocaleString("pt-BR")}`
                : "Obtenha sugestões inteligentes de roteamento para economizar tempo e combustível"
              }
            </CardDescription>
          </div>
          <Button
            data-testid="button-optimize-route"
            size="sm"
            onClick={() => runOptimization.mutate()}
            disabled={runOptimization.isPending}
          >
            {runOptimization.isPending ? "Processando..." : "Otimizar Rota"}
          </Button>
        </div>
      </CardHeader>

      {latestOptimization && (
        <CardContent className="space-y-4">
          {/* Confidence badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Confiabilidade da Sugestão</span>
            <Badge variant="default">{latestOptimization.confidence_score}%</Badge>
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                Distância Total
              </div>
              <div className="font-semibold text-lg">{latestOptimization.total_distance_km} km</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                Duração Estimada
              </div>
              <div className="font-semibold text-lg">
                {Math.floor(latestOptimization.estimated_duration_minutes / 60)}h {latestOptimization.estimated_duration_minutes % 60}min
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Fuel className="w-4 h-4" />
                Combustível Estimado
              </div>
              <div className="font-semibold text-lg">{latestOptimization.fuel_estimate_liters.toFixed(1)}L</div>
            </div>
          </div>

          {/* Warnings */}
          {latestOptimization.warnings && latestOptimization.warnings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Avisos
              </div>
              <div className="space-y-1">
                {latestOptimization.warnings.map((warning: string, idx: number) => (
                  <div key={idx} className="text-sm text-muted-foreground pl-6">
                    • {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {latestOptimization.recommendations && latestOptimization.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="w-4 h-4 text-primary" />
                Recomendações
              </div>
              <div className="space-y-1">
                {latestOptimization.recommendations.map((rec: string, idx: number) => (
                  <div key={idx} className="text-sm text-muted-foreground pl-6">
                    • {rec}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optimized route */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Rota Otimizada</div>
            <div className="border rounded-md p-3 space-y-2">
              {(latestOptimization.optimized_route || []).map((stop: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{stop.location}</div>
                    {stop.arrivalTime && (
                      <div className="text-xs text-muted-foreground">
                        Chegada prevista: {new Date(stop.arrivalTime).toLocaleString("pt-BR")}
                      </div>
                    )}
                    {stop.distanceFromPrevious && (
                      <div className="text-xs text-muted-foreground">
                        {stop.distanceFromPrevious.toFixed(1)} km do ponto anterior
                      </div>
                    )}
                  </div>
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}

      {!latestOptimization && (
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma otimização gerada ainda.</p>
            <p className="text-xs mt-1">Clique em "Otimizar Rota" para gerar uma sugestão.</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Package, TrendingUp, AlertTriangle, Lightbulb, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";

interface LoadingOptimizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadingOrderId: string;
}

export function LoadingOptimizationDialog({ open, onOpenChange, loadingOrderId }: LoadingOptimizationDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canRunOptimization = userCanWriteLogistics(user);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("");

  // Fetch vehicle types
  const { data: vehicleTypes } = useQuery<any[]>({
    queryKey: ["/api/vehicle-types"],
    enabled: open,
  });

  // Fetch existing optimizations
  const { data: optimizations, isLoading: loadingOptimizations } = useQuery<any[]>({
    queryKey: ["/api/loading-orders", loadingOrderId, "optimizations"],
    enabled: open,
  });

  // Run optimization mutation
  const runOptimization = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/loading-orders/${loadingOrderId}/optimize`, {
        vehicleTypeId: selectedVehicleType
      });
    },
    onSuccess: () => {
      toast({
        title: "Otimização concluída",
        description: "A sugestão de carregamento foi gerada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/loading-orders", loadingOrderId, "optimizations"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao otimizar",
        description: error.message || "Ocorreu um erro ao executar a otimização",
      });
    },
  });

  const latestOptimization = optimizations?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Otimização de Carregamento com IA
          </DialogTitle>
          <DialogDescription>
            Obtenha sugestões inteligentes de carregamento baseadas em dimensões reais e peso dos produtos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request new optimization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Solicitar Nova Otimização</CardTitle>
              <CardDescription>Selecione o tipo de veículo para gerar uma sugestão otimizada</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Select value={selectedVehicleType} onValueChange={setSelectedVehicleType}>
                    <SelectTrigger data-testid="select-vehicle-type">
                      <SelectValue placeholder="Selecione tipo de veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleTypes?.map((vt) => (
                        <SelectItem key={vt.id} value={vt.id}>
                          {vt.name} ({vt.cargoLength}m × {vt.cargoWidth}m × {vt.cargoHeight}m)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canRunOptimization && (
                  <Button
                    data-testid="button-run-optimization"
                    onClick={() => runOptimization.mutate()}
                    disabled={!selectedVehicleType || runOptimization.isPending}
                  >
                    {runOptimization.isPending ? (
                      <>Processando...</>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Otimizar
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Show latest optimization results */}
          {loadingOptimizations && <div className="text-center py-8 text-muted-foreground">Carregando...</div>}
          
          {!loadingOptimizations && latestOptimization && (
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Sugestão de Carregamento - {latestOptimization.vehicle_type_name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Gerado em {new Date(latestOptimization.run_created_at).toLocaleString("pt-BR")}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="text-sm">
                    {latestOptimization.confidence_score}% de confiança
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Key metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="w-4 h-4" />
                      Utilização do Espaço
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={latestOptimization.utilization_percentage} className="flex-1" />
                      <span className="font-semibold text-sm">{latestOptimization.utilization_percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="w-4 h-4" />
                      Distribuição de Peso
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={latestOptimization.weight_distribution_score} className="flex-1" />
                      <span className="font-semibold text-sm">{latestOptimization.weight_distribution_score.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Tempo Estimado
                    </div>
                    <div className="font-semibold">{latestOptimization.estimated_loading_time_minutes} min</div>
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

                {/* Loading sequence */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Sequência de Carregamento Sugerida</div>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2">#</th>
                          <th className="text-left p-2">Produto</th>
                          <th className="text-right p-2">Camada</th>
                          <th className="text-right p-2">Posição (X, Y)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(latestOptimization.loading_sequence || []).slice(0, 10).map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{idx + 1}</td>
                            <td className="p-2 font-medium">{item.productName}</td>
                            <td className="p-2 text-right">{item.layer}</td>
                            <td className="p-2 text-right font-mono text-xs">
                              ({item.position.x.toFixed(2)}, {item.position.y.toFixed(2)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(latestOptimization.loading_sequence || []).length > 10 && (
                      <div className="text-center text-xs text-muted-foreground p-2 bg-muted/30">
                        ... e mais {(latestOptimization.loading_sequence || []).length - 10} itens
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!loadingOptimizations && !latestOptimization && optimizations && optimizations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma otimização gerada ainda.</p>
              <p className="text-sm mt-1">Selecione um tipo de veículo acima para começar.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

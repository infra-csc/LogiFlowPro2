import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, AlertTriangle } from "lucide-react";
import type { Return, Trip, Product } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

interface ReturnWithRelations extends Return {
  trip?: Trip;
  product?: Product;
}

export default function Returns() {
  const { data: returns, isLoading } = useQuery<ReturnWithRelations[]>({
    queryKey: ["/api/returns"],
  });

  if (isLoading) {
    return (
      <PageLoading message="Carregando devoluções..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devoluções e Avarias"
        description="Acompanhe devoluções e relatórios de danos"
      />

      {!returns || returns.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="Nenhuma devolução registrada"
          description="As devoluções aparecerão aqui quando os planos de viagens forem concluídos"
        />
      ) : (
        <div className="space-y-4">
          {returns.map((returnItem) => {
            const hasDamage = (returnItem.damagedQuantity || 0) > 0;
            const hasLoss = (returnItem.lostQuantity || 0) > 0;
            const hasDiscrepancy = returnItem.returnedQuantity !== returnItem.expectedQuantity;

            return (
              <Card 
                key={returnItem.id}
                className="hover-elevate border-border/60"
                data-testid={`card-return-${returnItem.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <RotateCcw className="h-4 w-4 text-primary/70" />
                      </div>
                      <h3 className="font-semibold text-base text-foreground">{returnItem.product?.name || "Produto"}</h3>
                      {hasDiscrepancy && (
                        <AlertTriangle className="h-4 w-4 text-chart-5" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground ml-10">
                      {returnItem.product?.sku || "—"} | {format(new Date(returnItem.createdAt), "dd/MM/yyyy")}
                    </p>

                      <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Esperado</p>
                          <p className="text-sm font-medium">{returnItem.expectedQuantity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Devolvido</p>
                          <p className={`text-sm font-medium ${
                            hasDiscrepancy ? 'text-chart-5' : 'text-chart-4'
                          }`}>
                            {returnItem.returnedQuantity}
                          </p>
                        </div>
                        {hasDamage && (
                          <div>
                            <p className="text-xs text-muted-foreground">Avariado</p>
                            <p className="text-sm font-medium text-destructive">
                              {returnItem.damagedQuantity}
                            </p>
                          </div>
                        )}
                        {hasLoss && (
                          <div>
                            <p className="text-xs text-muted-foreground">Perdido</p>
                            <p className="text-sm font-medium text-destructive">
                              {returnItem.lostQuantity}
                            </p>
                          </div>
                        )}
                      </div>

                      {returnItem.damageDescription && (
                        <div className="mt-3 p-3 bg-destructive/10 rounded-md">
                          <p className="text-sm text-destructive-foreground">
                            {returnItem.damageDescription}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex flex-col gap-2">
                      {hasDamage && (
                        <Badge variant="outline" className="no-default-hover-elevate bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                          Avariado
                        </Badge>
                      )}
                      {hasLoss && (
                        <Badge variant="outline" className="no-default-hover-elevate bg-destructive/15 text-destructive border-destructive/30">
                          Perdido
                        </Badge>
                      )}
                      {hasDiscrepancy && !hasDamage && !hasLoss && (
                        <Badge variant="outline" className="no-default-hover-elevate text-muted-foreground">Discrepância</Badge>
                      )}
                      {!hasDamage && !hasLoss && !hasDiscrepancy && (
                        <Badge variant="outline" className="no-default-hover-elevate bg-chart-4/15 text-chart-4 border-chart-4/30">OK</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

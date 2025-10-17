import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, AlertTriangle } from "lucide-react";
import type { Return, Trip, Product } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando devoluções...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Devoluções e Avarias</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe devoluções e relatórios de danos</p>
      </div>

      {!returns || returns.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <RotateCcw className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma devolução registrada</h3>
              <p className="mt-2 text-sm text-muted-foreground">As devoluções aparecerão aqui quando as viagens forem concluídas</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {returns.map((returnItem) => {
            const hasDamage = (returnItem.damagedQuantity || 0) > 0;
            const hasLoss = (returnItem.lostQuantity || 0) > 0;
            const hasDiscrepancy = returnItem.returnedQuantity !== returnItem.expectedQuantity;

            return (
              <Card 
                key={returnItem.id}
                className="hover-elevate"
                data-testid={`card-return-${returnItem.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{returnItem.product?.name || "Product"}</h3>
                        {hasDiscrepancy && (
                          <AlertTriangle className="h-4 w-4 text-chart-5" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {returnItem.product?.sku || "—"} | {format(new Date(returnItem.createdAt), "MMM dd, yyyy")}
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                      {hasDamage && <Badge variant="destructive">Damaged</Badge>}
                      {hasLoss && <Badge variant="destructive">Loss</Badge>}
                      {hasDiscrepancy && !hasDamage && !hasLoss && (
                        <Badge className="bg-chart-5 text-white">Discrepancy</Badge>
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

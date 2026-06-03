import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import type { StockProjectionResult } from "@shared/stock-projection";

interface Props {
  result: StockProjectionResult;
}

const SOURCE_LABEL: Record<string, string> = {
  request: "Requisição",
  loading_order: "Ordem de carregamento",
  movement: "Movimentação",
  trip: "Viagem",
};

export function ProjectionConflicts({ result }: Props) {
  const errors = result.conflicts.filter((c) => c.severity === "error");
  const warnings = result.conflicts.filter((c) => c.severity === "warning");

  if (result.conflicts.length === 0) {
    return (
      <Card className="border-chart-4/40">
        <CardContent className="p-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-chart-4 flex-shrink-0" />
          <div>
            <p className="font-semibold text-base">Nenhum conflito detectado</p>
            <p className="text-sm text-muted-foreground">
              Todas as movimentações puderam ser datadas e não há saldo negativo previsto.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <Card className="border-destructive/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <p className="font-semibold text-base text-destructive">
                Conflitos ({errors.length})
              </p>
            </div>
            <div className="space-y-2">
              {errors.map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 border border-destructive/20 bg-destructive/5 rounded-md"
                  data-testid={`conflict-error-${idx}`}
                >
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {SOURCE_LABEL[c.source] || c.source}: {c.sourceLabel}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card className="border-chart-5/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-chart-5" />
              <p className="font-semibold text-base text-chart-5">Avisos ({warnings.length})</p>
            </div>
            <div className="space-y-2">
              {warnings.map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 border border-chart-5/20 bg-chart-5/5 rounded-md"
                  data-testid={`conflict-warning-${idx}`}
                >
                  <Info className="w-4 h-4 text-chart-5 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {SOURCE_LABEL[c.source] || c.source}: {c.sourceLabel}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

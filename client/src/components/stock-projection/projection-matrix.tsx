import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectionDayCell, ProjectionProduct, StockProjectionResult } from "@shared/stock-projection";
import {
  cellHeatClass,
  formatDay,
  isToday,
  isWeekend,
  statusBadgeClass,
  statusDotClass,
  statusLabel,
  weekdayShort,
} from "./projection-utils";

interface Props {
  result: StockProjectionResult;
  onOpenCell?: (product: ProjectionProduct, cell: ProjectionDayCell) => void;
  onOpenProduct?: (product: ProjectionProduct) => void;
}

function CellIndicators({ cell }: { cell: ProjectionDayCell }) {
  if (cell.outbound === 0 && cell.inbound === 0) return null;
  return (
    <span className="inline-flex items-center">
      {cell.outbound > 0 && <ArrowDown className="w-3 h-3 text-destructive" />}
      {cell.inbound > 0 && <ArrowUp className="w-3 h-3 text-chart-4" />}
    </span>
  );
}

export function ProjectionMatrix({ result, onOpenCell, onOpenProduct }: Props) {
  const { rangeDays, products } = result;

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum produto com movimentação no período selecionado.
      </p>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 border-b border-border/40 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${statusDotClass("ok")}`} /> Adequado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${statusDotClass("low")}`} /> Abaixo do mínimo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${statusDotClass("shortage")}`} /> Em falta
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowDown className="w-3 h-3 text-destructive" /> Saída
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="w-3 h-3 text-chart-4" /> Entrada
          </span>
          <span className="ml-auto hidden sm:inline">Clique numa célula para ver os detalhes</span>
        </div>

        <div className="overflow-auto max-h-[68vh] projection-scroll" style={{ scrollbarWidth: "thin" }}>
          <table className="w-full border-collapse text-sm" data-testid="table-projection-matrix">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border/60">
                <th className="sticky left-0 z-30 bg-card text-left font-semibold px-3 py-2 min-w-[210px]">
                  Produto
                </th>
                <th className="sticky left-[210px] z-30 bg-card text-right font-semibold px-2 py-2 whitespace-nowrap border-r border-border/60">
                  Atual
                </th>
                {rangeDays.map((d) => {
                  const today = isToday(d);
                  const weekend = isWeekend(d);
                  return (
                    <th
                      key={d}
                      className={`text-right px-2 py-1.5 whitespace-nowrap font-medium ${
                        today
                          ? "bg-primary/15 text-primary"
                          : weekend
                            ? "bg-muted/60 text-muted-foreground"
                            : "bg-card text-muted-foreground"
                      }`}
                    >
                      <div className="leading-none">{formatDay(d)}</div>
                      <div className="text-[10px] font-normal opacity-70 leading-none mt-0.5">{weekdayShort(d)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.productId}
                  className="border-b border-border/40 hover:bg-muted/20"
                  data-testid={`row-matrix-${p.productId}`}
                >
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top min-w-[210px]">
                    <button
                      className="flex items-start gap-2 text-left hover-elevate rounded -mx-1 px-1 py-0.5"
                      onClick={() => onOpenProduct?.(p)}
                      data-testid={`button-product-${p.productId}`}
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDotClass(p.worstStatus)}`} />
                      <span className="min-w-0">
                        <span className="font-medium leading-tight truncate block">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.sku} · mín. {p.minimumStock}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="sticky left-[210px] z-10 bg-card text-right px-2 py-2 tabular-nums text-muted-foreground border-r border-border/60">
                    {p.currentStock}
                  </td>
                  {p.days.map((c) => {
                    const weekend = isWeekend(c.date);
                    const hasImpact = c.outbound !== 0 || c.inbound !== 0;
                    const showDeficit = c.available < 0;
                    const content = (
                      <span className="inline-flex items-center justify-end gap-1">
                        <CellIndicators cell={c} />
                        <span>{c.available}</span>
                      </span>
                    );
                    return (
                      <td
                        key={c.date}
                        className={`text-right px-2 py-1.5 tabular-nums whitespace-nowrap ${cellHeatClass(
                          c.status,
                          hasImpact,
                        )} ${weekend && c.status === "ok" && !hasImpact ? "bg-muted/20" : ""} ${
                          showDeficit ? "text-destructive font-semibold" : ""
                        }`}
                        data-testid={`cell-${p.productId}-${c.date}`}
                      >
                        <button
                          className="hover-elevate rounded px-1 -mx-1 cursor-pointer w-full text-right"
                          onClick={() => onOpenCell?.(p, c)}
                          data-testid={`button-cell-${p.productId}-${c.date}`}
                        >
                          {content}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

import { useMemo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ProjectionDayCell,
  ProjectionProduct,
  StockProjectionResult,
} from "@shared/stock-projection";
import {
  cellHeatClass,
  statusDotClassExt,
  formatDay,
  isToday,
  isWeekend,
  statusDotClass,
  weekdayShort,
} from "./projection-utils";

interface Props {
  result: StockProjectionResult;
  onOpenCell?: (product: ProjectionProduct, cell: ProjectionDayCell) => void;
  onOpenProduct?: (product: ProjectionProduct) => void;
  /** Called when user clicks a day in the timeline strip. */
  onSelectDay?: (date: string) => void;
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

export function ProjectionMatrix({
  result,
  onOpenCell,
  onOpenProduct,
  onSelectDay,
}: Props) {
  const { rangeDays, products } = result;

  // Per-day aggregated totals for the timeline strip
  const dayTotals = useMemo(() => {
    return rangeDays.map((d, idx) => {
      let outbound = 0;
      let inbound = 0;
      let shortageCount = 0;
      let lowCount = 0;
      let inEventCount = 0;
      for (const p of products) {
        const cell = p.days[idx];
        if (!cell) continue;
        outbound += cell.outbound;
        inbound += cell.inbound;
        if (cell.status === "shortage") shortageCount++;
        else if (cell.status === "low") lowCount++;
        if (cell.inEvent > 0) inEventCount++;
      }
      return { date: d, outbound, inbound, shortageCount, lowCount, inEventCount };
    });
  }, [rangeDays, products]);

  const sortedProducts = useMemo(() => {
    const ORDER = { shortage: 0, low: 1, ok: 2 } as const;
    return [...products].sort((a, b) => {
      const statusDiff = ORDER[a.worstStatus] - ORDER[b.worstStatus];
      if (statusDiff !== 0) return statusDiff;
      return (b.totalOutbound + b.totalInbound) - (a.totalOutbound + a.totalInbound);
    });
  }, [products]);

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum produto com movimentação no período selecionado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Timeline strip ── */}
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Linha do tempo — impactos diários
            </p>
            <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ArrowDown className="w-3 h-3 text-destructive" /> Saída
              </span>
              <span className="inline-flex items-center gap-1">
                <ArrowUp className="w-3 h-3 text-chart-4" /> Entrada
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-destructive" /> Falta
              </span>
            </div>
          </div>
          <div
            className="overflow-x-auto projection-scroll pb-1"
            style={{ scrollbarWidth: "thin" }}
          >
            <div className="flex gap-1 min-w-min">
              {dayTotals.map((dt) => {
                const today = isToday(dt.date);
                const weekend = isWeekend(dt.date);
                const hasActivity = dt.outbound > 0 || dt.inbound > 0;
                const hasRisk = dt.shortageCount > 0 || dt.lowCount > 0;
                return (
                  <button
                    key={dt.date}
                    onClick={() => onSelectDay?.(dt.date)}
                    className={`flex flex-col items-center gap-0.5 flex-shrink-0 w-12 rounded-md px-1 py-1.5 text-center transition-colors hover-elevate ${
                      today
                        ? "ring-1 ring-primary/30 bg-muted/20"
                        : dt.shortageCount > 0
                          ? "bg-destructive/15"
                          : dt.lowCount > 0
                            ? "bg-chart-5/10"
                            : weekend
                              ? "bg-muted/40"
                              : hasActivity
                                ? "bg-muted/20"
                                : ""
                    }`}
                    title={[
                      formatDay(dt.date),
                      dt.outbound > 0 ? `Saídas: ${dt.outbound}` : null,
                      dt.inbound > 0 ? `Entradas: ${dt.inbound}` : null,
                      dt.shortageCount > 0 ? `Em falta: ${dt.shortageCount} produto(s)` : null,
                      dt.lowCount > 0 ? `Abaixo do mínimo: ${dt.lowCount} produto(s)` : null,
                      dt.inEventCount > 0 ? `Em evento: ${dt.inEventCount} produto(s)` : null,
                      !hasActivity && !hasRisk ? "Dia sem impacto" : null,
                    ].filter(Boolean).join(" · ")}
                    data-testid={`timeline-day-${dt.date}`}
                  >
                    <span
                      className={`text-[10px] font-medium leading-none ${
                        today
                          ? "text-primary"
                          : dt.shortageCount > 0
                            ? "text-destructive"
                            : dt.lowCount > 0
                              ? "text-chart-5"
                              : !hasActivity && !hasRisk
                                ? "text-muted-foreground/35"
                                : "text-muted-foreground"
                      }`}
                    >
                      {weekdayShort(dt.date)}
                    </span>
                    <span
                      className={`text-xs font-semibold leading-none mt-0.5 ${
                        today
                          ? "text-primary"
                          : dt.shortageCount > 0
                            ? "text-destructive font-bold"
                            : dt.lowCount > 0
                              ? "text-chart-5"
                              : !hasActivity && !hasRisk
                                ? "text-muted-foreground/40"
                                : "text-foreground"
                      }`}
                    >
                      {formatDay(dt.date)}
                    </span>

                    {/* Risk indicator — dot + count */}
                    {dt.shortageCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                        <span className="text-[9px] font-bold text-destructive leading-none">{dt.shortageCount}</span>
                      </span>
                    ) : dt.lowCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-chart-5 flex-shrink-0" />
                        <span className="text-[9px] font-bold text-chart-5 leading-none">{dt.lowCount}</span>
                      </span>
                    ) : dt.inEventCount > 0 ? (
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/50" />
                    ) : (
                      <span className="mt-1 h-3.5" />
                    )}

                    {/* Flow indicators */}
                    <span className="inline-flex items-center gap-0.5 mt-0.5">
                      {dt.outbound > 0
                        ? <ArrowDown className="w-2.5 h-2.5 text-destructive/70" />
                        : <span className="w-2.5" />}
                      {dt.inbound > 0
                        ? <ArrowUp className="w-2.5 h-2.5 text-chart-4/70" />
                        : <span className="w-2.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Heatmap matrix ── */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 border-b border-border/40 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${statusDotClass("ok")}`}
              />{" "}
              Adequado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${statusDotClass("low")}`}
              />{" "}
              Abaixo do mínimo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${statusDotClass("shortage")}`}
              />{" "}
              Em falta
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowDown className="w-3 h-3 text-destructive" /> Saída
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="w-3 h-3 text-chart-4" /> Entrada
            </span>
            <span className="ml-auto hidden sm:inline">
              Clique numa célula para ver os detalhes
            </span>
          </div>

          <div
            className="overflow-auto max-h-[68vh] projection-scroll"
            style={{ scrollbarWidth: "thin" }}
          >
            <table
              className="w-full border-collapse text-sm"
              data-testid="table-projection-matrix"
            >
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
                        <div className="text-[10px] font-normal opacity-70 leading-none mt-0.5">
                          {weekdayShort(d)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p) => (
                  <tr
                    key={p.productId}
                    className={`border-b border-border/40 hover:bg-muted/30 ${p.worstStatus === "shortage" ? "bg-destructive/5" : p.worstStatus === "low" ? "bg-chart-5/5" : ""}`}
                    data-testid={`row-matrix-${p.productId}`}
                  >
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top min-w-[210px]">
                      <button
                        className="flex items-start gap-2 text-left hover-elevate rounded -mx-1 px-1 py-0.5"
                        onClick={() => onOpenProduct?.(p)}
                        data-testid={`button-product-${p.productId}`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDotClassExt(p.worstStatus, p.currentStock, p.minimumStock, p.totalOutbound, p.totalInbound)}`}
                        />
                        <span className="min-w-0">
                          <span className="font-medium leading-tight truncate block">
                            {p.name}
                          </span>
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
                      const today = isToday(c.date);
                      const weekend = isWeekend(c.date);
                      const hasImpact = c.outbound !== 0 || c.inbound !== 0;
                      const showDeficit = c.available < 0;
                      return (
                        <td
                          key={c.date}
                          className={`text-right px-2 py-1.5 tabular-nums whitespace-nowrap ${cellHeatClass(
                            c.status,
                            hasImpact,
                            c.available,
                            p.minimumStock,
                          )} ${
                            weekend && c.status === "ok" && !hasImpact
                              ? "bg-muted/20"
                              : ""
                          } ${today ? "ring-1 ring-inset ring-primary/15" : ""} ${showDeficit ? "text-destructive font-bold" : ""}`}
                          data-testid={`cell-${p.productId}-${c.date}`}
                        >
                          <button
                            className="hover-elevate rounded px-1 -mx-1 cursor-pointer w-full text-right"
                            onClick={() => onOpenCell?.(p, c)}
                            data-testid={`button-cell-${p.productId}-${c.date}`}
                          >
                            <span className="inline-flex items-center justify-end gap-1">
                              <CellIndicators cell={c} />
                              <span>{c.available}</span>
                            </span>
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
    </div>
  );
}

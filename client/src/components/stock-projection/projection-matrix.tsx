import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProjectionDayCell, ProjectionProduct, StockProjectionResult } from "@shared/stock-projection";
import {
  cellToneClass,
  dayTrend,
  formatDay,
  isToday,
  isWeekend,
  sourceLabel,
  statusBadgeClass,
  statusLabel,
  weekdayShort,
} from "./projection-utils";

interface Props {
  result: StockProjectionResult;
}

function TrendGlyph({ outbound, inbound }: { outbound: number; inbound: number }) {
  const t = dayTrend(outbound, inbound);
  if (t === "down") return <ArrowDown className="w-3 h-3 text-destructive inline-block" />;
  if (t === "up") return <ArrowUp className="w-3 h-3 text-chart-4 inline-block" />;
  return <Minus className="w-3 h-3 text-muted-foreground/50 inline-block" />;
}

function CellPopover({ product, cell }: { product: ProjectionProduct; cell: ProjectionDayCell }) {
  const hasDelta = cell.outbound !== 0 || cell.inbound !== 0;
  return (
    <PopoverContent className="w-80 p-0" align="end" data-testid={`popover-cell-${product.productId}-${cell.date}`}>
      <div className="p-3 border-b border-border/60">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm truncate">{product.name}</p>
          <Badge className={`${statusBadgeClass(cell.status)} text-xs`}>{statusLabel(cell.status)}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {product.sku} · {formatDay(cell.date)}
        </p>
      </div>
      <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <span className="text-muted-foreground">Abertura</span>
        <span className="text-right tabular-nums">{cell.opening}</span>
        <span className="text-muted-foreground">Saída</span>
        <span className="text-right tabular-nums text-destructive">{cell.outbound > 0 ? `-${cell.outbound}` : "0"}</span>
        <span className="text-muted-foreground">Entrada</span>
        <span className="text-right tabular-nums text-chart-4">{cell.inbound > 0 ? `+${cell.inbound}` : "0"}</span>
        <span className="font-medium">Saldo</span>
        <span className="text-right tabular-nums font-semibold">{cell.available}</span>
        <span className="text-muted-foreground">Reservado</span>
        <span className="text-right tabular-nums">{cell.reserved}</span>
        <span className="text-muted-foreground">Em trânsito</span>
        <span className="text-right tabular-nums">{cell.inTransit}</span>
        <span className="text-muted-foreground">Em evento</span>
        <span className="text-right tabular-nums">{cell.inEvent}</span>
      </div>
      {hasDelta && (
        <div className="p-3 border-t border-border/60">
          <p className="text-xs font-medium text-muted-foreground mb-2">Origem do movimento</p>
          {cell.drivers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem detalhes de origem.</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {cell.drivers.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="truncate block">{d.label}</span>
                    <span className="text-muted-foreground">
                      {sourceLabel(d.source)}
                      {d.eventName ? ` · ${d.eventName}` : ""}
                    </span>
                  </div>
                  <span
                    className={`tabular-nums font-medium flex-shrink-0 ${
                      d.direction === "outbound" ? "text-destructive" : "text-chart-4"
                    }`}
                  >
                    {d.direction === "outbound" ? `-${d.qty}` : `+${d.qty}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PopoverContent>
  );
}

export function ProjectionMatrix({ result }: Props) {
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
        <div
          className="overflow-x-auto max-h-[70vh] overflow-y-auto projection-scroll"
          style={{ scrollbarWidth: "thin" }}
        >
          <table className="w-full border-collapse text-sm" data-testid="table-projection-matrix">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border/60">
                <th className="sticky left-0 z-30 bg-card text-left font-semibold px-3 py-2 min-w-[220px]">
                  Produto
                </th>
                <th className="bg-card text-right font-semibold px-2 py-2 whitespace-nowrap">Atual</th>
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
                  className="border-b border-border/40 hover:bg-muted/30"
                  data-testid={`row-matrix-${p.productId}`}
                >
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top min-w-[220px]">
                    <div className="flex items-start gap-2">
                      <Badge className={`${statusBadgeClass(p.worstStatus)} text-xs mt-0.5`}>
                        {statusLabel(p.worstStatus)}
                      </Badge>
                      <div className="min-w-0">
                        <div className="font-medium leading-tight truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku} · mín. {p.minimumStock} {p.unit}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-2 py-2 tabular-nums text-muted-foreground">{p.currentStock}</td>
                  {p.days.map((c) => {
                    const weekend = isWeekend(c.date);
                    const interactive = c.outbound !== 0 || c.inbound !== 0;
                    const content = (
                      <div className="inline-flex items-center justify-end gap-1">
                        {interactive && <TrendGlyph outbound={c.outbound} inbound={c.inbound} />}
                        <span>{c.available}</span>
                      </div>
                    );
                    return (
                      <td
                        key={c.date}
                        className={`text-right px-2 py-1.5 tabular-nums whitespace-nowrap ${cellToneClass(
                          c.status,
                        )} ${weekend && c.status === "ok" ? "bg-muted/30" : ""}`}
                        data-testid={`cell-${p.productId}-${c.date}`}
                      >
                        {interactive ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="hover-elevate rounded px-1 -mx-1 cursor-pointer"
                                data-testid={`button-cell-${p.productId}-${c.date}`}
                              >
                                {content}
                              </button>
                            </PopoverTrigger>
                            <CellPopover product={p} cell={c} />
                          </Popover>
                        ) : (
                          content
                        )}
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

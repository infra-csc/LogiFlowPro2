import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowDownUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ProjectionDayCell,
  ProjectionProduct,
  StockProjectionResult,
} from "@shared/stock-projection";
import {
  statusDotClassExt,
  formatDay,
  formatDayFull,
  isToday,
  isWeekend,
  weekdayShort,
} from "./projection-utils";

// ── Number formatting ─────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return Math.abs(n).toLocaleString("pt-BR");
}

// ── Sort ──────────────────────────────────────────────────────────────────────

type SortMode =
  | "default"
  | "nameAZ"
  | "nameZA"
  | "stockDesc"
  | "stockAsc"
  | "outboundDesc"
  | "inboundDesc"
  | "shortageFirst"
  | "lowFirst";

const SORT_LABELS: Record<SortMode, string> = {
  default: "Criticidade (padrão)",
  nameAZ: "Nome A–Z",
  nameZA: "Nome Z–A",
  stockDesc: "Maior estoque atual",
  stockAsc: "Menor estoque atual",
  outboundDesc: "Maior quantidade de saídas",
  inboundDesc: "Maior quantidade de entradas",
  shortageFirst: "Em falta primeiro",
  lowFirst: "Abaixo do mínimo primeiro",
};

function sortProducts(products: ProjectionProduct[], mode: SortMode): ProjectionProduct[] {
  const STATUS_ORDER = { shortage: 0, low: 1, ok: 2 } as const;
  const copy = [...products];

  switch (mode) {
    case "nameAZ":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    case "nameZA":
      return copy.sort((a, b) => b.name.localeCompare(a.name, "pt-BR", { sensitivity: "base" }));
    case "stockDesc":
      return copy.sort((a, b) => b.currentStock - a.currentStock);
    case "stockAsc":
      return copy.sort((a, b) => a.currentStock - b.currentStock);
    case "outboundDesc":
      return copy.sort((a, b) => b.totalOutbound - a.totalOutbound);
    case "inboundDesc":
      return copy.sort((a, b) => b.totalInbound - a.totalInbound);
    case "shortageFirst":
      return copy.sort((a, b) => {
        const aS = a.worstStatus === "shortage" ? 0 : 1;
        const bS = b.worstStatus === "shortage" ? 0 : 1;
        if (aS !== bS) return aS - bS;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      });
    case "lowFirst":
      return copy.sort((a, b) => {
        const aL = a.worstStatus === "low" ? 0 : a.worstStatus === "shortage" ? 1 : 2;
        const bL = b.worstStatus === "low" ? 0 : b.worstStatus === "shortage" ? 1 : 2;
        if (aL !== bL) return aL - bL;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      });
    default: {
      // default: shortage → zero-stock → low → has-movement → ok quiet
      const rank = (p: ProjectionProduct) => {
        if (p.worstStatus === "shortage") return 0;
        if (p.currentStock === 0) return 1;
        if (p.worstStatus === "low") return 2;
        if (p.totalOutbound > 0 || p.totalInbound > 0) return 3;
        return 4;
      };
      return copy.sort((a, b) => {
        const diff = rank(a) - rank(b);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      });
    }
  }
}

// ── Cell background ───────────────────────────────────────────────────────────

function cellBgClass(cell: ProjectionDayCell): string {
  if (cell.available < 0) return "bg-destructive/20";
  if (cell.status === "low") return "bg-chart-5/10";
  if (cell.available === 0) return "bg-destructive/8";
  const hasOut = cell.outbound > 0;
  const hasIn = cell.inbound > 0;
  if (hasOut && !hasIn) return "bg-destructive/5";
  if (hasIn && !hasOut) return "bg-chart-4/6";
  if (hasOut && hasIn) return "bg-muted/25";
  return "";
}

// ── MatrixCell ────────────────────────────────────────────────────────────────

function MatrixCell({ cell, minimumStock }: { cell: ProjectionDayCell; minimumStock: number }) {
  const av = cell.available;
  const isShortage = av < 0;
  const isZero = av === 0;
  const isLow = cell.status === "low";
  const hasOut = cell.outbound > 0;
  const hasIn = cell.inbound > 0;
  const hasImpact = hasOut || hasIn;

  const balanceClass = isShortage
    ? "text-destructive font-bold"
    : isZero
      ? "text-destructive/70 font-semibold"
      : isLow
        ? "text-chart-5 font-semibold"
        : hasImpact
          ? "text-foreground font-bold"
          : "text-muted-foreground/75";

  return (
    <div className="flex flex-col items-end gap-0.5 py-1 min-h-[38px] justify-center">
      {/* Main balance */}
      <span
        className={`text-[14px] leading-none tabular-nums ${balanceClass}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {isShortage ? `−${fmtNum(av)}` : fmtNum(av)}
      </span>

      {/* Shortage: "Faltam X" */}
      {isShortage && (
        <span className="text-[10px] leading-none text-destructive/80 tabular-nums">
          Faltam {fmtNum(-av)}
        </span>
      )}

      {/* Delta row */}
      {hasImpact && (
        <div className="flex items-center gap-1.5 leading-none">
          {hasOut && (
            <span className="text-[11px] text-destructive/80 tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
              ↓{fmtNum(cell.outbound)}
            </span>
          )}
          {hasIn && (
            <span className="text-[11px] text-chart-4 tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
              ↑{fmtNum(cell.inbound)}
            </span>
          )}
        </div>
      )}

      {/* Low: show gap to minimum */}
      {isLow && !isShortage && (
        <span className="text-[10px] leading-none text-chart-5/70">
          mín. {fmtNum(minimumStock)}
        </span>
      )}
    </div>
  );
}

// ── Tooltip content for a cell ────────────────────────────────────────────────

function cellTitle(product: ProjectionProduct, cell: ProjectionDayCell): string {
  return [
    product.name,
    formatDayFull(cell.date),
    "",
    `Abertura: ${fmtNum(cell.opening)}`,
    cell.outbound > 0 ? `Saída: −${fmtNum(cell.outbound)}` : null,
    cell.inbound > 0 ? `Entrada: +${fmtNum(cell.inbound)}` : null,
    `Disponível no CD: ${fmtNum(cell.available)}`,
    cell.available < 0 ? `Déficit: ${fmtNum(-cell.available)} unidades em falta` : null,
    cell.inEvent > 0 ? `Em evento: ${fmtNum(cell.inEvent)}` : null,
    cell.inTransit > 0 ? `Em trânsito: ${fmtNum(cell.inTransit)}` : null,
    cell.reserved > 0 ? `Reservado: ${fmtNum(cell.reserved)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  result: StockProjectionResult;
  onOpenCell?: (product: ProjectionProduct, cell: ProjectionDayCell) => void;
  onOpenProduct?: (product: ProjectionProduct) => void;
  onSelectDay?: (date: string) => void;
}

export function ProjectionMatrix({
  result,
  onOpenCell,
  onOpenProduct,
  onSelectDay,
}: Props) {
  const { rangeDays, products } = result;
  const [sortMode, setSortMode] = useState<SortMode>("default");

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

  const sortedProducts = useMemo(() => sortProducts(products, sortMode), [products, sortMode]);

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
                <span className="w-2 h-2 rounded-full bg-destructive" /> Em falta
              </span>
            </div>
          </div>
          <div className="overflow-x-auto projection-scroll pb-1" style={{ scrollbarWidth: "thin" }}>
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
                        ? "ring-1 ring-border bg-muted/20"
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
                      formatDayFull(dt.date),
                      dt.outbound > 0 ? `Saídas: ${fmtNum(dt.outbound)}` : null,
                      dt.inbound > 0 ? `Entradas: ${fmtNum(dt.inbound)}` : null,
                      dt.shortageCount > 0 ? `Em falta: ${dt.shortageCount} produto(s)` : null,
                      dt.lowCount > 0 ? `Abaixo do mínimo: ${dt.lowCount} produto(s)` : null,
                      !hasActivity && !hasRisk ? "Dia sem impacto" : null,
                    ].filter(Boolean).join(" · ")}
                    data-testid={`timeline-day-${dt.date}`}
                  >
                    <span className={`text-[10px] font-medium leading-none ${
                      today ? "text-foreground" : dt.shortageCount > 0 ? "text-destructive" : dt.lowCount > 0 ? "text-chart-5" : !hasActivity && !hasRisk ? "text-muted-foreground/35" : "text-muted-foreground"
                    }`}>
                      {weekdayShort(dt.date)}
                    </span>
                    <span className={`text-xs font-semibold leading-none mt-0.5 ${
                      today ? "text-foreground font-bold" : dt.shortageCount > 0 ? "text-destructive font-bold" : dt.lowCount > 0 ? "text-chart-5" : !hasActivity && !hasRisk ? "text-muted-foreground/40" : "text-foreground"
                    }`}>
                      {formatDay(dt.date)}
                    </span>
                    {today && (
                      <span className="text-[8px] font-semibold text-muted-foreground leading-none mt-0.5 uppercase tracking-wide">
                        hoje
                      </span>
                    )}
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
                    ) : (
                      <span className="mt-1 h-3.5" />
                    )}
                    <span className="inline-flex items-center gap-0.5 mt-0.5">
                      {dt.outbound > 0 ? <ArrowDown className="w-2.5 h-2.5 text-destructive/70" /> : <span className="w-2.5" />}
                      {dt.inbound > 0 ? <ArrowUp className="w-2.5 h-2.5 text-chart-4/70" /> : <span className="w-2.5" />}
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
          {/* Toolbar: legend + sort */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 border-b border-border/40">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-chart-4" />
                Adequado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-chart-5" />
                Abaixo do mínimo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
                Em falta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                Sem estoque
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 border-l border-border/40 pl-3">
                Número principal = saldo disponível ao final do dia
              </span>
              <span className="hidden sm:inline-flex items-center gap-1">
                <span className="text-destructive font-semibold">↓</span> saída
              </span>
              <span className="hidden sm:inline-flex items-center gap-1">
                <span className="text-chart-4 font-semibold">↑</span> entrada ou retorno
              </span>
            </div>

            {/* Sort selector */}
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <ArrowDownUp className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger
                  className="h-7 text-xs w-[180px] bg-muted/30 border-border/50"
                  data-testid="select-matrix-sort"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {SORT_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-auto max-h-[68vh] projection-scroll" style={{ scrollbarWidth: "thin" }}>
            <table className="w-full border-collapse" data-testid="table-projection-matrix">
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-border/60">
                  {/* Product column header */}
                  <th className="sticky left-0 z-30 bg-card text-left font-semibold text-sm px-3 py-2 min-w-[210px] max-w-[210px]">
                    Produto
                  </th>
                  {/* Atual column header */}
                  <th
                    className="sticky z-30 bg-muted/30 text-right font-semibold text-sm px-3 py-2 whitespace-nowrap border-r-2 border-border/50 min-w-[84px]"
                    style={{ left: 210 }}
                    title="Quantidade disponível no CD no momento em que a projeção foi calculada."
                  >
                    <div className="text-xs font-semibold text-foreground">Disponível</div>
                    <div className="text-[10px] font-normal text-muted-foreground">agora</div>
                  </th>
                  {/* Date columns */}
                  {rangeDays.map((d) => {
                    const today = isToday(d);
                    const weekend = isWeekend(d);
                    return (
                      <th
                        key={d}
                        className={`text-right px-2 py-1.5 whitespace-nowrap font-medium min-w-[74px] ${
                          today
                            ? "bg-muted/20 border-b-2 border-primary/40"
                            : weekend
                              ? "bg-muted/40 text-muted-foreground"
                              : "bg-card text-muted-foreground"
                        }`}
                      >
                        <div className={`text-xs leading-none font-semibold ${today ? "text-foreground" : ""}`}>
                          {formatDay(d)}
                        </div>
                        <div className="text-[10px] font-normal opacity-70 leading-none mt-0.5">
                          {weekdayShort(d)}
                        </div>
                        {today && (
                          <div className="text-[8px] font-semibold text-muted-foreground leading-none mt-0.5 uppercase tracking-wide">
                            hoje
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p) => {
                  const rowBg =
                    p.worstStatus === "shortage"
                      ? "bg-destructive/4"
                      : p.worstStatus === "low"
                        ? "bg-chart-5/4"
                        : "";
                  return (
                    <tr
                      key={p.productId}
                      className={`border-b border-border/30 hover:bg-muted/20 ${rowBg}`}
                      data-testid={`row-matrix-${p.productId}`}
                    >
                      {/* Product name cell */}
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 align-middle min-w-[210px] max-w-[210px]">
                        <button
                          className="flex items-start gap-2 text-left hover-elevate rounded -mx-1 px-1 py-0.5 w-full"
                          onClick={() => onOpenProduct?.(p)}
                          data-testid={`button-product-${p.productId}`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDotClassExt(
                              p.worstStatus,
                              p.currentStock,
                              p.minimumStock,
                              p.totalOutbound,
                              p.totalInbound,
                            )}`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium leading-tight text-sm line-clamp-2 block">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground/70 block mt-0.5">
                              {p.sku}
                            </span>
                          </span>
                        </button>
                      </td>

                      {/* Atual / Disponível agora */}
                      <td
                        className="sticky z-10 bg-muted/20 text-right px-3 py-2 border-r-2 border-border/50 min-w-[84px] align-middle"
                        style={{ left: 210 }}
                        title="Quantidade disponível no CD no momento em que a projeção foi calculada."
                      >
                        <span
                          className={`text-[15px] font-bold tabular-nums ${
                            p.currentStock === 0
                              ? "text-destructive/70"
                              : p.currentStock < p.minimumStock
                                ? "text-chart-5"
                                : "text-foreground"
                          }`}
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {fmtNum(p.currentStock)}
                        </span>
                        {p.minimumStock > 0 && (
                          <div className="text-[10px] text-muted-foreground/60 tabular-nums">
                            mín. {fmtNum(p.minimumStock)}
                          </div>
                        )}
                      </td>

                      {/* Day cells */}
                      {p.days.map((c) => {
                        const today = isToday(c.date);
                        const weekend = isWeekend(c.date);
                        const bg = cellBgClass(c);
                        const todayBorder = today ? "border-t border-primary/25 border-b border-primary/25" : "";
                        const weekendExtra =
                          weekend && !bg ? "bg-muted/15" : "";

                        return (
                          <td
                            key={c.date}
                            className={`text-right px-1.5 align-middle min-w-[74px] ${bg} ${weekendExtra} ${todayBorder}`}
                            data-testid={`cell-${p.productId}-${c.date}`}
                          >
                            <button
                              className="hover-elevate rounded px-1.5 py-0.5 -mx-1.5 cursor-pointer w-full text-right"
                              onClick={() => onOpenCell?.(p, c)}
                              title={cellTitle(p, c)}
                              data-testid={`button-cell-${p.productId}-${c.date}`}
                            >
                              <MatrixCell cell={c} minimumStock={p.minimumStock} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom legend */}
          <div className="px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground/60 flex flex-wrap gap-x-4 gap-y-0.5">
            <span>Número principal = saldo disponível ao final do dia</span>
            <span><span className="text-destructive font-semibold">↓</span> = saída</span>
            <span><span className="text-chart-4 font-semibold">↑</span> = entrada ou retorno</span>
            <span className="ml-auto hidden sm:block">Clique numa célula para ver detalhes completos</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

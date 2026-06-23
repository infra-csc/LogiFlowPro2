import { useState, useMemo, useEffect } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Lock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Package,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StockProjectionResult } from "@shared/stock-projection";
import {
  formatDayFull,
  rowToneClass,
  statusBadgeClassExt,
  statusLabelExt,
  weekdayShort,
} from "./projection-utils";

interface Props {
  result: StockProjectionResult;
  onSelectProduct?: (productId: string) => void;
  /** When set, the view navigates to this date (controlled from outside). */
  initialDay?: string;
}

interface DayFlow {
  productId: string;
  productName: string;
  direction: "outbound" | "inbound";
  qty: number;
  alreadyPhysical: boolean;
  /** Actual outbound date — may differ from the selected day for pre-range movements. */
  outDate: string | null;
}

// ─── Day summary sentence ─────────────────────────────────────────────────────

function DaySummary({
  shortage,
  low,
  outbound,
  inbound,
  inEvent,
}: {
  shortage: number;
  low: number;
  outbound: number;
  inbound: number;
  inEvent: number;
}) {
  if (shortage > 0) {
    return (
      <Card className="border-destructive/40 bg-destructive/5" data-testid="day-summary-risk">
        <CardContent className="p-3 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm">
            <span className="font-semibold text-destructive">Atenção:</span>{" "}
            <span className="text-muted-foreground">
              {shortage} produto(s) entram em falta neste dia.
            </span>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (outbound === 0 && inbound === 0) {
    return (
      <Card className="border-border/60 bg-muted/20" data-testid="day-summary-quiet">
        <CardContent className="p-3 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Nenhuma entrada ou saída prevista neste dia
            {inEvent > 0 ? `. ${inEvent} unidade(s) permanecem em evento.` : "."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const parts: string[] = [];
  if (outbound > 0) parts.push(`${outbound} saída(s)`);
  if (inbound > 0) parts.push(`${inbound} entrada(s)`);
  return (
    <Card className="border-border/60 bg-muted/20" data-testid="day-summary-active">
      <CardContent className="p-3 flex items-center gap-2.5">
        <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          Dia com {parts.join(" e ")} prevista(s)
          {low > 0
            ? `. ${low} produto(s) abaixo do mínimo.`
            : " sem itens em falta."}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Agenda block ─────────────────────────────────────────────────────────────

function AgendaBlock({
  icon: Icon,
  label,
  color,
  bg,
  border,
  children,
}: {
  icon: typeof Package;
  label: string;
  color: string;
  bg: string;
  border: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-md border ${border} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${bg}`}>
        <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
        <span className={`text-xs font-semibold ${color}`}>{label}</span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProjectionDayView({ result, onSelectProduct, initialDay }: Props) {
  const { rangeDays, products } = result;
  const [selectedDay, setSelectedDay] = useState<string>(
    () => (initialDay && rangeDays.includes(initialDay) ? initialDay : rangeDays[0]) || "",
  );

  // Navigate to a specific day when controlled from outside (timeline click)
  useEffect(() => {
    if (!initialDay) return;
    if (rangeDays.includes(initialDay)) {
      setSelectedDay(initialDay);
    }
  }, [initialDay, rangeDays]);

  // Keep selection valid when result changes
  useEffect(() => {
    if (!rangeDays.includes(selectedDay)) {
      setSelectedDay(rangeDays[0] || "");
    }
  }, [rangeDays, selectedDay]);

  const dayIdx = rangeDays.indexOf(selectedDay);

  const rows = useMemo(() => {
    if (dayIdx < 0) return [];
    return products
      .map((p) => ({ product: p, cell: p.days[dayIdx] }))
      .filter((r) => r.cell)
      .sort((a, b) => {
        const order = { shortage: 0, low: 1, ok: 2 } as const;
        const diff = order[a.cell.status] - order[b.cell.status];
        return diff !== 0 ? diff : a.cell.available - b.cell.available;
      });
  }, [products, dayIdx]);

  const kpis = useMemo(() => {
    let shortage = 0, low = 0, outbound = 0, inbound = 0, reserved = 0, inEvent = 0;
    const outFlows: DayFlow[] = [];
    const inFlows: DayFlow[] = [];
    const riskRows: typeof rows = [];

    for (const r of rows) {
      if (r.cell.status === "shortage") { shortage++; riskRows.push(r); }
      else if (r.cell.status === "low") { low++; riskRows.push(r); }
      outbound += r.cell.outbound;
      inbound += r.cell.inbound;
      reserved += r.cell.reserved;
      inEvent += r.cell.inEvent;
      for (const d of r.cell.drivers) {
        const flow: DayFlow = { productId: r.product.productId, productName: r.product.name, direction: d.direction, qty: d.qty, alreadyPhysical: d.alreadyPhysical, outDate: d.outDate };
        if (d.direction === "outbound") outFlows.push(flow);
        else inFlows.push(flow);
      }
    }
    outFlows.sort((a, b) => b.qty - a.qty);
    inFlows.sort((a, b) => b.qty - a.qty);
    const outFlowsDone = outFlows.filter((f) => f.alreadyPhysical);
    const outFlowsPlanned = outFlows.filter((f) => !f.alreadyPhysical);
    return { shortage, low, outbound, inbound, reserved, inEvent, outFlowsDone, outFlowsPlanned, inFlows, riskRows };
  }, [rows]);

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum produto com movimentação no período selecionado.
      </p>
    );
  }

  const goPrev = () => dayIdx > 0 && setSelectedDay(rangeDays[dayIdx - 1]);
  const goNext = () => dayIdx < rangeDays.length - 1 && setSelectedDay(rangeDays[dayIdx + 1]);

  return (
    <div className="space-y-4">
      {/* ── Day picker ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="day-select">Dia</Label>
          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="outline" onClick={goPrev} disabled={dayIdx <= 0} data-testid="button-prev-day">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger id="day-select" className="w-[220px]" data-testid="select-projection-day">
                <SelectValue placeholder="Selecione o dia" />
              </SelectTrigger>
              <SelectContent>
                {rangeDays.map((d) => (
                  <SelectItem key={d} value={d}>
                    {weekdayShort(d)} · {formatDayFull(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="outline" onClick={goNext} disabled={dayIdx >= rangeDays.length - 1} data-testid="button-next-day">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Day summary sentence ── */}
      <DaySummary
        shortage={kpis.shortage}
        low={kpis.low}
        outbound={kpis.outbound}
        inbound={kpis.inbound}
        inEvent={kpis.inEvent}
      />

      {/* ── Day summary KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(
          [
            { value: kpis.shortage, label: "Em falta", tone: kpis.shortage > 0 ? "text-destructive" : "text-muted-foreground", border: kpis.shortage > 0 ? "border-destructive/40" : "border-border/60", testId: "text-day-shortage" },
            { value: kpis.low, label: "Abaixo do mín.", tone: kpis.low > 0 ? "text-chart-5" : "text-muted-foreground", border: kpis.low > 0 ? "border-chart-5/40" : "border-border/60", testId: "text-day-low" },
            { value: kpis.outbound, label: "Saídas", tone: kpis.outbound > 0 ? "text-destructive" : "text-muted-foreground", border: "border-border/60", testId: "text-day-outbound" },
            { value: kpis.inbound, label: "Entradas", tone: kpis.inbound > 0 ? "text-chart-4" : "text-muted-foreground", border: "border-border/60", testId: "text-day-inbound" },
            { value: kpis.reserved, label: "Reservado", tone: "text-foreground", border: "border-border/60", testId: "text-day-reserved" },
            { value: kpis.inEvent, label: "Em evento", tone: "text-foreground", border: "border-border/60", testId: "text-day-inevent" },
          ] as const
        ).map((k) => (
          <Card key={k.label} className={k.border}>
            <CardContent className="p-3">
              <div className={`text-xl font-bold tabular-nums ${k.tone}`} data-testid={k.testId}>{k.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Agenda blocks ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Saídas (realizadas + previstas) */}
        <AgendaBlock icon={ArrowUpRight} label="Saídas" color="text-destructive" bg="bg-destructive/10" border="border-destructive/25">
          {kpis.outFlowsDone.length === 0 && kpis.outFlowsPlanned.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem saídas neste dia.</p>
          ) : (
            <div className="space-y-2">
              {kpis.outFlowsDone.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Já saíram</p>
                  {kpis.outFlowsDone.slice(0, 5).map((f, i) => {
                    const dateDiffers = f.outDate && f.outDate !== selectedDay;
                    const [, mo, dy] = (f.outDate || "").split("-");
                    const dateLabel = dateDiffers ? `saiu em ${dy}/${mo}` : null;
                    return (
                      <button
                        key={i}
                        onClick={onSelectProduct ? () => onSelectProduct(f.productId) : undefined}
                        className="flex items-start justify-between gap-2 w-full text-left rounded hover-elevate px-1 -mx-1 py-0.5"
                        data-testid={`agenda-out-done-${i}`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs truncate text-foreground/90">{f.productName}</span>
                          {dateLabel && <span className="text-[10px] text-muted-foreground">{dateLabel}</span>}
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-destructive flex-shrink-0 mt-0.5">-{f.qty}</span>
                      </button>
                    );
                  })}
                  {kpis.outFlowsDone.length > 5 && <p className="text-xs text-muted-foreground">+{kpis.outFlowsDone.length - 5} mais...</p>}
                </div>
              )}
              {kpis.outFlowsDone.length > 0 && kpis.outFlowsPlanned.length > 0 && (
                <div className="border-t border-border/40" />
              )}
              {kpis.outFlowsPlanned.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Previstas</p>
                  {kpis.outFlowsPlanned.slice(0, 5).map((f, i) => (
                    <button
                      key={i}
                      onClick={onSelectProduct ? () => onSelectProduct(f.productId) : undefined}
                      className="flex items-center justify-between gap-2 w-full text-left rounded hover-elevate px-1 -mx-1 py-0.5"
                      data-testid={`agenda-out-planned-${i}`}
                    >
                      <span className="text-xs truncate text-foreground/90">{f.productName}</span>
                      <span className="text-xs font-semibold tabular-nums text-destructive flex-shrink-0">-{f.qty}</span>
                    </button>
                  ))}
                  {kpis.outFlowsPlanned.length > 5 && <p className="text-xs text-muted-foreground">+{kpis.outFlowsPlanned.length - 5} mais...</p>}
                </div>
              )}
            </div>
          )}
        </AgendaBlock>

        {/* Entradas e retornos */}
        <AgendaBlock icon={ArrowDownLeft} label="Entradas e retornos" color="text-chart-4" bg="bg-chart-4/10" border="border-chart-4/25">
          {kpis.inFlows.length > 0 ? (
            <div className="space-y-1.5">
              {kpis.inFlows.slice(0, 5).map((f, i) => (
                <button
                  key={i}
                  onClick={onSelectProduct ? () => onSelectProduct(f.productId) : undefined}
                  className="flex items-center justify-between gap-2 w-full text-left rounded hover-elevate px-1 -mx-1 py-0.5"
                  data-testid={`agenda-in-${i}`}
                >
                  <span className="text-xs truncate text-foreground/90">{f.productName}</span>
                  <span className="text-xs font-semibold tabular-nums text-chart-4 flex-shrink-0">+{f.qty}</span>
                </button>
              ))}
              {kpis.inFlows.length > 5 && <p className="text-xs text-muted-foreground">+{kpis.inFlows.length - 5} mais...</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem entradas ou retornos previstos.</p>
          )}
        </AgendaBlock>

        {/* Riscos do dia */}
        <AgendaBlock
          icon={kpis.riskRows.length > 0 ? AlertTriangle : CheckCircle2}
          label={kpis.riskRows.length > 0 ? `Riscos do dia (${kpis.riskRows.length})` : "Riscos do dia"}
          color={kpis.riskRows.length > 0 ? "text-chart-5" : "text-chart-4"}
          bg={kpis.riskRows.length > 0 ? "bg-chart-5/10" : "bg-chart-4/10"}
          border={kpis.riskRows.length > 0 ? "border-chart-5/25" : "border-chart-4/25"}
        >
          {kpis.riskRows.length > 0 ? (
            <div className="space-y-1.5">
              {kpis.riskRows.slice(0, 5).map(({ product, cell }, i) => (
                <button
                  key={i}
                  onClick={onSelectProduct ? () => onSelectProduct(product.productId) : undefined}
                  className="flex items-center justify-between gap-2 w-full text-left rounded hover-elevate px-1 -mx-1 py-0.5"
                  data-testid={`agenda-risk-${i}`}
                >
                  <span className="text-xs truncate text-foreground/90">{product.name}</span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] flex-shrink-0 ${cell.status === "shortage" ? "bg-destructive/15 text-destructive" : "bg-chart-5/15 text-chart-5"}`}
                  >
                    {cell.status === "shortage" ? "Em falta" : "Baixo"}
                  </Badge>
                </button>
              ))}
              {kpis.riskRows.length > 5 && <p className="text-xs text-muted-foreground">+{kpis.riskRows.length - 5} mais...</p>}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Nenhum risco de falta hoje.</p>
              {kpis.inEvent > 0 && (
                <p className="text-xs text-muted-foreground">
                  {kpis.inEvent} unidade(s) permanecem em evento.
                </p>
              )}
            </div>
          )}
        </AgendaBlock>
      </div>

      {/* ── Detail table ── */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Detalhes por produto</span>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> {kpis.reserved} reservado</span>
              <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {kpis.inEvent} em evento</span>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto impactado neste dia.</p>
          ) : (
            <div className="overflow-x-auto projection-scroll" style={{ scrollbarWidth: "thin" }}>
              <Table data-testid="table-projection-day">
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Abertura</TableHead>
                    <TableHead className="text-right">Saída</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-right text-muted-foreground">Controlado</TableHead>
                    <TableHead className="text-right text-muted-foreground/70">Em evento</TableHead>
                    <TableHead className="text-right text-muted-foreground/70">Em trânsito</TableHead>
                    <TableHead className="text-right text-muted-foreground/70">Reservado</TableHead>
                    <TableHead className="text-right font-semibold">Disponível</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ product, cell }) => (
                    <TableRow
                      key={product.productId}
                      className={`${rowToneClass(cell.status)} ${onSelectProduct ? "cursor-pointer" : ""}`}
                      onClick={onSelectProduct ? () => onSelectProduct(product.productId) : undefined}
                      data-testid={`row-day-${product.productId}`}
                    >
                      <TableCell>
                        <div className="font-medium leading-tight">{product.name}</div>
                        <div className="text-xs text-muted-foreground">{product.sku} · mín. {product.minimumStock} {product.unit}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{cell.opening}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{cell.outbound > 0 ? `-${cell.outbound}` : "0"}</TableCell>
                      <TableCell className="text-right tabular-nums text-chart-4">{cell.inbound > 0 ? `+${cell.inbound}` : "0"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{cell.available}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground/60">{cell.inEvent > 0 ? `-${cell.inEvent}` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground/60">{cell.inTransit > 0 ? cell.inTransit : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground/60">{cell.reserved > 0 ? cell.reserved : "—"}</TableCell>
                      <TableCell className={`text-right tabular-nums font-semibold ${cell.available - cell.inEvent < 0 ? "text-destructive" : ""}`}>
                        {cell.available - cell.inEvent}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusBadgeClassExt(cell.status, cell.available, product.minimumStock)} text-xs`}>
                          {statusLabelExt(cell.status, cell.available, product.minimumStock)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

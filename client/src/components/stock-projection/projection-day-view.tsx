import { useState, useMemo, useEffect } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Lock,
  MapPin,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  Package,
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
  sourceLabel,
  statusBadgeClass,
  statusLabel,
  weekdayShort,
} from "./projection-utils";

interface Props {
  result: StockProjectionResult;
  onSelectProduct?: (productId: string) => void;
}

interface DayFlow {
  productId: string;
  productName: string;
  source: string;
  label: string;
  eventName: string | null;
  direction: "outbound" | "inbound";
  qty: number;
}

// ─── Agenda block: a themed section of the daily schedule ────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectionDayView({ result, onSelectProduct }: Props) {
  const { rangeDays, products } = result;
  const [selectedDay, setSelectedDay] = useState<string>(rangeDays[0] || "");

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
        if (diff !== 0) return diff;
        return a.cell.available - b.cell.available;
      });
  }, [products, dayIdx]);

  const kpis = useMemo(() => {
    let shortage = 0;
    let low = 0;
    let outbound = 0;
    let inbound = 0;
    let reserved = 0;
    let inEvent = 0;
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
        const flow: DayFlow = {
          productId: r.product.productId,
          productName: r.product.name,
          source: d.source,
          label: d.label,
          eventName: d.eventName,
          direction: d.direction,
          qty: d.qty,
        };
        if (d.direction === "outbound") outFlows.push(flow);
        else inFlows.push(flow);
      }
    }
    outFlows.sort((a, b) => b.qty - a.qty);
    inFlows.sort((a, b) => b.qty - a.qty);
    return { shortage, low, outbound, inbound, reserved, inEvent, outFlows, inFlows, riskRows };
  }, [rows]);

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum produto com movimentação no período selecionado.
      </p>
    );
  }

  const goPrev = () => dayIdx > 0 && setSelectedDay(rangeDays[dayIdx - 1]);
  const goNext = () =>
    dayIdx < rangeDays.length - 1 && setSelectedDay(rangeDays[dayIdx + 1]);

  const hasOutbound = kpis.outFlows.length > 0;
  const hasInbound = kpis.inFlows.length > 0;
  const hasRisk = kpis.riskRows.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Day picker ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="day-select">Dia</Label>
          <div className="flex items-center gap-1.5">
            <Button
              size="icon"
              variant="outline"
              onClick={goPrev}
              disabled={dayIdx <= 0}
              data-testid="button-prev-day"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger
                id="day-select"
                className="w-[220px]"
                data-testid="select-projection-day"
              >
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
            <Button
              size="icon"
              variant="outline"
              onClick={goNext}
              disabled={dayIdx >= rangeDays.length - 1}
              data-testid="button-next-day"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Day summary KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className={kpis.shortage > 0 ? "border-destructive/40" : "border-border/60"}>
          <CardContent className="p-3">
            <div
              className={`text-xl font-bold tabular-nums ${kpis.shortage > 0 ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="text-day-shortage"
            >
              {kpis.shortage}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Em falta</div>
          </CardContent>
        </Card>
        <Card className={kpis.low > 0 ? "border-chart-5/40" : "border-border/60"}>
          <CardContent className="p-3">
            <div
              className={`text-xl font-bold tabular-nums ${kpis.low > 0 ? "text-chart-5" : "text-muted-foreground"}`}
              data-testid="text-day-low"
            >
              {kpis.low}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Abaixo do mín.</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div
              className={`text-xl font-bold tabular-nums ${kpis.outbound > 0 ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="text-day-outbound"
            >
              {kpis.outbound}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Saídas</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div
              className={`text-xl font-bold tabular-nums ${kpis.inbound > 0 ? "text-chart-4" : "text-muted-foreground"}`}
              data-testid="text-day-inbound"
            >
              {kpis.inbound}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Entradas</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xl font-bold tabular-nums" data-testid="text-day-reserved">
              {kpis.reserved}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Reservado</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xl font-bold tabular-nums" data-testid="text-day-inevent">
              {kpis.inEvent}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Em evento</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Agenda blocks ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Saídas previstas */}
        <AgendaBlock
          icon={ArrowUpRight}
          label="Saídas previstas"
          color="text-destructive"
          bg="bg-destructive/10"
          border="border-destructive/25"
        >
          {hasOutbound ? (
            <div className="space-y-1.5">
              {kpis.outFlows.slice(0, 5).map((f, i) => (
                <button
                  key={i}
                  onClick={onSelectProduct ? () => onSelectProduct(f.productId) : undefined}
                  className="flex items-center justify-between gap-2 w-full text-left rounded hover-elevate px-1 -mx-1 py-0.5"
                  data-testid={`agenda-out-${i}`}
                >
                  <span className="text-xs truncate text-foreground/90">{f.productName}</span>
                  <span className="text-xs font-semibold tabular-nums text-destructive flex-shrink-0">
                    -{f.qty}
                  </span>
                </button>
              ))}
              {kpis.outFlows.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{kpis.outFlows.length - 5} mais...
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem saídas previstas neste dia.</p>
          )}
        </AgendaBlock>

        {/* Entradas e retornos */}
        <AgendaBlock
          icon={ArrowDownLeft}
          label="Entradas e retornos"
          color="text-chart-4"
          bg="bg-chart-4/10"
          border="border-chart-4/25"
        >
          {hasInbound ? (
            <div className="space-y-1.5">
              {kpis.inFlows.slice(0, 5).map((f, i) => (
                <button
                  key={i}
                  onClick={onSelectProduct ? () => onSelectProduct(f.productId) : undefined}
                  className="flex items-center justify-between gap-2 w-full text-left rounded hover-elevate px-1 -mx-1 py-0.5"
                  data-testid={`agenda-in-${i}`}
                >
                  <span className="text-xs truncate text-foreground/90">{f.productName}</span>
                  <span className="text-xs font-semibold tabular-nums text-chart-4 flex-shrink-0">
                    +{f.qty}
                  </span>
                </button>
              ))}
              {kpis.inFlows.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{kpis.inFlows.length - 5} mais...
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sem entradas ou retornos previstos.
            </p>
          )}
        </AgendaBlock>

        {/* Riscos do dia */}
        <AgendaBlock
          icon={hasRisk ? AlertTriangle : CheckCircle2}
          label={hasRisk ? `Riscos do dia (${kpis.riskRows.length})` : "Riscos do dia"}
          color={hasRisk ? "text-chart-5" : "text-chart-4"}
          bg={hasRisk ? "bg-chart-5/10" : "bg-chart-4/10"}
          border={hasRisk ? "border-chart-5/25" : "border-chart-4/25"}
        >
          {hasRisk ? (
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
                    className={`text-[10px] flex-shrink-0 ${
                      cell.status === "shortage"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-chart-5/15 text-chart-5"
                    }`}
                  >
                    {cell.status === "shortage" ? "Falta" : "Baixo"}
                  </Badge>
                </button>
              ))}
              {kpis.riskRows.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{kpis.riskRows.length - 5} mais...
                </p>
              )}
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
            <span className="text-xs font-semibold text-muted-foreground">
              Detalhes por produto
            </span>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> {kpis.reserved} reservado
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {kpis.inEvent} em evento
              </span>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum produto impactado neste dia.
            </p>
          ) : (
            <div className="overflow-x-auto projection-scroll" style={{ scrollbarWidth: "thin" }}>
              <Table data-testid="table-projection-day">
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Abertura</TableHead>
                    <TableHead className="text-right">Saída</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Reservado</TableHead>
                    <TableHead className="text-right">Em trânsito</TableHead>
                    <TableHead className="text-right">Em evento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ product, cell }) => (
                    <TableRow
                      key={product.productId}
                      className={`${rowToneClass(cell.status)} ${onSelectProduct ? "cursor-pointer" : ""}`}
                      onClick={
                        onSelectProduct ? () => onSelectProduct(product.productId) : undefined
                      }
                      data-testid={`row-day-${product.productId}`}
                    >
                      <TableCell>
                        <div className="font-medium leading-tight">{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {product.sku} · mín. {product.minimumStock} {product.unit}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{cell.opening}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        {cell.outbound > 0 ? `-${cell.outbound}` : "0"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-chart-4">
                        {cell.inbound > 0 ? `+${cell.inbound}` : "0"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {cell.available}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {cell.reserved}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {cell.inTransit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {cell.inEvent}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusBadgeClass(cell.status)} text-xs`}>
                          {statusLabel(cell.status)}
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

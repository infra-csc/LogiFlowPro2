import { useState, useMemo, useEffect } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Lock,
  MapPin,
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
    const flows: DayFlow[] = [];
    for (const r of rows) {
      if (r.cell.status === "shortage") shortage++;
      else if (r.cell.status === "low") low++;
      outbound += r.cell.outbound;
      inbound += r.cell.inbound;
      reserved += r.cell.reserved;
      inEvent += r.cell.inEvent;
      for (const d of r.cell.drivers) {
        flows.push({
          productId: r.product.productId,
          productName: r.product.name,
          source: d.source,
          label: d.label,
          eventName: d.eventName,
          direction: d.direction,
          qty: d.qty,
        });
      }
    }
    flows.sort((a, b) => {
      if (a.direction !== b.direction) return a.direction === "outbound" ? -1 : 1;
      return b.qty - a.qty;
    });
    return { shortage, low, outbound, inbound, reserved, inEvent, flows };
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-destructive/40">
          <CardContent className="p-3">
            <div className="text-xl font-bold text-destructive tabular-nums" data-testid="text-day-shortage">
              {kpis.shortage}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Em falta</div>
          </CardContent>
        </Card>
        <Card className="border-chart-5/40">
          <CardContent className="p-3">
            <div className="text-xl font-bold text-chart-5 tabular-nums" data-testid="text-day-low">
              {kpis.low}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Abaixo do mín.</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xl font-bold text-destructive tabular-nums" data-testid="text-day-outbound">
              {kpis.outbound}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Saídas</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xl font-bold text-chart-4 tabular-nums" data-testid="text-day-inbound">
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

      {/* Agenda / timeline of the day's flows */}
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold">Agenda do dia</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> {kpis.reserved} reservado
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {kpis.inEvent} em evento
              </span>
            </div>
          </div>
          {kpis.flows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhuma entrada ou saída prevista neste dia.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto projection-scroll pb-1" style={{ scrollbarWidth: "thin" }}>
              {kpis.flows.map((f, i) => (
                <button
                  key={i}
                  onClick={onSelectProduct ? () => onSelectProduct(f.productId) : undefined}
                  className={`flex-shrink-0 w-48 text-left rounded-md border p-2.5 hover-elevate ${
                    f.direction === "outbound" ? "border-destructive/30" : "border-chart-4/30"
                  }`}
                  data-testid={`day-flow-${i}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {sourceLabel(f.source)}
                    </Badge>
                    <span
                      className={`inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${
                        f.direction === "outbound" ? "text-destructive" : "text-chart-4"
                      }`}
                    >
                      {f.direction === "outbound" ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      )}
                      {f.direction === "outbound" ? `-${f.qty}` : `+${f.qty}`}
                    </span>
                  </div>
                  <div className="text-sm font-medium truncate mt-1">{f.productName}</div>
                  <div className="text-xs text-muted-foreground truncate">{f.eventName || f.label}</div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-0">
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
                    onClick={onSelectProduct ? () => onSelectProduct(product.productId) : undefined}
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
                    <TableCell className="text-right tabular-nums font-semibold">{cell.available}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{cell.reserved}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{cell.inTransit}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{cell.inEvent}</TableCell>
                    <TableCell>
                      <Badge className={`${statusBadgeClass(cell.status)} text-xs`}>{statusLabel(cell.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

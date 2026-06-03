import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { formatDayFull, rowToneClass, statusBadgeClass, statusLabel, weekdayShort } from "./projection-utils";

interface Props {
  result: StockProjectionResult;
  onSelectProduct?: (productId: string) => void;
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
    for (const r of rows) {
      if (r.cell.status === "shortage") shortage++;
      else if (r.cell.status === "low") low++;
      outbound += r.cell.outbound;
      inbound += r.cell.inbound;
    }
    return { shortage, low, outbound, inbound };
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-destructive/40">
          <CardContent className="p-3">
            <div className="text-xl font-bold text-destructive tabular-nums" data-testid="text-day-shortage">
              {kpis.shortage}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Em falta no dia</div>
          </CardContent>
        </Card>
        <Card className="border-chart-5/40">
          <CardContent className="p-3">
            <div className="text-xl font-bold text-chart-5 tabular-nums" data-testid="text-day-low">
              {kpis.low}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Abaixo do mínimo</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xl font-bold text-destructive tabular-nums" data-testid="text-day-outbound">
              {kpis.outbound}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Saídas no dia</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xl font-bold text-chart-4 tabular-nums" data-testid="text-day-inbound">
              {kpis.inbound}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Entradas no dia</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
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

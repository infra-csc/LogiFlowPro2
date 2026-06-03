import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { formatDayFull, statusBadgeClass, statusLabel } from "./projection-utils";

interface Props {
  result: StockProjectionResult;
}

export function ProjectionDayView({ result }: Props) {
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

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum produto com movimentação no período selecionado.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="day-select">Dia</Label>
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger id="day-select" className="w-[200px]" data-testid="select-projection-day">
              <SelectValue placeholder="Selecione o dia" />
            </SelectTrigger>
            <SelectContent>
              {rangeDays.map((d) => (
                <SelectItem key={d} value={d}>
                  {formatDayFull(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                  <TableHead className="text-right">Em evento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ product, cell }) => (
                  <TableRow key={product.productId} data-testid={`row-day-${product.productId}`}>
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
        </CardContent>
      </Card>
    </div>
  );
}

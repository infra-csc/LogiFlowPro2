import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ExternalLink } from "lucide-react";
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
import type { ProjectionDriver, StockProjectionResult } from "@shared/stock-projection";
import {
  cellToneClass,
  formatDay,
  isToday,
  isWeekend,
  sourceLabel,
  statusBadgeClass,
  statusLabel,
} from "./projection-utils";

interface Props {
  result: StockProjectionResult;
  selectedProductId?: string;
  onSelectProduct?: (id: string) => void;
}

interface AggImpact {
  source: string;
  sourceId: string;
  label: string;
  eventName: string | null;
  outbound: number;
  inbound: number;
  href?: string;
}

function hrefForDriver(d: ProjectionDriver): string | undefined {
  switch (d.source) {
    case "loading_order":
      return `/loading-orders/${d.sourceId}`;
    case "movement":
      return `/movements/${d.sourceId}`;
    case "request":
      return `/requests/${d.sourceId}`;
    case "trip":
      return `/trips`;
    default:
      return undefined;
  }
}

export function ProjectionByProduct({ result, selectedProductId, onSelectProduct }: Props) {
  const { products } = result;
  const [internalId, setInternalId] = useState<string>(selectedProductId || products[0]?.productId || "");

  useEffect(() => {
    if (selectedProductId) setInternalId(selectedProductId);
  }, [selectedProductId]);

  useEffect(() => {
    if (!products.find((p) => p.productId === internalId)) {
      const fallback = products[0]?.productId || "";
      setInternalId(fallback);
      if (fallback && fallback !== selectedProductId) onSelectProduct?.(fallback);
    }
  }, [products, internalId, selectedProductId, onSelectProduct]);

  const product = useMemo(
    () => products.find((p) => p.productId === internalId),
    [products, internalId],
  );

  const impacts = useMemo<AggImpact[]>(() => {
    if (!product) return [];
    const map = new Map<string, AggImpact>();
    for (const cell of product.days) {
      for (const d of cell.drivers) {
        const key = `${d.source}:${d.sourceId}`;
        if (!map.has(key)) {
          map.set(key, {
            source: d.source,
            sourceId: d.sourceId,
            label: d.label,
            eventName: d.eventName,
            outbound: 0,
            inbound: 0,
            href: hrefForDriver(d),
          });
        }
        const agg = map.get(key)!;
        if (d.direction === "outbound") agg.outbound += d.qty;
        else agg.inbound += d.qty;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.outbound - a.outbound);
  }, [product]);

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum produto com movimentação no período selecionado.
      </p>
    );
  }

  const handleChange = (id: string) => {
    setInternalId(id);
    onSelectProduct?.(id);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="product-select">Produto</Label>
        <Select value={internalId} onValueChange={handleChange}>
          <SelectTrigger id="product-select" className="w-full sm:w-[340px]" data-testid="select-by-product">
            <SelectValue placeholder="Selecione o produto" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.productId} value={p.productId}>
                {p.name} · {p.sku}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {product && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="border-border/60">
              <CardContent className="p-3">
                <div className="text-xl font-bold tabular-nums">{product.currentStock}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Estoque atual</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-3">
                <div className="text-xl font-bold tabular-nums">{product.minimumStock}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Mínimo</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-3">
                <div className="text-xl font-bold tabular-nums">{product.minAvailable}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Pior saldo</div>
              </CardContent>
            </Card>
            <Card className={product.maxDeficit > 0 ? "border-destructive/40" : "border-border/60"}>
              <CardContent className="p-3">
                <div
                  className={`text-xl font-bold tabular-nums ${product.maxDeficit > 0 ? "text-destructive" : ""}`}
                >
                  {product.maxDeficit}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Déficit máx.</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-3">
                <div className="text-xl font-bold text-destructive tabular-nums">{product.totalOutbound}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Saídas</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-3">
                <div className="text-xl font-bold text-chart-4 tabular-nums">{product.totalInbound}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Entradas</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="font-semibold text-sm">Linha do tempo do saldo</p>
                <Badge className={`${statusBadgeClass(product.worstStatus)} text-xs`}>
                  {statusLabel(product.worstStatus)}
                </Badge>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                <div className="flex gap-1 min-w-min">
                  {product.days.map((c) => (
                    <div
                      key={c.date}
                      className="flex flex-col items-center gap-1 flex-shrink-0 w-10"
                      data-testid={`timeline-${product.productId}-${c.date}`}
                    >
                      <div
                        className={`w-full text-center rounded px-1 py-1.5 text-xs tabular-nums ${cellToneClass(
                          c.status,
                        )} ${c.status === "ok" ? "bg-muted/40" : ""}`}
                        title={`Saldo ${c.available} · Saída ${c.outbound} · Entrada ${c.inbound}`}
                      >
                        {c.available}
                      </div>
                      <div
                        className={`text-[10px] leading-none ${
                          isToday(c.date)
                            ? "text-primary font-medium"
                            : isWeekend(c.date)
                              ? "text-muted-foreground/60"
                              : "text-muted-foreground"
                        }`}
                      >
                        {formatDay(c.date)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-0">
              <div className="px-4 pt-4 pb-2">
                <p className="font-semibold text-sm">Origens que impactam este produto</p>
              </div>
              <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                <Table data-testid="table-by-product-impacts">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead className="text-right">Saída</TableHead>
                      <TableHead className="text-right">Entrada</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                          Sem origens no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      impacts.map((imp, i) => (
                        <TableRow key={`${imp.source}-${imp.sourceId}-${i}`} data-testid={`row-impact-${i}`}>
                          <TableCell className="text-muted-foreground">{sourceLabel(imp.source)}</TableCell>
                          <TableCell className="font-medium">{imp.label}</TableCell>
                          <TableCell className="text-muted-foreground">{imp.eventName || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-destructive">
                            {imp.outbound > 0 ? `-${imp.outbound}` : "0"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-chart-4">
                            {imp.inbound > 0 ? `+${imp.inbound}` : "0"}
                          </TableCell>
                          <TableCell>
                            {imp.href && (
                              <Link href={imp.href}>
                                <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`link-impact-${i}`}>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Package, ExternalLink } from "lucide-react";
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
  formatDayFull,
  isToday,
  isWeekend,
  sourceLabel,
  statusBadgeClassExt,
  statusLabelExt,
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
  const [internalId, setInternalId] = useState<string>(
    selectedProductId || products[0]?.productId || "",
  );

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

  const worstDayDate = useMemo<string | null>(() => {
    if (!product || product.days.length === 0) return null;
    return product.days.reduce((min, c) => (c.available < min.available ? c : min)).date;
  }, [product]);

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
      <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid="by-product-empty">
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
          <Package className="w-6 h-6 text-muted-foreground" />
        </span>
        <div>
          <p className="font-medium">Nenhum produto com impacto no período</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Não encontramos requisições, ordens de carregamento ou movimentações que alterem o saldo deste produto no período selecionado.
          </p>
        </div>
      </div>
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
        <p className="text-sm text-muted-foreground -mt-1" data-testid="by-product-summary">
          {product.totalOutbound === 0 && product.totalInbound === 0
            ? "Este produto mantém saldo estável no período selecionado."
            : `Este produto possui ${product.totalOutbound} saída(s), ${product.totalInbound} entrada(s) e pior saldo de ${product.minAvailable}${worstDayDate ? ` em ${formatDayFull(worstDayDate)}` : ""}.`}
        </p>
      )}

      {product && (
        <>
          {/* KPIs */}
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
                <div className={`text-xl font-bold tabular-nums ${product.maxDeficit > 0 ? "text-destructive" : ""}`}>
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

          {/* Timeline */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="font-semibold text-sm">Linha do tempo do saldo</p>
                <Badge className={`${statusBadgeClassExt(product.worstStatus, product.currentStock, product.minimumStock)} text-xs`}>
                  {statusLabelExt(product.worstStatus, product.currentStock, product.minimumStock)}
                </Badge>
              </div>
              <div className="overflow-x-auto projection-scroll" style={{ scrollbarWidth: "thin" }}>
                <div className="flex gap-1 min-w-min pb-1">
                  {product.days.map((c) => {
                    const hasFlow = c.outbound > 0 || c.inbound > 0;
                    const isWorst = worstDayDate === c.date && product.maxDeficit > 0;
                    const isQuiet = !hasFlow && c.status === "ok";
                    return (
                      <div
                        key={c.date}
                        className="flex flex-col items-center gap-1 flex-shrink-0 w-10"
                        data-testid={`timeline-${product.productId}-${c.date}`}
                      >
                        {/* Day indicators */}
                        <div className="flex gap-0.5 h-2 items-center">
                          {c.outbound > 0 && <div className="w-1.5 h-1.5 rounded-full bg-destructive" title="Saída" />}
                          {c.inbound > 0 && <div className="w-1.5 h-1.5 rounded-full bg-chart-4" title="Entrada" />}
                          {!hasFlow && <div className="w-1.5 h-1.5 rounded-full bg-transparent" />}
                        </div>
                        {/* Balance cell */}
                        <div
                          className={`w-full text-center rounded px-1 py-1.5 text-xs tabular-nums ${cellToneClass(c.status, c.available, product.minimumStock, hasFlow)} ${isWorst ? "ring-1 ring-destructive/60" : ""}`}
                          title={`Saldo ${c.available} · Saída ${c.outbound} · Entrada ${c.inbound}${isWorst ? " · Pior dia" : ""}`}
                        >
                          {c.available}
                        </div>
                        {/* Date label */}
                        <div
                          className={`text-[10px] leading-none ${
                            isToday(c.date)
                              ? "text-primary font-medium"
                              : isWorst
                                ? "text-destructive font-medium"
                                : isWeekend(c.date)
                                  ? "text-muted-foreground/60"
                                  : isQuiet
                                    ? "text-muted-foreground/40"
                                    : "text-muted-foreground"
                          }`}
                        >
                          {formatDay(c.date)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Saída</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-4 inline-block" /> Entrada</span>
                {product.maxDeficit > 0 && (
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded border border-destructive/60 inline-block" /> Pior dia</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Impacts table */}
          <Card className="border-border/60">
            <CardContent className="p-0">
              <div className="px-4 pt-4 pb-2">
                <p className="font-semibold text-sm">Origens que impactam este produto</p>
              </div>
              {impacts.length === 0 ? (
                <div className="px-4 pb-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Este produto não possui movimentações, requisições ou ordens de carregamento impactando o saldo no período selecionado.
                  </p>
                </div>
              ) : (
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
                      {impacts.map((imp, i) => (
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

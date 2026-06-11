import { useState, Fragment } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
} from "lucide-react";
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
  situationBadgeClass,
  situationLabel,
  situationReason,
  sourceLabel,
} from "./projection-utils";

interface Props {
  result: StockProjectionResult;
}

export function ProjectionMovements({ result }: Props) {
  const rows = result.consideredMovements;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhuma fonte considerada com os filtros atuais. Ajuste o período ou as fontes selecionadas para ver os dados que entram no cálculo.
      </p>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        <div className="overflow-x-auto projection-scroll" style={{ scrollbarWidth: "thin" }}>
          <Table data-testid="table-considered-movements">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Origem</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Sentido</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Retorno</TableHead>
                <TableHead className="text-right">Produtos</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m, idx) => {
                const key = `${m.source}-${m.sourceId}-${idx}`;
                const isOpen = expanded.has(key);
                const reason = situationReason(m.situation, m.outDate, m.inDate);
                return (
                  <Fragment key={key}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggle(key)}
                      data-testid={`row-movement-${idx}`}
                    >
                      <TableCell className="w-8">
                        <Button size="icon" variant="ghost" className="h-6 w-6" data-testid={`button-expand-${idx}`}>
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{sourceLabel(m.source)}</TableCell>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-muted-foreground">{m.eventName || "—"}</TableCell>
                      <TableCell>
                        {m.direction === "outbound" ? (
                          <span className="inline-flex items-center gap-1 text-destructive text-sm">
                            <ArrowUpRight className="w-3.5 h-3.5" /> Saída
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-chart-4 text-sm">
                            <ArrowDownLeft className="w-3.5 h-3.5" /> Entrada
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{m.outDate ? formatDayFull(m.outDate) : "—"}</TableCell>
                      <TableCell className="text-sm">{m.inDate ? formatDayFull(m.inDate) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.productCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.totalQuantity}</TableCell>
                      <TableCell>
                        <Badge className={`${situationBadgeClass(m.situation)} text-xs`}>
                          {situationLabel(m.situation)}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {isOpen && (
                      <TableRow data-testid={`row-movement-detail-${idx}`}>
                        <TableCell colSpan={10} className="bg-muted/30">
                          <div className="py-2 space-y-3">
                            {/* Situation reason */}
                            {reason && (
                              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-chart-5" />
                                <span>{reason}</span>
                              </div>
                            )}

                            {/* Meta row */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {m.alreadyPhysical ? "Já movimentado fisicamente" : "Previsto"}
                              </Badge>
                              {m.status && (
                                <span className="text-xs text-muted-foreground">
                                  Status da origem: <span className="font-medium text-foreground">{m.status}</span>
                                </span>
                              )}
                              {m.href && (
                                <Link href={m.href}>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`link-movement-${idx}`}>
                                    <ExternalLink className="w-3 h-3 mr-1" /> Abrir origem
                                  </Button>
                                </Link>
                              )}
                            </div>

                            {/* Products */}
                            {m.products.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                                {m.products.map((p) => (
                                  <div
                                    key={p.productId}
                                    className="flex items-center justify-between gap-2 text-sm"
                                    data-testid={`movement-product-${idx}-${p.productId}`}
                                  >
                                    <div className="min-w-0">
                                      <span className="truncate block">{p.name}</span>
                                      <span className="text-xs text-muted-foreground">{p.sku}</span>
                                    </div>
                                    <span className="tabular-nums font-medium flex-shrink-0">{p.qty}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StockProjectionResult } from "@shared/stock-projection";
import { formatDayFull } from "./projection-utils";

interface Props {
  result: StockProjectionResult;
}

const SOURCE_LABEL: Record<string, string> = {
  request: "Requisição",
  loading_order: "Ordem",
  movement: "Movimentação",
};

export function ProjectionMovements({ result }: Props) {
  const rows = result.consideredMovements;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhuma movimentação considerada com os filtros atuais.
      </p>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          <Table data-testid="table-considered-movements">
            <TableHeader>
              <TableRow>
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
              {rows.map((m, idx) => (
                <TableRow key={`${m.source}-${m.sourceId}-${idx}`} data-testid={`row-movement-${idx}`}>
                  <TableCell className="text-muted-foreground">
                    {SOURCE_LABEL[m.source] || m.source}
                  </TableCell>
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
                    {m.alreadyPhysical ? (
                      <Badge className="bg-chart-4/20 text-chart-4 border border-chart-4/30 text-xs">
                        Já movimentado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Previsto
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

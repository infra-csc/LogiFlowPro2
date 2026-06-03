import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StockProjectionResult } from "@shared/stock-projection";
import { cellToneClass, formatDay, statusBadgeClass, statusLabel } from "./projection-utils";

interface Props {
  result: StockProjectionResult;
}

export function ProjectionMatrix({ result }: Props) {
  const { rangeDays, products } = result;

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhum produto com movimentação no período selecionado.
      </p>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          <table className="w-full border-collapse text-sm" data-testid="table-projection-matrix">
            <thead>
              <tr className="border-b border-border/60">
                <th className="sticky left-0 z-10 bg-card text-left font-semibold px-3 py-2 min-w-[220px]">
                  Produto
                </th>
                <th className="text-right font-semibold px-2 py-2 whitespace-nowrap">Atual</th>
                {rangeDays.map((d) => (
                  <th
                    key={d}
                    className="text-right font-medium text-muted-foreground px-2 py-2 whitespace-nowrap"
                  >
                    {formatDay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.productId}
                  className="border-b border-border/40"
                  data-testid={`row-matrix-${p.productId}`}
                >
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top min-w-[220px]">
                    <div className="flex items-start gap-2">
                      <Badge className={`${statusBadgeClass(p.worstStatus)} text-xs mt-0.5`}>
                        {statusLabel(p.worstStatus)}
                      </Badge>
                      <div className="min-w-0">
                        <div className="font-medium leading-tight truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku} · mín. {p.minimumStock} {p.unit}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-2 py-2 tabular-nums text-muted-foreground">
                    {p.currentStock}
                  </td>
                  {p.days.map((c) => (
                    <td
                      key={c.date}
                      className={`text-right px-2 py-2 tabular-nums whitespace-nowrap ${cellToneClass(c.status)}`}
                      title={`Abertura ${c.opening} · Saída ${c.outbound} · Entrada ${c.inbound} · Saldo ${c.available}`}
                    >
                      {c.available}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

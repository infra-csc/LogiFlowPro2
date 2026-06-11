import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Lightbulb,
  Package,
} from "lucide-react";
import type {
  ProjectionConflict,
  ProjectionDayCell,
  ProjectionLink,
  ProjectionProduct,
} from "@shared/stock-projection";
import {
  cellHeatClass,
  formatDay,
  formatDayFull,
  isToday,
  isWeekend,
  sourceLabel,
  statusBadgeClassExt,
  statusLabelExt,
} from "./projection-utils";

export type DetailTarget =
  | { kind: "cell"; product: ProjectionProduct; cell: ProjectionDayCell }
  | { kind: "product"; product: ProjectionProduct }
  | { kind: "conflict"; conflict: ProjectionConflict };

interface Props {
  target: DetailTarget | null;
  onClose: () => void;
  onGoToProduct?: (productId: string) => void;
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm tabular-nums font-medium ${tone || ""}`}>{value}</span>
    </div>
  );
}

function LinkRow({ links }: { links?: ProjectionLink[] }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l, i) =>
        l.href ? (
          <Link key={`${l.type}-${l.id}-${i}`} href={l.href}>
            <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`drawer-link-${l.type}-${l.id}`}>
              <ExternalLink className="w-3 h-3 mr-1" />
              {l.label}
            </Button>
          </Link>
        ) : (
          <Badge key={`${l.type}-${l.id}-${i}`} variant="secondary" className="text-xs">
            {l.label}
          </Badge>
        ),
      )}
    </div>
  );
}

function CellBody({
  product,
  cell,
  onGoToProduct,
}: {
  product: ProjectionProduct;
  cell: ProjectionDayCell;
  onGoToProduct?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{product.sku}</p>
          <p className="font-semibold">{product.name}</p>
        </div>
        {(() => {
          const impact = cell.outbound > 0 || cell.inbound > 0 || cell.inEvent > 0 || cell.reserved > 0 || cell.inTransit > 0;
          return (
            <Badge className={`${statusBadgeClassExt(cell.status, cell.available, product.minimumStock, impact)} text-xs`}>
              {statusLabelExt(cell.status, cell.available, product.minimumStock, impact)}
            </Badge>
          );
        })()}
      </div>
      <div className="rounded-md border border-border/60 p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{formatDayFull(cell.date)}</span>
          <span className="text-xs text-muted-foreground">mín. {product.minimumStock}</span>
        </div>
        <Separator className="my-2" />
        <Row label="Abertura" value={cell.opening} />
        <Row label="Saída" value={cell.outbound > 0 ? `-${cell.outbound}` : "0"} tone="text-destructive" />
        <Row label="Entrada" value={cell.inbound > 0 ? `+${cell.inbound}` : "0"} tone="text-chart-4" />
        <Separator className="my-2" />
        <Row label="Disponível" value={cell.available} tone="font-semibold" />
        <Row label="Reservado" value={cell.reserved} />
        <Row label="Em trânsito" value={cell.inTransit} />
        <Row label="Em evento" value={cell.inEvent} />
        {(cell.inEvent > 0 || cell.reserved > 0 || cell.inTransit > 0) && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Em evento, reservado e em trânsito indicam comprometimentos operacionais do saldo projetado.
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Fontes do impacto</p>
        {cell.drivers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum movimento neste dia.</p>
        ) : (
          <div className="space-y-1.5">
            {cell.drivers.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 p-2"
                data-testid={`drawer-driver-${i}`}
              >
                <div className="min-w-0">
                  <p className="text-sm truncate">{d.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {sourceLabel(d.source)}
                    {d.eventName ? ` · ${d.eventName}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-sm tabular-nums font-medium flex-shrink-0 ${
                    d.direction === "outbound" ? "text-destructive" : "text-chart-4"
                  }`}
                >
                  {d.direction === "outbound" ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  )}
                  {d.direction === "outbound" ? `-${d.qty}` : `+${d.qty}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {onGoToProduct && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onGoToProduct(product.productId)}
          data-testid="drawer-goto-product"
        >
          <Package className="w-4 h-4 mr-1.5" />
          Ver na aba Por Produto
        </Button>
      )}
    </div>
  );
}

function ProductBody({
  product,
  onGoToProduct,
}: {
  product: ProjectionProduct;
  onGoToProduct?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{product.sku}</p>
          <p className="font-semibold">{product.name}</p>
        </div>
        <Badge className={`${statusBadgeClassExt(product.worstStatus, product.currentStock, product.minimumStock, product.totalOutbound > 0 || product.totalInbound > 0)} text-xs`}>
          {statusLabelExt(product.worstStatus, product.currentStock, product.minimumStock, product.totalOutbound > 0 || product.totalInbound > 0)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { l: "Estoque atual", v: product.currentStock },
          { l: "Mínimo", v: product.minimumStock },
          { l: "Pior saldo", v: product.minAvailable },
          {
            l: "Déficit máx.",
            v: product.maxDeficit,
            tone: product.maxDeficit > 0 ? "text-destructive" : "",
          },
          { l: "Saídas", v: product.totalOutbound, tone: "text-destructive" },
          { l: "Entradas", v: product.totalInbound, tone: "text-chart-4" },
        ].map((c) => (
          <div key={c.l} className="rounded-md border border-border/60 p-2.5">
            <div className={`text-lg font-bold tabular-nums ${c.tone || ""}`}>{c.v}</div>
            <div className="text-xs text-muted-foreground">{c.l}</div>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Linha do tempo do saldo</p>
        <div className="flex gap-1 overflow-x-auto projection-scroll pb-1" style={{ scrollbarWidth: "thin" }}>
          {product.days.map((c) => {
            const hasImpact = c.outbound !== 0 || c.inbound !== 0;
            return (
              <div key={c.date} className="flex flex-col items-center gap-1 flex-shrink-0 w-9">
                <div
                  className={`w-full text-center rounded px-1 py-1.5 text-xs tabular-nums ${cellHeatClass(
                    c.status,
                    hasImpact,
                  )}`}
                  title={`Saldo ${c.available}`}
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
            );
          })}
        </div>
      </div>

      {onGoToProduct && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onGoToProduct(product.productId)}
          data-testid="drawer-goto-product-full"
        >
          <Package className="w-4 h-4 mr-1.5" />
          Abrir análise completa
        </Button>
      )}
    </div>
  );
}

function ConflictBody({ conflict }: { conflict: ProjectionConflict }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {conflict.productName ? (
            <>
              <p className="text-xs text-muted-foreground">{conflict.sku}</p>
              <p className="font-semibold truncate">{conflict.productName}</p>
            </>
          ) : (
            <p className="font-semibold truncate">{conflict.sourceLabel}</p>
          )}
        </div>
        <Badge variant={conflict.severity === "error" ? "destructive" : "secondary"} className="text-xs">
          {conflict.severity === "error" ? "Conflito" : "Aviso"}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">{conflict.message}</p>

      <div className="rounded-md border border-border/60 p-3">
        {conflict.date && <Row label="Dia" value={formatDayFull(conflict.date)} />}
        {conflict.projectedBalance != null && <Row label="Saldo projetado" value={conflict.projectedBalance} />}
        {conflict.minimumStock != null && <Row label="Mínimo" value={conflict.minimumStock} />}
        {conflict.deficit != null && conflict.deficit > 0 && (
          <Row label="Déficit" value={conflict.deficit} tone="text-destructive" />
        )}
        {conflict.eventName && <Row label="Evento" value={conflict.eventName} />}
      </div>

      {conflict.suggestedAction && (
        <div className="flex items-start gap-2 rounded-md border border-chart-5/30 bg-chart-5/5 p-3">
          <Lightbulb className="w-4 h-4 text-chart-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{conflict.suggestedAction}</p>
        </div>
      )}

      <LinkRow links={conflict.links} />
    </div>
  );
}

export function ProjectionDetailDrawer({ target, onClose, onGoToProduct }: Props) {
  const title =
    target?.kind === "cell"
      ? "Detalhe do dia"
      : target?.kind === "product"
        ? "Detalhe do produto"
        : target?.kind === "conflict"
          ? "Detalhe do conflito"
          : "";

  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto projection-scroll" data-testid="projection-detail-drawer">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">Detalhamento da projeção de estoque</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {target?.kind === "cell" && (
            <CellBody product={target.product} cell={target.cell} onGoToProduct={onGoToProduct} />
          )}
          {target?.kind === "product" && <ProductBody product={target.product} onGoToProduct={onGoToProduct} />}
          {target?.kind === "conflict" && <ConflictBody conflict={target.conflict} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

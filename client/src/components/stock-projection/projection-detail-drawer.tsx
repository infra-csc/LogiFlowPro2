import { useState, useMemo } from "react";
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
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lightbulb,
  Package,
  MapPin,
  Calendar,
  Truck,
  Clock,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import type {
  ConsideredMovement,
  ProjectionConflict,
  ProjectionDayCell,
  ProjectionDriver,
  ProjectionProduct,
  ProjectionSource,
} from "@shared/stock-projection";
import {
  formatDay,
  formatDayFull,
  isToday,
  isWeekend,
  sourceLabel,
  situationLabel,
  situationBadgeClass,
  situationReason,
  statusBadgeClassExt,
  statusLabelExt,
} from "./projection-utils";

// ── Types ──────────────────────────────────────────────────────────────────────

export type DetailTarget =
  | { kind: "cell"; product: ProjectionProduct; cell: ProjectionDayCell }
  | { kind: "product"; product: ProjectionProduct }
  | { kind: "conflict"; conflict: ProjectionConflict };

interface Props {
  target: DetailTarget | null;
  onClose: () => void;
  onGoToProduct?: (productId: string) => void;
  consideredMovements?: ConsideredMovement[];
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function hrefForSource(source: ProjectionSource, sourceId: string): string {
  switch (source) {
    case "request": return `/requests/${sourceId}`;
    case "loading_order": return `/loading-orders/${sourceId}`;
    case "movement": return `/movements/${sourceId}`;
    case "trip": return `/trips`;
  }
}

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  return formatDayFull(d);
}

/** Deduplicate drivers across days, accumulating qty per source+direction. */
function deduplicateDrivers(product: ProjectionProduct): Map<string, ProjectionDriver & { totalQty: number; dates: string[] }> {
  const map = new Map<string, ProjectionDriver & { totalQty: number; dates: string[] }>();
  for (const day of product.days) {
    for (const d of day.drivers) {
      const key = `${d.source}::${d.sourceId}::${d.direction}`;
      if (!map.has(key)) {
        map.set(key, { ...d, totalQty: d.qty, dates: [day.date] });
      } else {
        const ex = map.get(key)!;
        ex.totalQty += d.qty;
        if (!ex.dates.includes(day.date)) ex.dates.push(day.date);
      }
    }
  }
  return map;
}

/** Filter consideredMovements for a specific product. */
function cmForProduct(cms: ConsideredMovement[] | undefined, productId: string): ConsideredMovement[] {
  if (!cms) return [];
  return cms.filter((c) => c.products.some((p) => p.productId === productId));
}

/** Find a ConsideredMovement matching a driver. */
function findCM(cms: ConsideredMovement[] | undefined, d: { source: ProjectionSource; sourceId: string }): ConsideredMovement | undefined {
  return cms?.find((c) => c.source === d.source && c.sourceId === d.sourceId);
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status, available, min }: { status: ProjectionDayCell["status"]; available: number; min: number }) {
  return (
    <Badge className={`${statusBadgeClassExt(status, available, min)} text-xs shrink-0`}>
      {statusLabelExt(status, available, min)}
    </Badge>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────

function ProductHeader({ product, status, available, dateLabel }: {
  product: ProjectionProduct;
  status: ProjectionDayCell["status"];
  available: number;
  dateLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-base leading-snug break-words">{product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {product.sku}
            {product.unit ? ` · Unidade: ${product.unit}` : ""}
          </p>
        </div>
        <StatusBadge status={status} available={available} min={product.minimumStock} />
      </div>
      {dateLabel && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {dateLabel}
        </p>
      )}
    </div>
  );
}

// ── KPI grid ───────────────────────────────────────────────────────────────────

function Kpi({ label, value, tone, sub }: { label: string; value: React.ReactNode; tone?: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-card p-3">
      <div className={`text-xl font-bold tabular-nums ${tone || ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground leading-tight mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Composition line ───────────────────────────────────────────────────────────

function CompositionLine({ available, inEvent, inTransit, reserved }: {
  available: number; inEvent: number; inTransit: number; reserved: number;
}) {
  const parts: string[] = [];
  parts.push(`${available} no CD`);
  if (inEvent > 0) parts.push(`${inEvent} em evento`);
  if (inTransit > 0) parts.push(`${inTransit} em trânsito`);
  if (reserved > 0) parts.push(`${reserved} reservado`);
  const total = available + inEvent + inTransit;
  return (
    <div className="rounded-md bg-muted/30 border border-border/40 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{total} total</span>
      {" = "}
      {parts.join(" + ")}
    </div>
  );
}

// ── Collapsible section ────────────────────────────────────────────────────────

function Section({ title, count, icon: Icon, children, defaultOpen = false, badge }: {
  title: string;
  count?: number;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/40">
      <button
        type="button"
        className="w-full flex items-center justify-between px-0 py-3 hover-elevate text-left"
        onClick={() => setOpen((p) => !p)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-primary/70 shrink-0" />
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs font-normal">{count}</Badge>
          )}
          {badge}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="pb-4 space-y-2">{children}</div>}
    </div>
  );
}

// ── Driver card (saídas / entradas) ────────────────────────────────────────────

function DriverCard({ d, cm, productId }: {
  d: ProjectionDriver & { totalQty: number; dates: string[] };
  cm: ConsideredMovement | undefined;
  productId: string;
}) {
  const isOut = d.direction === "outbound";
  const href = cm?.href || hrefForSource(d.source, d.sourceId);
  const productQtyInCm = cm?.products.find((p) => p.productId === productId)?.qty;

  return (
    <div className="rounded-md border border-border/50 p-3 space-y-2">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-tight break-words">{d.label}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
            <span>{sourceLabel(d.source)}</span>
            {d.eventName && <span>{d.eventName}</span>}
          </div>
        </div>
        <span className={`flex items-center gap-1 text-sm font-semibold tabular-nums shrink-0 ${isOut ? "text-destructive" : "text-chart-4"}`}>
          {isOut ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
          {isOut ? "-" : "+"}{productQtyInCm ?? d.totalQty}
        </span>
      </div>

      {/* Dates row */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">{isOut ? "Saída" : "Entrada"}: </span>
          <span className="font-medium">{fmtDateShort(cm?.outDate || d.outDate)}</span>
        </div>
        {isOut && (
          <div>
            <span className="text-muted-foreground">Retorno prev.: </span>
            <span className={`font-medium ${!cm?.inDate ? "text-amber-500" : ""}`}>
              {cm?.inDate ? fmtDateShort(cm.inDate) : "Não definido"}
            </span>
          </div>
        )}
        {!isOut && cm?.outDate && (
          <div>
            <span className="text-muted-foreground">Saída original: </span>
            <span className="font-medium">{fmtDateShort(cm.outDate)}</span>
          </div>
        )}
      </div>

      {/* Status + situation */}
      {cm && (
        <div className="flex flex-wrap items-center gap-1.5">
          {cm.status && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{cm.status}</Badge>
          )}
          <Badge className={`${situationBadgeClass(cm.situation)} text-[10px] px-1.5 py-0`}>
            {situationLabel(cm.situation)}
          </Badge>
          {cm.alreadyPhysical && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Realizada</Badge>
          )}
        </div>
      )}

      {/* Ignored reason */}
      {cm && (cm.situation === "ignored" || cm.situation === "no_date") && (
        <p className="text-xs text-muted-foreground italic">
          {situationReason(cm.situation, cm.outDate, cm.inDate)}
        </p>
      )}

      {/* Link */}
      {href && (
        <div>
          <Link href={href}>
            <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`driver-link-${d.source}-${d.sourceId}`}>
              <ExternalLink className="w-3 h-3 mr-1" />
              Abrir {sourceLabel(d.source)}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Em evento section ──────────────────────────────────────────────────────────

function InEventSection({ product, cms }: { product: ProjectionProduct; cms: ConsideredMovement[] }) {
  const lastDay = product.days[product.days.length - 1];
  const totalInEvent = lastDay?.inEvent ?? product.totalInEvent;
  if (totalInEvent === 0) return null;

  // Collect events that have outbound flows
  const eventMap = new Map<string, { eventName: string; qty: number; cm?: ConsideredMovement }>();
  for (const day of product.days) {
    for (const d of day.drivers) {
      if (d.direction === "outbound" && d.eventId && d.eventName) {
        const existing = eventMap.get(d.eventId);
        const cm = findCM(cms, d);
        if (!existing) {
          eventMap.set(d.eventId, { eventName: d.eventName, qty: d.qty, cm });
        } else {
          existing.qty += d.qty;
          if (!existing.cm && cm) existing.cm = cm;
        }
      }
    }
  }

  const events = Array.from(eventMap.values());

  return (
    <Section title="Em evento" count={events.length} icon={MapPin} defaultOpen={false}>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Total fora do CD: <span className="font-semibold text-foreground">{totalInEvent} un.</span>
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma unidade deste produto está identificada em evento.</p>
        ) : (
          events.map((ev, i) => {
            const prodQty = ev.cm?.products.find((p) => p.productId === product.productId)?.qty;
            return (
              <div key={i} className="rounded-md border border-border/50 bg-muted/10 p-3 space-y-2">
                <div className="text-sm font-medium leading-snug break-words">{ev.eventName}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Quantidade: </span>
                    <span className="font-semibold text-amber-400">{prodQty ?? ev.qty} un.</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Saída do CD: </span>
                    <span className="font-medium">{fmtDateShort(ev.cm?.outDate)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Retorno prev.: </span>
                    <span className={`font-medium ${!ev.cm?.inDate ? "text-amber-500" : ""}`}>
                      {ev.cm?.inDate ? fmtDateShort(ev.cm.inDate) : "Não definido"}
                    </span>
                  </div>
                  {ev.cm?.status && (
                    <div>
                      <span className="text-muted-foreground">Status: </span>
                      <span className="font-medium">{ev.cm.status}</span>
                    </div>
                  )}
                </div>
                {ev.cm?.href && (
                  <Link href={ev.cm.href}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <ExternalLink className="w-3 h-3 mr-1" /> Abrir origem
                    </Button>
                  </Link>
                )}
              </div>
            );
          })
        )}
      </div>
    </Section>
  );
}

// ── Operational timeline ───────────────────────────────────────────────────────

interface TimelineEntry {
  kind: "change" | "quiet";
  date?: string;
  fromDate?: string;
  toDate?: string;
  quietDays?: number;
  balance?: number;
  outbound?: number;
  inbound?: number;
  drivers?: ProjectionDriver[];
}

function buildTimeline(product: ProjectionProduct): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let lastChangeIdx = -1;

  for (let i = 0; i < product.days.length; i++) {
    const cell = product.days[i];
    const hasChange = cell.outbound !== 0 || cell.inbound !== 0;
    if (hasChange) {
      const gap = lastChangeIdx === -1 ? i : i - lastChangeIdx - 1;
      if (gap > 1 && lastChangeIdx >= 0) {
        const from = product.days[lastChangeIdx + 1];
        const to = product.days[i - 1];
        entries.push({
          kind: "quiet",
          fromDate: from.date,
          toDate: to.date,
          quietDays: gap,
          balance: from.available,
        });
      }
      entries.push({
        kind: "change",
        date: cell.date,
        outbound: cell.outbound,
        inbound: cell.inbound,
        balance: cell.available,
        drivers: cell.drivers,
      });
      lastChangeIdx = i;
    }
  }

  // Trailing quiet period
  if (lastChangeIdx >= 0 && lastChangeIdx < product.days.length - 1) {
    const from = product.days[lastChangeIdx + 1];
    const last = product.days[product.days.length - 1];
    const gap = product.days.length - 1 - lastChangeIdx;
    if (gap > 1) {
      entries.push({
        kind: "quiet",
        fromDate: from.date,
        toDate: last.date,
        quietDays: gap,
        balance: from.available,
      });
    }
  }

  return entries;
}

function TimelineSection({ product, cms }: { product: ProjectionProduct; cms: ConsideredMovement[] }) {
  const entries = useMemo(() => buildTimeline(product), [product]);
  const hasChanges = entries.some((e) => e.kind === "change");

  return (
    <Section title="Linha do tempo" icon={Clock} defaultOpen={false}>
      {!hasChanges ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma movimentação prevista no período. Saldo permanece em {product.currentStock} un.
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((e, i) => {
            if (e.kind === "quiet") {
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <div className="w-0.5 h-5 bg-border/40 mx-1 shrink-0" />
                  <span>
                    {e.quietDays}d sem alteração ({fmtDateShort(e.fromDate)} — {fmtDateShort(e.toDate)}) · saldo {e.balance}
                  </span>
                </div>
              );
            }
            const isOut = (e.outbound ?? 0) > 0 && (e.inbound ?? 0) === 0;
            const isIn = (e.inbound ?? 0) > 0 && (e.outbound ?? 0) === 0;
            const isBoth = (e.outbound ?? 0) > 0 && (e.inbound ?? 0) > 0;
            return (
              <div key={i} className={`rounded-md border p-3 space-y-1.5 ${
                isOut ? "border-destructive/30 bg-destructive/5"
                : isIn ? "border-chart-4/30 bg-chart-4/5"
                : isBoth ? "border-chart-5/30 bg-chart-5/5"
                : "border-border/40"
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {formatDayFull(e.date!)}
                    {isToday(e.date!) && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">Hoje</Badge>}
                  </span>
                  <div className="flex items-center gap-2 text-xs tabular-nums">
                    {(e.outbound ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-destructive font-semibold">
                        <ArrowUpRight className="w-3 h-3" />-{e.outbound}
                      </span>
                    )}
                    {(e.inbound ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-chart-4 font-semibold">
                        <ArrowDownLeft className="w-3 h-3" />+{e.inbound}
                      </span>
                    )}
                    <span className="text-muted-foreground">→ {e.balance}</span>
                  </div>
                </div>
                {e.drivers && e.drivers.length > 0 && (
                  <div className="space-y-1">
                    {e.drivers.map((d, j) => {
                      const cm = findCM(cms, d);
                      return (
                        <div key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className={d.direction === "outbound" ? "text-destructive" : "text-chart-4"}>
                            {d.direction === "outbound" ? "↑" : "↓"}
                          </span>
                          <span className="flex-1 min-w-0 break-words">{d.label}</span>
                          <span className="font-medium tabular-nums shrink-0">{d.qty}</span>
                          {cm?.href && (
                            <Link href={cm.href}>
                              <ExternalLink className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ── Fontes do impacto ──────────────────────────────────────────────────────────

function FontesSection({ cms }: { cms: ConsideredMovement[] }) {
  if (cms.length === 0) {
    return (
      <Section title="Fontes do impacto" icon={BarChart3} defaultOpen={false}>
        <p className="text-xs text-muted-foreground">
          Este produto não possui requisições, movimentações, ordens ou viagens impactando o período selecionado.
        </p>
      </Section>
    );
  }

  const grouped = useMemo(() => {
    const map = new Map<ProjectionSource, ConsideredMovement[]>();
    for (const cm of cms) {
      if (!map.has(cm.source)) map.set(cm.source, []);
      map.get(cm.source)!.push(cm);
    }
    return map;
  }, [cms]);

  const ORDER: ProjectionSource[] = ["movement", "loading_order", "request", "trip"];

  return (
    <Section title="Fontes do impacto" count={cms.length} icon={BarChart3} defaultOpen={false}>
      <div className="space-y-3">
        {ORDER.filter((src) => grouped.has(src)).map((src) => (
          <div key={src}>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">{sourceLabel(src)}</p>
            <div className="space-y-1.5">
              {grouped.get(src)!.map((cm, i) => (
                <div key={i} className="rounded-md border border-border/50 p-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium break-words leading-tight">{cm.label}</p>
                      {cm.eventName && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{cm.eventName}</p>
                      )}
                    </div>
                    <Badge className={`${situationBadgeClass(cm.situation)} text-[10px] px-1.5 py-0 shrink-0`}>
                      {situationLabel(cm.situation)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 text-[10px] text-muted-foreground">
                    <span>Saída: <span className="text-foreground font-medium">{fmtDateShort(cm.outDate)}</span></span>
                    <span>Retorno: <span className={`font-medium ${!cm.inDate ? "text-amber-500" : "text-foreground"}`}>{fmtDateShort(cm.inDate)}</span></span>
                    <span>Qtd: <span className="text-foreground font-medium">
                      {cm.products.reduce((a, p) => a + p.qty, 0)}
                    </span></span>
                    {cm.alreadyPhysical && <span className="text-chart-4">Realizado fisicamente</span>}
                  </div>
                  {(cm.situation === "ignored" || cm.situation === "no_date") && (
                    <p className="text-[10px] text-muted-foreground italic">
                      {situationReason(cm.situation, cm.outDate, cm.inDate)}
                    </p>
                  )}
                  {(cm.href || cm.sourceId) && (
                    <Link href={cm.href || hrefForSource(cm.source, cm.sourceId)}>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2 -ml-1">
                        <ExternalLink className="w-3 h-3 mr-1" />Abrir
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Cell position box ──────────────────────────────────────────────────────────

function CellPositionBox({ cell }: { cell: ProjectionDayCell }) {
  const availableInCD = cell.available;
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border/60 p-3 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground font-medium pb-1 border-b border-border/30">
          <span>Abertura do dia</span>
          <span className="tabular-nums">{cell.opening}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Saídas</span>
          <span className={`tabular-nums font-medium ${cell.outbound > 0 ? "text-destructive" : "text-muted-foreground/50"}`}>
            {cell.outbound > 0 ? `-${cell.outbound}` : "0"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Entradas / retornos</span>
          <span className={`tabular-nums font-medium ${cell.inbound > 0 ? "text-chart-4" : "text-muted-foreground/50"}`}>
            {cell.inbound > 0 ? `+${cell.inbound}` : "0"}
          </span>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between text-sm font-semibold">
          <span>Disponível no CD</span>
          <span className={`tabular-nums ${availableInCD < 0 ? "text-destructive" : ""}`}>{availableInCD}</span>
        </div>
      </div>

      {/* Overlays */}
      {(cell.inEvent > 0 || cell.inTransit > 0 || cell.reserved > 0) && (
        <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Fora do saldo disponível</p>
          {cell.inEvent > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Em evento</span>
              <span className="font-medium tabular-nums text-amber-400">{cell.inEvent}</span>
            </div>
          )}
          {cell.inTransit > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> Em trânsito</span>
              <span className="font-medium tabular-nums">{cell.inTransit}</span>
            </div>
          )}
          {cell.reserved > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Reservado</span>
              <span className="font-medium tabular-nums">{cell.reserved}</span>
            </div>
          )}
        </div>
      )}

      <CompositionLine
        available={availableInCD}
        inEvent={cell.inEvent}
        inTransit={cell.inTransit}
        reserved={cell.reserved}
      />
    </div>
  );
}

// ── CellBody ───────────────────────────────────────────────────────────────────

function CellBody({ product, cell, onGoToProduct, cms }: {
  product: ProjectionProduct;
  cell: ProjectionDayCell;
  onGoToProduct?: (id: string) => void;
  cms: ConsideredMovement[];
}) {
  const outDrivers = cell.drivers.filter((d) => d.direction === "outbound");
  const inDrivers = cell.drivers.filter((d) => d.direction === "inbound");

  return (
    <div className="px-5 py-4 space-y-4">
      <ProductHeader
        product={product}
        status={cell.status}
        available={cell.available}
        dateLabel={`Posição em ${formatDayFull(cell.date)}`}
      />

      <CellPositionBox cell={cell} />

      {/* Drivers deste dia */}
      <div className="space-y-3">
        {/* Saídas do dia */}
        {outDrivers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
              Saídas neste dia — {cell.outbound} un.
            </p>
            <div className="space-y-2">
              {outDrivers.map((d, i) => {
                const deduplicated = { ...d, totalQty: d.qty, dates: [cell.date] };
                return <DriverCard key={i} d={deduplicated} cm={findCM(cms, d)} productId={product.productId} />;
              })}
            </div>
          </div>
        )}

        {/* Entradas do dia */}
        {inDrivers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5 text-chart-4" />
              Entradas / retornos neste dia — {cell.inbound} un.
            </p>
            <div className="space-y-2">
              {inDrivers.map((d, i) => {
                const deduplicated = { ...d, totalQty: d.qty, dates: [cell.date] };
                return <DriverCard key={i} d={deduplicated} cm={findCM(cms, d)} productId={product.productId} />;
              })}
            </div>
          </div>
        )}

        {outDrivers.length === 0 && inDrivers.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada neste dia.</p>
        )}
      </div>

      {/* Link to product view */}
      {onGoToProduct && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onGoToProduct(product.productId)}
          data-testid="drawer-goto-product"
        >
          <Package className="w-4 h-4 mr-1.5" />
          Ver análise completa do produto
        </Button>
      )}
    </div>
  );
}

// ── ProductBody ────────────────────────────────────────────────────────────────

function ProductBody({ product, onGoToProduct, cms }: {
  product: ProjectionProduct;
  onGoToProduct?: (id: string) => void;
  cms: ConsideredMovement[];
}) {
  const lastDay = product.days[product.days.length - 1];
  const lastAvailable = lastDay?.available ?? product.currentStock;
  const lastStatus = lastDay?.status ?? "ok";

  const deduped = useMemo(() => deduplicateDrivers(product), [product]);
  const outDrivers = useMemo(
    () => Array.from(deduped.values()).filter((d) => d.direction === "outbound"),
    [deduped],
  );
  const inDrivers = useMemo(
    () => Array.from(deduped.values()).filter((d) => d.direction === "inbound"),
    [deduped],
  );

  const totalOutboundUnits = outDrivers.reduce((a, d) => {
    const productQty = findCM(cms, d)?.products.find((p) => p.productId === product.productId)?.qty;
    return a + (productQty ?? d.totalQty);
  }, 0);
  const totalInboundUnits = inDrivers.reduce((a, d) => {
    const productQty = findCM(cms, d)?.products.find((p) => p.productId === product.productId)?.qty;
    return a + (productQty ?? d.totalQty);
  }, 0);

  return (
    <div className="px-5 py-4 space-y-4">
      <ProductHeader
        product={product}
        status={lastStatus}
        available={lastAvailable}
        dateLabel="Visão geral do período"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Disponível no CD (atual)" value={product.currentStock} />
        <Kpi
          label="Saídas no período"
          value={totalOutboundUnits || product.totalOutbound}
          tone={product.totalOutbound > 0 ? "text-destructive" : ""}
        />
        <Kpi
          label="Entradas / retornos"
          value={totalInboundUnits || product.totalInbound}
          tone={product.totalInbound > 0 ? "text-chart-4" : ""}
        />
        {product.totalInEvent > 0 ? (
          <Kpi label="Em evento (pico)" value={product.totalInEvent} tone="text-amber-400" />
        ) : (
          <Kpi label="Em evento (pico)" value={0} tone="text-muted-foreground/50" />
        )}
      </div>

      {/* Composition */}
      {lastDay && (
        <CompositionLine
          available={lastDay.available}
          inEvent={lastDay.inEvent}
          inTransit={lastDay.inTransit}
          reserved={lastDay.reserved}
        />
      )}

      {/* Saídas */}
      <Section
        title="Saídas"
        count={outDrivers.length}
        icon={ArrowUpRight}
        defaultOpen={false}
        badge={outDrivers.length === 0 ? undefined : (
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {totalOutboundUnits || product.totalOutbound} un. em {outDrivers.length} operação{outDrivers.length !== 1 ? "ões" : ""}
          </span>
        )}
      >
        {outDrivers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma saída prevista ou realizada no período selecionado.</p>
        ) : (
          outDrivers.map((d, i) => (
            <DriverCard key={i} d={d} cm={findCM(cms, d)} productId={product.productId} />
          ))
        )}
      </Section>

      {/* Entradas */}
      <Section
        title="Entradas e retornos"
        count={inDrivers.length}
        icon={ArrowDownLeft}
        defaultOpen={false}
        badge={inDrivers.length === 0 ? undefined : (
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {totalInboundUnits || product.totalInbound} un.
          </span>
        )}
      >
        {inDrivers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma entrada ou retorno previsto no período selecionado.</p>
        ) : (
          inDrivers.map((d, i) => (
            <DriverCard key={i} d={d} cm={findCM(cms, d)} productId={product.productId} />
          ))
        )}
      </Section>

      {/* Em evento */}
      <InEventSection product={product} cms={cms} />

      {/* Timeline */}
      <TimelineSection product={product} cms={cms} />

      {/* Fontes */}
      <FontesSection cms={cms} />

      {/* Action */}
      {onGoToProduct && (
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onGoToProduct(product.productId)}
            data-testid="drawer-goto-product-full"
          >
            <Package className="w-4 h-4 mr-1.5" />
            Abrir análise completa do produto
          </Button>
        </div>
      )}
    </div>
  );
}

// ── ConflictBody ───────────────────────────────────────────────────────────────

function ConflictBody({ conflict }: { conflict: ProjectionConflict }) {
  return (
    <div className="px-5 py-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {conflict.productName ? (
            <>
              <p className="text-xs text-muted-foreground">{conflict.sku}</p>
              <p className="font-semibold break-words">{conflict.productName}</p>
            </>
          ) : (
            <p className="font-semibold break-words">{conflict.sourceLabel}</p>
          )}
        </div>
        <Badge variant={conflict.severity === "error" ? "destructive" : "secondary"} className="text-xs shrink-0">
          {conflict.severity === "error" ? "Conflito" : "Aviso"}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">{conflict.message}</p>

      <div className="rounded-md border border-border/60 p-3 space-y-1">
        {conflict.date && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Dia</span>
            <span className="font-medium">{formatDayFull(conflict.date)}</span>
          </div>
        )}
        {conflict.projectedBalance != null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Saldo projetado</span>
            <span className={`font-medium tabular-nums ${conflict.projectedBalance < 0 ? "text-destructive" : ""}`}>
              {conflict.projectedBalance}
            </span>
          </div>
        )}
        {conflict.deficit != null && conflict.deficit > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Déficit</span>
            <span className="font-medium tabular-nums text-destructive">{conflict.deficit}</span>
          </div>
        )}
        {conflict.eventName && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Evento</span>
            <span className="font-medium text-right break-words max-w-[60%]">{conflict.eventName}</span>
          </div>
        )}
      </div>

      {conflict.suggestedAction && (
        <div className="flex items-start gap-2 rounded-md border border-chart-5/30 bg-chart-5/5 p-3">
          <Lightbulb className="w-4 h-4 text-chart-5 shrink-0 mt-0.5" />
          <p className="text-sm">{conflict.suggestedAction}</p>
        </div>
      )}

      {conflict.links && conflict.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {conflict.links.map((l, i) =>
            l.href ? (
              <Link key={i} href={l.href}>
                <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`conflict-link-${l.type}-${l.id}`}>
                  <ExternalLink className="w-3 h-3 mr-1" />{l.label}
                </Button>
              </Link>
            ) : (
              <Badge key={i} variant="secondary" className="text-xs">{l.label}</Badge>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export function ProjectionDetailDrawer({ target, onClose, onGoToProduct, consideredMovements }: Props) {
  const title =
    target?.kind === "cell"
      ? `Detalhe — ${target.product.name}`
      : target?.kind === "product"
        ? `Produto — ${target.product.name}`
        : target?.kind === "conflict"
          ? "Detalhe do conflito"
          : "";

  const productCms = useMemo(() => {
    if (!target || target.kind === "conflict") return [];
    const pid = target.kind === "cell" ? target.product.productId : target.product.productId;
    return cmForProduct(consideredMovements, pid);
  }, [target, consideredMovements]);

  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="w-full sm:w-[520px] p-0 flex flex-col"
        data-testid="projection-detail-drawer"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40 flex-shrink-0">
          <SheetTitle className="text-sm font-semibold leading-snug break-words pr-6">{title}</SheetTitle>
          <SheetDescription className="sr-only">Detalhamento da projeção de estoque</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {target?.kind === "cell" && (
            <CellBody
              product={target.product}
              cell={target.cell}
              onGoToProduct={onGoToProduct}
              cms={productCms}
            />
          )}
          {target?.kind === "product" && (
            <ProductBody
              product={target.product}
              onGoToProduct={onGoToProduct}
              cms={productCms}
            />
          )}
          {target?.kind === "conflict" && (
            <ConflictBody conflict={target.conflict} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

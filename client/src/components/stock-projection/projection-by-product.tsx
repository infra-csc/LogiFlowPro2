import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Package, ExternalLink, ChevronsUpDown, Check, Search, X, Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectionDriver, ProjectionProduct, StockProjectionResult } from "@shared/stock-projection";
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
    case "loading_order": return `/loading-orders/${d.sourceId}`;
    case "movement": return `/movements/${d.sourceId}`;
    case "request": return `/requests/${d.sourceId}`;
    case "trip": return `/trips`;
    default: return undefined;
  }
}

// ── Combobox helpers ──────────────────────────────────────────────────────────

function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function productStatusDotClass(p: ProjectionProduct): string {
  if (p.worstStatus === "shortage" || p.maxDeficit > 0) return "bg-destructive";
  if (p.worstStatus === "low") return "bg-chart-5";
  if (p.currentStock === 0) return "bg-muted-foreground/40";
  return "bg-chart-4";
}

function productStockLabel(p: ProjectionProduct): string {
  if (p.currentStock <= 0) return "sem estoque";
  return `${p.currentStock} ${p.unit || "un"}. disponíveis`;
}

function sortFilterProducts(products: ProjectionProduct[], query: string): ProjectionProduct[] {
  if (!query.trim()) {
    return [...products].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  const normQ = normalizeSearch(query.trim());
  const scored = products
    .map((p) => {
      const normName = normalizeSearch(p.name);
      const normSku = normalizeSearch(p.sku);
      let score = 99;
      if (normSku === normQ) score = 0;
      else if (normName.startsWith(normQ) || normSku.startsWith(normQ)) score = 1;
      else if (normName.includes(normQ)) score = 2;
      else if (normSku.includes(normQ)) score = 3;
      return { p, score };
    })
    .filter(({ score }) => score < 99);
  scored.sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name, "pt-BR"));
  return scored.map(({ p }) => p);
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const normText = normalizeSearch(text);
  const normQ = normalizeSearch(query.trim());
  const idx = normText.indexOf(normQ);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-primary/25 text-foreground rounded-sm">{text.slice(idx, idx + normQ.length)}</span>
      {text.slice(idx + normQ.length)}
    </>
  );
}

// ── ProductCombobox ───────────────────────────────────────────────────────────

function ProductCombobox({
  products,
  value,
  onChange,
}: {
  products: ProjectionProduct[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedProduct = useMemo(() => products.find((p) => p.productId === value), [products, value]);

  // Debounce: 200 ms
  useEffect(() => {
    setIsDebouncing(true);
    const t = setTimeout(() => {
      setDebouncedQuery(rawQuery);
      setIsDebouncing(false);
    }, 200);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const filtered = useMemo(
    () => sortFilterProducts(products, debouncedQuery).slice(0, 100),
    [products, debouncedQuery],
  );

  // Reset highlight when results change
  useEffect(() => { setHighlightedIdx(0); }, [filtered]);

  // Open: focus input
  useEffect(() => {
    if (open) {
      setRawQuery("");
      setDebouncedQuery("");
      setHighlightedIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    const item = listRef.current?.children[highlightedIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedIdx]);

  function selectItem(id: string) {
    onChange(id);
    setOpen(false);
    setRawQuery("");
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightedIdx]) selectItem(filtered[highlightedIdx].productId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className="relative flex items-center w-full sm:w-[480px] min-h-[44px] gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm hover-elevate focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 text-left"
          data-testid="select-by-product"
        >
          <div className="flex-1 min-w-0">
            {selectedProduct ? (
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium text-foreground leading-snug truncate">{selectedProduct.name}</span>
                <span className="text-xs text-muted-foreground truncate">{selectedProduct.sku}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Selecione o produto...</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selectedProduct && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpar seleção"
                className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  const first = products[0];
                  if (first) onChange(first.productId);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    const first = products[0];
                    if (first) onChange(first.productId);
                  }
                }}
                data-testid="button-clear-product-select"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 w-[min(480px,calc(100vw-2rem))] shadow-lg"
        align="start"
        sideOffset={4}
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="product-combobox-panel"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
          {isDebouncing ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Buscar por nome, SKU ou código de barras..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
            data-testid="input-product-search"
            autoComplete="off"
          />
          {rawQuery && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setRawQuery(""); inputRef.current?.focus(); }}
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Produtos"
          className="overflow-y-auto"
          style={{ maxHeight: "340px", scrollbarWidth: "thin" }}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center px-4">
              <Package className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum produto encontrado</p>
              <p className="text-xs text-muted-foreground/70">Tente buscar por outro nome ou SKU.</p>
            </div>
          ) : (
            filtered.map((p, idx) => {
              const isSelected = p.productId === value;
              const isHighlighted = idx === highlightedIdx;
              const dotClass = productStatusDotClass(p);
              const stockLabel = productStockLabel(p);
              return (
                <button
                  key={p.productId}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isHighlighted ? "bg-accent" : ""
                  } ${isSelected ? "bg-primary/8" : ""}`}
                  onClick={() => selectItem(p.productId)}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  data-testid={`product-option-${p.productId}`}
                >
                  {/* Status dot */}
                  <div
                    className={`h-2 w-2 rounded-full shrink-0 mt-0.5 ${dotClass}`}
                    title={stockLabel}
                  />

                  {/* Two-line text */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground leading-snug truncate">
                      <HighlightText text={p.name} query={debouncedQuery} />
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight truncate mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">
                        <HighlightText text={p.sku} query={debouncedQuery} />
                      </span>
                      {p.unit && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>{p.unit}</span>
                        </>
                      )}
                      <span className="opacity-40">·</span>
                      <span className={p.currentStock <= 0 ? "text-muted-foreground/60 italic" : ""}>{stockLabel}</span>
                    </div>
                  </div>

                  {/* Selected checkmark */}
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer: result count */}
        {filtered.length > 0 && (
          <div className="px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground/60">
            {debouncedQuery
              ? `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""} para "${debouncedQuery}"`
              : `${filtered.length} produto${filtered.length !== 1 ? "s" : ""}`}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
      {/* Product selector */}
      <div className="space-y-1.5">
        <Label htmlFor="product-select">Produto</Label>
        <ProductCombobox
          products={products}
          value={internalId}
          onChange={handleChange}
        />
      </div>

      {product && (
        <p className="text-sm text-muted-foreground -mt-1" data-testid="by-product-summary">
          {product.totalOutbound === 0 && product.totalInbound === 0
            ? "Este produto não possui movimentações, requisições ou ordens impactando o saldo no período selecionado."
            : `${product.totalOutbound} saída(s) · ${product.totalInbound} entrada(s) · pior saldo: ${product.minAvailable}${worstDayDate ? ` em ${formatDayFull(worstDayDate)}` : ""}.`}
        </p>
      )}

      {product && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
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
            <Card className={product.totalInEvent > 0 ? "border-amber-500/40" : "border-border/60"}>
              <CardContent className="p-3">
                <div className={`text-xl font-bold tabular-nums ${product.totalInEvent > 0 ? "text-amber-400" : ""}`}>
                  {product.totalInEvent}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Em evento (pico)</div>
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
                        <div className="flex gap-0.5 h-2 items-center">
                          {c.outbound > 0 && <div className="w-1.5 h-1.5 rounded-full bg-destructive" title="Saída" />}
                          {c.inbound > 0 && <div className="w-1.5 h-1.5 rounded-full bg-chart-4" title="Entrada" />}
                          {!hasFlow && <div className="w-1.5 h-1.5 rounded-full bg-transparent" />}
                        </div>
                        <div
                          className={`w-full text-center rounded px-1 py-1.5 text-xs tabular-nums ${cellToneClass(c.status, c.available, product.minimumStock, hasFlow)} ${isWorst ? "ring-1 ring-destructive/60" : ""}`}
                          title={`Saldo ${c.available} · Saída ${c.outbound} · Entrada ${c.inbound}${isWorst ? " · Pior dia" : ""}`}
                        >
                          {c.available}
                        </div>
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

import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  Truck,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Barcode,
  MapPin,
  Layers,
  Info,
} from "lucide-react";
import type { Product } from "@shared/schema";

interface ProductHistoryModalProps {
  product: Product | undefined;
  onOpenChange: (open: boolean) => void;
}

interface MovementRow {
  id: string;
  movement_number: string;
  name: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  type_name: string | null;
  nature: "inbound" | "outbound" | null;
  quantity: number;
  event_name: string | null;
}

interface RequestRow {
  id: string;
  quantity: number;
  approved_quantity: number | null;
  approval_status: string;
  request_id: string;
  request_code: string;
  request_status: string;
  created_at: string;
  event_name: string | null;
}

interface Stats {
  movement_count: number;
  total_outbound: number;
  total_inbound: number;
  request_count: number;
}

interface HistoryData {
  product: Product;
  movements: MovementRow[];
  requests: RequestRow[];
  stats: Stats;
}

function ownershipLabel(o: string | null | undefined) {
  if (o === "owned") return { label: "Próprio", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30" };
  if (o === "rented") return { label: "Alugado", className: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30" };
  if (o === "third_party") return { label: "Terceiro", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" };
  return { label: o ?? "—", className: "" };
}

function movementStatusMeta(status: string) {
  switch (status) {
    case "completed": return { label: "Concluído", icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    case "in_progress": return { label: "Em andamento", icon: Activity, className: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30" };
    case "created": return { label: "Criado", icon: Clock, className: "text-muted-foreground bg-muted/40 border-border/50" };
    case "pending_approval": return { label: "Aguardando", icon: AlertCircle, className: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30" };
    case "approved": return { label: "Aprovado", icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    case "rejected": return { label: "Rejeitado", icon: XCircle, className: "text-destructive bg-destructive/10 border-destructive/30" };
    case "cancelled": return { label: "Cancelado", icon: XCircle, className: "text-muted-foreground bg-muted/40 border-border/50" };
    default: return { label: status, icon: Clock, className: "text-muted-foreground bg-muted/40 border-border/50" };
  }
}

function requestStatusMeta(status: string) {
  switch (status) {
    case "approved": return { label: "Aprovada", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" };
    case "partial": return { label: "Parcial", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" };
    case "pending": return { label: "Pendente", className: "bg-muted/60 text-muted-foreground border-border/50" };
    case "rejected": return { label: "Rejeitada", className: "bg-destructive/10 text-destructive border-destructive/30" };
    default: return { label: status, className: "bg-muted/60 text-muted-foreground border-border/50" };
  }
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem. atrás`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} mes. atrás`;
  return `${Math.floor(diffDays / 365)} ano(s) atrás`;
}

export function ProductHistoryModal({ product, onOpenChange }: ProductHistoryModalProps) {
  const open = !!product;

  const { data, isLoading } = useQuery<HistoryData>({
    queryKey: ["/api/products", product?.id, "history"],
    enabled: !!product?.id,
  });

  if (!product) return null;

  const ob = ownershipLabel(product.ownership);
  const isLow = product.minimumStock != null && (product.currentStock ?? 0) < product.minimumStock && (product.currentStock ?? 0) > 0;
  const isZero = (product.currentStock ?? 0) === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 p-5 border-b border-border/60 shrink-0">
          {/* Thumbnail */}
          <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="h-7 w-7 text-muted-foreground/30" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <DialogHeader className="p-0">
              <DialogTitle className="text-lg font-bold leading-snug line-clamp-2 text-left">
                {product.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
              {product.barcode && (
                <span className="font-mono text-xs text-muted-foreground flex items-center gap-0.5">
                  <Barcode className="h-3 w-3" />{product.barcode}
                </span>
              )}
              <Badge variant="outline" className={`text-[10px] ${ob.className}`}>{ob.label}</Badge>
            </div>
          </div>

          {/* Stock pill */}
          <div className="shrink-0 text-right">
            <div className={`text-2xl font-bold tabular-nums leading-none ${isZero ? "text-destructive" : isLow ? "text-amber-500" : "text-foreground"}`}>
              {product.currentStock ?? 0}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{product.unit ?? "unid."}</div>
            {isZero && <Badge variant="outline" className="text-[9px] mt-1 bg-destructive/10 text-destructive border-destructive/30">Sem estoque</Badge>}
            {isLow && !isZero && <Badge variant="outline" className="text-[9px] mt-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">Estoque baixo</Badge>}
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 divide-x divide-border/40 border-b border-border/60 shrink-0">
          {[
            {
              icon: Truck,
              label: "Movimentações",
              value: isLoading ? "—" : String(data?.stats.movement_count ?? 0),
              color: "text-foreground",
            },
            {
              icon: TrendingUp,
              label: "Total saídas",
              value: isLoading ? "—" : String(data?.stats.total_outbound ?? 0),
              color: "text-blue-500",
              unit: product.unit ?? "un",
            },
            {
              icon: TrendingDown,
              label: "Total entradas",
              value: isLoading ? "—" : String(data?.stats.total_inbound ?? 0),
              color: "text-emerald-500",
              unit: product.unit ?? "un",
            },
            {
              icon: ClipboardList,
              label: "Requisições",
              value: isLoading ? "—" : String(data?.stats.request_count ?? 0),
              color: "text-foreground",
            },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center justify-center py-3 px-2">
              <s.icon className={`h-4 w-4 mb-1 ${s.color}`} />
              <div className={`text-lg font-bold tabular-nums leading-none ${s.color}`}>{s.value}</div>
              {s.unit && <div className="text-[9px] text-muted-foreground">{s.unit}</div>}
              <div className="text-[10px] text-muted-foreground mt-0.5 text-center">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <Tabs defaultValue="movements" className="flex flex-col flex-1 min-h-0">
          <TabsList className="rounded-none border-b border-border/60 bg-transparent h-auto px-5 justify-start gap-0 shrink-0">
            {[
              { value: "movements", label: "Movimentações" },
              { value: "requests", label: "Requisições" },
              { value: "details", label: "Detalhes" },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Movimentações ── */}
          <TabsContent value="movements" className="flex-1 overflow-y-auto m-0 p-5" style={{ scrollbarWidth: "thin" }}>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-5 w-12" />
                  </div>
                ))}
              </div>
            ) : !data?.movements.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Truck className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">Nenhuma movimentação encontrada</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border/60" />
                <div className="space-y-1">
                  {data.movements.map((mv) => {
                    const isOut = mv.nature === "outbound";
                    const sm = movementStatusMeta(mv.status);
                    const StatusIcon = sm.icon;
                    return (
                      <div key={mv.id} className="relative flex items-start gap-3 pl-10 py-2.5 rounded-md hover-elevate group">
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-0 top-3 w-[30px] h-[30px] rounded-full flex items-center justify-center border-2 z-10 ${
                            isOut
                              ? "bg-blue-500/10 border-blue-500/40"
                              : mv.nature === "inbound"
                              ? "bg-emerald-500/10 border-emerald-500/40"
                              : "bg-muted border-border/60"
                          }`}
                        >
                          {isOut ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
                          ) : mv.nature === "inbound" ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Truck className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] text-muted-foreground">{mv.movement_number}</span>
                            {mv.type_name && (
                              <Badge variant="outline" className={`text-[10px] ${isOut ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"}`}>
                                {mv.type_name}
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-[10px] ${sm.className}`}>
                              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                              {sm.label}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-foreground mt-0.5 truncate">{mv.name}</p>
                          {mv.event_name && (
                            <p className="text-xs text-muted-foreground truncate">{mv.event_name}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{formatDateShort(mv.created_at)} · {formatDateRelative(mv.created_at)}</p>
                        </div>

                        {/* Quantity */}
                        <div className={`shrink-0 text-right ${isOut ? "text-blue-500" : mv.nature === "inbound" ? "text-emerald-500" : "text-foreground"}`}>
                          <div className="font-bold tabular-nums text-sm">
                            {isOut ? "−" : mv.nature === "inbound" ? "+" : ""}{mv.quantity}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{product.unit ?? "un"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Requisições ── */}
          <TabsContent value="requests" className="flex-1 overflow-y-auto m-0 p-5" style={{ scrollbarWidth: "thin" }}>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))}
              </div>
            ) : !data?.requests.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">Nenhuma requisição encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.requests.map((rq) => {
                  const rsm = requestStatusMeta(rq.request_status);
                  const approvedPct =
                    rq.approved_quantity != null && rq.quantity > 0
                      ? Math.round((rq.approved_quantity / rq.quantity) * 100)
                      : null;
                  return (
                    <Card key={rq.id} className="border-border/60">
                      <CardContent className="p-3 flex items-start gap-3">
                        <ClipboardList className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">{rq.request_code}</span>
                            <Badge variant="outline" className={`text-[10px] ${rsm.className}`}>{rsm.label}</Badge>
                          </div>
                          {rq.event_name && (
                            <p className="text-sm font-medium text-foreground mt-0.5 truncate">{rq.event_name}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{formatDateShort(rq.created_at)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold tabular-nums">
                            {rq.approved_quantity != null ? rq.approved_quantity : rq.quantity}
                            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{product.unit ?? "un"}</span>
                          </div>
                          {rq.approved_quantity != null && rq.approved_quantity !== rq.quantity && (
                            <div className="text-[10px] text-muted-foreground">
                              de {rq.quantity} sol.{approvedPct != null ? ` (${approvedPct}%)` : ""}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Detalhes ── */}
          <TabsContent value="details" className="flex-1 overflow-y-auto m-0 p-5" style={{ scrollbarWidth: "thin" }}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Layers, label: "Tipo", value: product.productType === "variante" ? "Variante" : "Principal" },
                { icon: Package, label: "Unidade", value: product.unit ?? "—" },
                { icon: Barcode, label: "Código de barras", value: product.barcode ?? "—" },
                { icon: MapPin, label: "Localização", value: product.location ?? "—" },
                { icon: TrendingDown, label: "Estoque mínimo", value: String(product.minimumStock ?? 0) },
                { icon: Info, label: "Titularidade", value: ownershipLabel(product.ownership).label },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-2.5 p-3 rounded-md bg-muted/30 border border-border/40">
                  <row.icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{row.label}</div>
                    <div className="text-sm font-medium text-foreground mt-0.5 break-words">{row.value}</div>
                  </div>
                </div>
              ))}
              {product.description && (
                <div className="col-span-2 flex items-start gap-2.5 p-3 rounded-md bg-muted/30 border border-border/40">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Descrição</div>
                    <div className="text-sm text-foreground mt-0.5">{product.description}</div>
                  </div>
                </div>
              )}
              {product.equivalentSku && (
                <div className="col-span-2 flex items-start gap-2.5 p-3 rounded-md bg-muted/30 border border-border/40">
                  <Barcode className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">SKU equivalente (principal)</div>
                    <div className="text-sm font-mono text-foreground mt-0.5">{product.equivalentSku}</div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

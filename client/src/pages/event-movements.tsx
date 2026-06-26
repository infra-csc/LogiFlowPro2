import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Download, Plus, Package, Boxes, TrendingDown, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, Activity, ChevronDown, ChevronRight,
  Truck, FileText, Building2, MapPin, Calendar, Search, X, Filter,
  MoreHorizontal, ClipboardList, RefreshCw, RotateCcw, ArrowRightLeft,
  Wrench, AlertCircle, Zap, ExternalLink, User, Info, History,
  ListChecks, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MovementDialog } from "@/components/movement-dialog";
import type { MovementPrefill } from "@/components/movement-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userCanCreateMovement } from "@/lib/authz";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventInfo {
  id: string; name: string; client: string; location: string;
  eventDate: string | null; status: string;
  requestCount: number; tripCount: number;
  lastMovementAt: string | null; calculatedAt: string;
}

interface EventProductStat {
  productId: string; name: string; sku: string; unit: string;
  ownership: string | null; category: string | null;
  requested: number; outbound: number; returned: number;
  inField: number; pendingExit: number; pendingResolution: number;
  situation: string; lastMovementAt: string | null;
  requests: Array<{ id: string; area: string | null; requestedByName: string; status: string }>;
}

interface EventMovementRow {
  id: string; movementNumber: string; name: string;
  typeName: string; nature: string; status: string;
  productCount: number; totalQty: number;
  createdAt: string | null; completedAt: string | null;
  createdByName: string | null;
}

interface DashboardTotals {
  distinctProducts: number; totalRequested: number; totalOutbound: number;
  totalReturned: number; totalInField: number; totalPendingExit: number;
  withPendingResolution: number;
}

interface DashboardData {
  event: EventInfo;
  products: EventProductStat[];
  movements: EventMovementRow[];
  totals: DashboardTotals;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function situationLabel(s: string): string {
  const map: Record<string, string> = {
    no_movement: "Sem movimentação",
    awaiting_exit: "Aguardando saída",
    partial_exit: "Saída parcial",
    in_field: "Em campo",
    partial_return: "Retorno parcial",
    returned: "Retornado",
    with_occurrence: "Com ocorrência",
  };
  return map[s] || s;
}

function situationVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "returned") return "default";
  if (s === "in_field" || s === "partial_exit" || s === "partial_return") return "secondary";
  if (s === "awaiting_exit") return "outline";
  if (s === "with_occurrence") return "destructive";
  return "outline";
}

function situationColorClass(s: string): string {
  const map: Record<string, string> = {
    returned: "text-emerald-600 dark:text-emerald-400",
    in_field: "text-amber-600 dark:text-amber-400",
    partial_return: "text-amber-600 dark:text-amber-400",
    partial_exit: "text-blue-600 dark:text-blue-400",
    awaiting_exit: "text-muted-foreground",
    with_occurrence: "text-red-600 dark:text-red-400",
    no_movement: "text-muted-foreground",
  };
  return map[s] || "text-muted-foreground";
}

function movStatusLabel(s: string): string {
  const map: Record<string, string> = {
    created: "Criada", in_progress: "Em andamento", paused: "Pausada",
    completed: "Concluída", cancelled: "Cancelada", pending_approval: "Aguardando aprovação",
  };
  return map[s] || s;
}

function movStatusColorClass(s: string): string {
  if (s === "completed") return "text-emerald-600 dark:text-emerald-400";
  if (s === "in_progress") return "text-amber-600 dark:text-amber-400";
  if (s === "cancelled") return "text-red-600 dark:text-red-400";
  if (s === "pending_approval") return "text-blue-600 dark:text-blue-400";
  return "text-muted-foreground";
}

function ownershipLabel(o: string | null): string {
  if (o === "owned") return "Próprio";
  if (o === "rented") return "Alugado";
  if (o === "third_party") return "Terceiro";
  return "—";
}

function fmtDate(val: string | null | undefined, withTime = false): string {
  if (!val) return "—";
  try {
    return format(new Date(val), withTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale: ptBR });
  } catch { return "—"; }
}

function fmtTime(val: string | null | undefined): string {
  if (!val) return "—";
  try { return format(new Date(val), "HH:mm", { locale: ptBR }); }
  catch { return "—"; }
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  colorClass?: string;
  active?: boolean;
  onClick?: () => void;
}

function SummaryCard({ label, value, sub, icon: Icon, colorClass = "text-muted-foreground", active, onClick }: SummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-all hover-elevate",
        active
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/60 bg-card",
      )}
      data-testid={`card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-none mb-1.5 truncate">
            {label}
          </p>
          <p className={cn("text-2xl font-bold leading-none tabular-nums", colorClass)}>
            {value}
          </p>
          {sub && <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{sub}</p>}
        </div>
        <div className={cn("rounded-md p-1.5 shrink-0", active ? "bg-primary/10" : "bg-muted/40")}>
          <Icon className={cn("h-3.5 w-3.5", active ? "text-primary" : colorClass)} />
        </div>
      </div>
    </button>
  );
}

// ─── SkeletonDashboard ────────────────────────────────────────────────────────

function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

// ─── ProductRow ───────────────────────────────────────────────────────────────

interface ProductRowProps {
  product: EventProductStat;
  eventId: string;
  eventName: string;
  onShortcut: (product: EventProductStat, shortcut: string) => void;
  onViewDetail: (product: EventProductStat) => void;
}

function ProductRow({ product: p, eventId, eventName, onShortcut, onViewDetail }: ProductRowProps) {
  const [expanded, setExpanded] = useState(false);

  const shortcuts = useMemo((): Array<{ id: string; label: string; icon: React.ElementType }> => {
    const all: Array<{ id: string; label: string; icon: React.ElementType; situations: string[] }> = [
      { id: "exit",          label: "Registrar saída",           icon: TrendingDown,    situations: ["awaiting_exit", "no_movement", "partial_exit"] },
      { id: "partial_exit",  label: "Registrar saída parcial",   icon: TrendingDown,    situations: ["awaiting_exit", "no_movement"] },
      { id: "return",        label: "Registrar retorno",         icon: TrendingUp,      situations: ["in_field", "partial_return", "partial_exit"] },
      { id: "partial_return",label: "Registrar retorno parcial", icon: TrendingUp,      situations: ["in_field"] },
      { id: "damage",        label: "Registrar avaria",          icon: AlertTriangle,   situations: ["in_field", "partial_return", "returned", "partial_exit"] },
      { id: "loss",          label: "Registrar perda/extravio",  icon: AlertCircle,     situations: ["in_field", "partial_return", "partial_exit"] },
      { id: "maintenance",   label: "Enviar para manutenção",    icon: Wrench,          situations: ["in_field", "returned", "partial_return"] },
      { id: "transfer",      label: "Transferir para evento",    icon: ArrowRightLeft,  situations: ["in_field", "partial_return"] },
      { id: "keep_field",    label: "Manter em campo",           icon: MapPin,          situations: ["in_field", "partial_return"] },
      { id: "resolve",       label: "Resolver pendência",        icon: CheckCircle2,    situations: ["partial_return", "partial_exit", "in_field"] },
    ];
    return all.filter((s) => s.situations.includes(p.situation));
  }, [p.situation]);

  const inFieldPct = p.outbound > 0 ? Math.round((p.inField / p.outbound) * 100) : 0;
  const returnedPct = p.outbound > 0 ? Math.round((p.returned / p.outbound) * 100) : 0;

  return (
    <>
      <tr
        className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
        data-testid={`row-product-${p.productId}`}
      >
        {/* Product name */}
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1.5">
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-90")} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight truncate max-w-[180px]">{p.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
            </div>
          </div>
        </td>

        {/* Situação */}
        <td className="py-2.5 px-3">
          <span className={cn("text-xs font-medium", situationColorClass(p.situation))}>
            {situationLabel(p.situation)}
          </span>
        </td>

        {/* Solicitado */}
        <td className="py-2.5 px-3 tabular-nums text-sm text-center">
          <span className="text-foreground font-medium">{p.requested || "—"}</span>
        </td>

        {/* Saída */}
        <td className="py-2.5 px-3 tabular-nums text-sm text-center">
          {p.outbound > 0
            ? <span className={p.outbound < p.requested ? "text-amber-600 dark:text-amber-400 font-medium" : "text-foreground font-medium"}>{p.outbound}</span>
            : <span className="text-muted-foreground">—</span>
          }
        </td>

        {/* Retornado */}
        <td className="py-2.5 px-3 tabular-nums text-sm text-center">
          {p.returned > 0
            ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{p.returned}</span>
            : <span className="text-muted-foreground">—</span>
          }
        </td>

        {/* Em campo */}
        <td className="py-2.5 px-3 tabular-nums text-sm text-center">
          {p.inField > 0
            ? <span className="text-amber-600 dark:text-amber-400 font-bold">{p.inField}</span>
            : <span className="text-muted-foreground">—</span>
          }
        </td>

        {/* Pendente saída */}
        <td className="py-2.5 px-3 tabular-nums text-sm text-center">
          {p.pendingExit > 0
            ? <span className="text-red-600 dark:text-red-400 font-medium">{p.pendingExit}</span>
            : <span className="text-muted-foreground">—</span>
          }
        </td>

        {/* Última movimentação */}
        <td className="py-2.5 px-3">
          <span className="text-xs text-muted-foreground">{fmtDate(p.lastMovementAt)}</span>
        </td>

        {/* Ações */}
        <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onViewDetail(p)}
              data-testid={`button-detail-${p.productId}`}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Detalhes
            </Button>
            {shortcuts.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1"
                    data-testid={`button-move-${p.productId}`}
                  >
                    <Zap className="h-3 w-3" />
                    Movimentar
                    <ChevronDown className="h-2.5 w-2.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {shortcuts.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <DropdownMenuItem
                        key={s.id}
                        onClick={() => onShortcut(p, s.id)}
                        data-testid={`shortcut-${s.id}-${p.productId}`}
                      >
                        <Icon className="h-3.5 w-3.5 mr-2 shrink-0" />
                        {s.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded details */}
      {expanded && (
        <tr className="border-b border-border/40 bg-muted/10">
          <td colSpan={9} className="py-0">
            <div className="px-8 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Resumo do produto */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resumo</p>
                {[
                  { label: "Solicitado", value: p.requested },
                  { label: "Saída confirmada", value: p.outbound },
                  { label: "Retornado ao CD", value: p.returned },
                  { label: "Em campo", value: p.inField },
                  { label: "Pend. de saída", value: p.pendingExit },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-xs gap-4">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
              </div>

              {/* Titularidade + categoria */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Produto</p>
                <div className="flex items-center justify-between text-xs gap-4">
                  <span className="text-muted-foreground">Titularidade</span>
                  <span className="font-medium">{ownershipLabel(p.ownership)}</span>
                </div>
                <div className="flex items-center justify-between text-xs gap-4">
                  <span className="text-muted-foreground">Categoria</span>
                  <span className="font-medium">{p.category || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs gap-4">
                  <span className="text-muted-foreground">Unidade</span>
                  <span className="font-medium">{p.unit || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs gap-4">
                  <span className="text-muted-foreground">Ult. movimentação</span>
                  <span className="font-medium">{fmtDate(p.lastMovementAt, true)}</span>
                </div>
              </div>

              {/* Requisições */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Requisições ({p.requests.length})
                </p>
                {p.requests.length === 0
                  ? <p className="text-xs text-muted-foreground italic">Nenhuma requisição vinculada.</p>
                  : p.requests.map((r) => (
                    <div key={r.id} className="flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="text-foreground font-medium leading-tight truncate">{r.area || "Sem área"}</p>
                        <p className="text-muted-foreground text-[10px]">{r.requestedByName || "—"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] shrink-0"
                        onClick={() => window.open(`/requests/${r.id}`, "_blank")}
                      >
                        Abrir
                      </Button>
                    </div>
                  ))
                }
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── ProductDetailDrawer ──────────────────────────────────────────────────────

interface ProductDetailDrawerProps {
  product: EventProductStat | null;
  eventName: string;
  onClose: () => void;
  onShortcut: (product: EventProductStat, shortcut: string) => void;
}

function ProductDetailDrawer({ product: p, eventName, onClose, onShortcut }: ProductDetailDrawerProps) {
  if (!p) return null;
  return (
    <Sheet open={!!p} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:w-[480px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base font-bold leading-tight">{p.name}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-mono">{p.sku}</Badge>
            <Badge variant="outline" className="text-[10px]">{ownershipLabel(p.ownership)}</Badge>
            <span className={cn("text-xs font-medium", situationColorClass(p.situation))}>
              {situationLabel(p.situation)}
            </span>
          </div>
        </SheetHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: "Solicitado", value: p.requested, color: "text-foreground" },
            { label: "Saída confirmada", value: p.outbound, color: "text-foreground" },
            { label: "Retornado ao CD", value: p.returned, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Em campo", value: p.inField, color: "text-amber-600 dark:text-amber-400" },
            { label: "Pend. de saída", value: p.pendingExit, color: p.pendingExit > 0 ? "text-red-500" : "text-muted-foreground" },
            { label: "Pend. resolução", value: p.pendingResolution, color: p.pendingResolution > 0 ? "text-amber-500" : "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-md border border-border/60 bg-card p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={cn("text-xl font-bold tabular-nums mt-0.5", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Where are the units */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Onde estão as unidades</p>
          <div className="space-y-1.5">
            {p.returned > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-foreground font-medium">{p.returned}</span>
                <span className="text-muted-foreground">retornadas ao CD</span>
              </div>
            )}
            {p.inField > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-foreground font-medium">{p.inField}</span>
                <span className="text-muted-foreground">em campo — {eventName}</span>
              </div>
            )}
            {p.pendingExit > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-foreground font-medium">{p.pendingExit}</span>
                <span className="text-muted-foreground">aguardando saída</span>
              </div>
            )}
            {p.outbound === 0 && p.requested === 0 && (
              <p className="text-xs text-muted-foreground italic">Sem movimentações registradas para este produto.</p>
            )}
          </div>
        </div>

        {/* Requisições */}
        {p.requests.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Requisições que geraram a demanda
            </p>
            <div className="space-y-2">
              {p.requests.map((r) => (
                <div key={r.id} className="rounded-md border border-border/60 bg-card p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight">{r.area || "Sem área"}</p>
                      <p className="text-[10px] text-muted-foreground">{r.requestedByName}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => window.open(`/requests/${r.id}`, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="border-t border-border/40 pt-3 mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Ações rápidas</p>
          <div className="flex flex-col gap-1.5">
            {p.situation === "awaiting_exit" || p.situation === "no_movement" ? (
              <Button
                size="sm"
                variant="outline"
                className="justify-start gap-2"
                onClick={() => { onClose(); onShortcut(p, "exit"); }}
              >
                <TrendingDown className="h-3.5 w-3.5" />
                Registrar saída
              </Button>
            ) : null}
            {(p.situation === "in_field" || p.situation === "partial_return") && (
              <Button
                size="sm"
                variant="outline"
                className="justify-start gap-2"
                onClick={() => { onClose(); onShortcut(p, "return"); }}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Registrar retorno
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="justify-start gap-2"
              onClick={() => window.open(`/movements?eventId=${p.productId}`, "_blank")}
            >
              <History className="h-3.5 w-3.5" />
              Ver todas as movimentações
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EventMovements() {
  const { id: eventId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("products");
  const [search, setSearch] = useState("");
  const [situationFilter, setSituationFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
  const [drawerProduct, setDrawerProduct] = useState<EventProductStat | null>(null);

  // Movement dialog state (prefill / controlled open)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movementPrefill, setMovementPrefill] = useState<MovementPrefill | null>(null);

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/events", eventId, "movements-dashboard"],
    enabled: !!eventId,
    refetchInterval: false,
  });

  // ── Shortcut handler ────────────────────────────────────────────────────────
  function handleShortcut(product: EventProductStat, shortcutId: string) {
    const eventName = data?.event.name || "evento";
    const qty = shortcutId === "exit" || shortcutId === "partial_exit"
      ? product.pendingExit || product.requested
      : shortcutId === "return" || shortcutId === "partial_return"
        ? product.inField
        : 1;

    const nameMap: Record<string, string> = {
      exit: `Saída — ${product.name}`,
      partial_exit: `Saída parcial — ${product.name}`,
      return: `Retorno — ${product.name}`,
      partial_return: `Retorno parcial — ${product.name}`,
      damage: `Avaria — ${product.name}`,
      loss: `Perda/Extravio — ${product.name}`,
      maintenance: `Manutenção — ${product.name}`,
      transfer: `Transferência — ${product.name}`,
      keep_field: `Prorrogação em campo — ${product.name}`,
      resolve: `Resolução de pendência — ${product.name}`,
    };

    const notesMap: Record<string, string> = {
      loss: "Este registro não descontará novamente a unidade do estoque, pois ela já saiu anteriormente. Apenas atualizará localização e situação.",
    };

    setMovementPrefill({
      name: nameMap[shortcutId] || `Movimentação — ${product.name}`,
      eventIds: eventId ? [eventId] : [],
      productItems: qty > 0 ? [{ productId: product.productId, quantity: qty }] : [],
      notes: notesMap[shortcutId],
      hint: `Movimentação iniciada pelo atalho do evento ${eventName}. Revise os campos, ajuste a quantidade e confirme.`,
    });
    setDialogOpen(true);
  }

  // ── Filter products ─────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!data) return [];
    let list = data.products;

    // Card filter
    if (activeCardFilter === "in_field") list = list.filter((p) => p.inField > 0);
    else if (activeCardFilter === "pending_exit") list = list.filter((p) => p.pendingExit > 0);
    else if (activeCardFilter === "returned") list = list.filter((p) => p.situation === "returned");
    else if (activeCardFilter === "pending_resolution") list = list.filter((p) => p.pendingResolution > 0);

    // Situation filter
    if (situationFilter !== "all") list = list.filter((p) => p.situation === situationFilter);

    // Ownership filter
    if (ownershipFilter !== "all") list = list.filter((p) => (p.ownership || "owned") === ownershipFilter);

    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [data, search, situationFilter, ownershipFilter, activeCardFilter]);

  // ── Export ──────────────────────────────────────────────────────────────────
  function exportExcel() {
    if (!data) return;
    const rows = data.products.map((p) => ({
      Produto: p.name,
      SKU: p.sku,
      Categoria: p.category || "",
      Titularidade: ownershipLabel(p.ownership),
      Solicitado: p.requested,
      Saída: p.outbound,
      Retornado: p.returned,
      "Em campo": p.inField,
      "Pend. saída": p.pendingExit,
      "Pend. resolução": p.pendingResolution,
      Situação: situationLabel(p.situation),
      "Ult. movimentação": fmtDate(p.lastMovementAt, true),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    XLSX.writeFile(wb, `movimentacoes-${data.event.name.replace(/\s+/g, "-")}.xlsx`);
  }

  // ─── Render states ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <SkeletonDashboard />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">Erro ao carregar dados</p>
          <p className="text-xs text-muted-foreground mb-4">Não foi possível carregar as movimentações. Tente novamente.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const { event, products, movements, totals } = data;

  // ── Alerts ──────────────────────────────────────────────────────────────────
  const alerts: Array<{ id: string; message: string; colorClass: string; icon: React.ElementType; filter: string }> = [];
  if (totals.totalInField > 0)
    alerts.push({ id: "in_field", message: `${totals.totalInField} unidade${totals.totalInField !== 1 ? "s" : ""} ainda permanecem em campo.`, colorClass: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400", icon: AlertTriangle, filter: "in_field" });
  if (totals.totalPendingExit > 0)
    alerts.push({ id: "pending_exit", message: `${totals.totalPendingExit} unidade${totals.totalPendingExit !== 1 ? "s" : ""} aguardando saída.`, colorClass: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400", icon: Info, filter: "pending_exit" });
  if (totals.withPendingResolution > 0)
    alerts.push({ id: "pending_resolution", message: `${totals.withPendingResolution} produto${totals.withPendingResolution !== 1 ? "s" : ""} com retorno pendente de resolução.`, colorClass: "border-orange-500/30 bg-orange-500/5 text-orange-700 dark:text-orange-400", icon: AlertCircle, filter: "pending_resolution" });

  const productsWithPartialReturn = products.filter((p) => p.situation === "partial_return").length;
  if (productsWithPartialReturn > 0)
    alerts.push({ id: "partial_return", message: `${productsWithPartialReturn} produto${productsWithPartialReturn !== 1 ? "s possuem" : " possui"} retorno parcial.`, colorClass: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400", icon: TrendingUp, filter: "partial_return" });

  const allReconciled = totals.totalInField === 0 && totals.totalPendingExit === 0 && totals.withPendingResolution === 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Prefill dialog (controlled) ────────────────────────────────────── */}
      {userCanCreateMovement(user) && (
        <MovementDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setMovementPrefill(null);
          }}
          prefill={movementPrefill || undefined}
        >
          <span />
        </MovementDialog>
      )}

      {/* ── Product detail drawer ──────────────────────────────────────────── */}
      <ProductDetailDrawer
        product={drawerProduct}
        eventName={event.name}
        onClose={() => setDrawerProduct(null)}
        onShortcut={handleShortcut}
      />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <button
            onClick={() => navigate(`/events/${eventId}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao evento
          </button>
          <h1 className="text-2xl font-bold text-foreground leading-tight">Movimentações do Evento</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe saídas, retornos, produtos em campo e ocorrências relacionadas ao evento.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {userCanCreateMovement(user) && (
            <MovementDialog prefill={{ eventIds: eventId ? [eventId] : [], hint: `Movimentação vinculada ao evento ${event.name}.` }}>
              <Button size="sm" data-testid="button-new-movement">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Nova movimentação
              </Button>
            </MovementDialog>
          )}
          <Button size="sm" variant="outline" onClick={exportExcel} data-testid="button-export">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* ── Event meta strip ──────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border/60 bg-card p-3">
        <p className="text-sm font-semibold text-foreground mb-2 leading-tight">{event.name}</p>
        <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
          {event.eventDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {fmtDate(event.eventDate)}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {event.location}
            </span>
          )}
          {event.client && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {event.client}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ClipboardList className="h-3.5 w-3.5 shrink-0" />
            {event.requestCount} requisição{event.requestCount !== 1 ? "ões" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Truck className="h-3.5 w-3.5 shrink-0" />
            {event.tripCount} plano{event.tripCount !== 1 ? "s" : ""} de viagem
          </span>
          {event.lastMovementAt && (
            <span className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 shrink-0" />
              Ult. mov.: {fmtDate(event.lastMovementAt, true)}
            </span>
          )}
          <span className="flex items-center gap-1 text-muted-foreground/60">
            <Clock className="h-3 w-3 shrink-0" />
            Calculado às {fmtTime(event.calculatedAt)}
          </span>
        </div>
      </div>

      {/* ── Summary cards — Área 1: Fluxo ──────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fluxo do evento</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          <SummaryCard
            label="Produtos distintos"
            value={totals.distinctProducts}
            icon={Package}
            onClick={() => { setActiveCardFilter(null); setActiveTab("products"); }}
            active={activeCardFilter === null && activeTab === "products"}
          />
          <SummaryCard
            label="Unidades solicitadas"
            value={totals.totalRequested}
            icon={ClipboardList}
            onClick={() => { setActiveCardFilter(null); setActiveTab("products"); }}
          />
          <SummaryCard
            label="Saída confirmada"
            value={totals.totalOutbound}
            icon={TrendingDown}
            onClick={() => { setActiveCardFilter(null); setActiveTab("products"); }}
          />
          <SummaryCard
            label="Retornadas ao CD"
            value={totals.totalReturned}
            icon={TrendingUp}
            colorClass="text-emerald-600 dark:text-emerald-400"
            onClick={() => { setActiveCardFilter("returned"); setActiveTab("products"); }}
            active={activeCardFilter === "returned"}
          />
          <SummaryCard
            label="Em campo"
            value={totals.totalInField}
            icon={MapPin}
            colorClass={totals.totalInField > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}
            onClick={() => { setActiveCardFilter("in_field"); setActiveTab("products"); }}
            active={activeCardFilter === "in_field"}
          />
        </div>
      </div>

      {/* ── Summary cards — Área 2: Ocorrências ────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Ocorrências e pendências</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          <SummaryCard
            label="Pend. de saída"
            value={totals.totalPendingExit}
            icon={AlertCircle}
            colorClass={totals.totalPendingExit > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}
            onClick={() => { setActiveCardFilter("pending_exit"); setActiveTab("products"); }}
            active={activeCardFilter === "pending_exit"}
          />
          <SummaryCard
            label="Pend. resolução"
            value={totals.withPendingResolution}
            icon={AlertTriangle}
            colorClass={totals.withPendingResolution > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}
            onClick={() => { setActiveCardFilter("pending_resolution"); setActiveTab("products"); }}
            active={activeCardFilter === "pending_resolution"}
          />
          <SummaryCard
            label="Avariadas"
            value={0}
            sub="Em desenvolvimento"
            icon={AlertTriangle}
            colorClass="text-muted-foreground"
          />
          <SummaryCard
            label="Perdidas"
            value={0}
            sub="Em desenvolvimento"
            icon={AlertCircle}
            colorClass="text-muted-foreground"
          />
          <SummaryCard
            label="Transferidas"
            value={0}
            sub="Em desenvolvimento"
            icon={ArrowRightLeft}
            colorClass="text-muted-foreground"
          />
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────────── */}
      {allReconciled && alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Todas as movimentações do evento estão conciliadas.
        </div>
      ) : (
        <div className="space-y-1.5">
          {alerts.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                className={cn("w-full flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-left hover-elevate transition-colors", a.colorClass)}
                onClick={() => { setActiveCardFilter(a.filter); setActiveTab("products"); }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{a.message}</span>
                <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0 opacity-60" />
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-b border-border/40 bg-transparent p-0 h-auto w-full justify-start rounded-none gap-0">
          {[
            { id: "overview", label: "Visão geral", icon: LayoutGrid },
            { id: "products", label: "Produtos", icon: Package, count: totals.distinctProducts },
            { id: "movements", label: "Movimentações", icon: Activity, count: movements.length },
            { id: "pending", label: "Pendências", icon: AlertTriangle, count: totals.totalPendingExit + totals.withPendingResolution },
            { id: "history", label: "Histórico", icon: History },
          ].map(({ id, label, icon: Icon, count }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 pb-2 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
              {count !== undefined && count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[1rem]">{count}</Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Visão Geral ────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status breakdown */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3">Distribuição por situação</p>
                {(["awaiting_exit", "partial_exit", "in_field", "partial_return", "returned", "no_movement"] as const).map((s) => {
                  const count = products.filter((p) => p.situation === s).length;
                  if (count === 0) return null;
                  return (
                    <div key={s} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                      <span className={cn("text-xs", situationColorClass(s))}>{situationLabel(s)}</span>
                      <span className="text-xs font-semibold tabular-nums">{count} produto{count !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
                {products.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Nenhum produto solicitado ou movimentado.</p>
                )}
              </CardContent>
            </Card>

            {/* Recentes */}
            <Card className="border-border/60">
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3">Movimentações recentes</p>
                {movements.slice(0, 6).length === 0
                  ? <p className="text-xs text-muted-foreground italic">Nenhuma movimentação registrada.</p>
                  : movements.slice(0, 6).map((m) => (
                    <div key={m.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-border/40 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.typeName} · {fmtDate(m.createdAt, true)}</p>
                      </div>
                      <span className={cn("text-[10px] font-medium shrink-0", movStatusColorClass(m.status))}>
                        {movStatusLabel(m.status)}
                      </span>
                    </div>
                  ))
                }
                {movements.length > 6 && (
                  <button
                    onClick={() => setActiveTab("movements")}
                    className="text-[10px] text-primary hover:underline mt-2 block"
                  >
                    Ver todas ({movements.length})
                  </button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Produtos ───────────────────────────────────────────────────── */}
        <TabsContent value="products" className="mt-4">
          {/* Filters */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por produto, SKU..."
                className="pl-8 h-8 text-sm"
                data-testid="input-search-products"
              />
            </div>
            <Select value={situationFilter} onValueChange={setSituationFilter}>
              <SelectTrigger className="h-8 w-[160px] text-xs" data-testid="select-situation">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="awaiting_exit">Aguardando saída</SelectItem>
                <SelectItem value="partial_exit">Saída parcial</SelectItem>
                <SelectItem value="in_field">Em campo</SelectItem>
                <SelectItem value="partial_return">Retorno parcial</SelectItem>
                <SelectItem value="returned">Retornado</SelectItem>
                <SelectItem value="no_movement">Sem movimentação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs" data-testid="select-ownership">
                <SelectValue placeholder="Titularidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda titularidade</SelectItem>
                <SelectItem value="owned">Próprio</SelectItem>
                <SelectItem value="rented">Alugado</SelectItem>
                <SelectItem value="third_party">Terceiro</SelectItem>
              </SelectContent>
            </Select>
            {(search || situationFilter !== "all" || ownershipFilter !== "all" || activeCardFilter) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => { setSearch(""); setSituationFilter("all"); setOwnershipFilter("all"); setActiveCardFilter(null); }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar filtros
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredProducts.length} de {totals.distinctProducts} produto{totals.distinctProducts !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          {filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
              <Package className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-foreground font-medium mb-1">
                {products.length === 0 ? "Nenhum produto foi solicitado ou movimentado neste evento." : "Nenhum produto corresponde aos filtros aplicados."}
              </p>
              {products.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setSituationFilter("all"); setOwnershipFilter("all"); setActiveCardFilter(null); }} className="mt-2 text-xs">
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20">
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Produto</th>
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Situação</th>
                    <th className="py-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Solicitado</th>
                    <th className="py-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saída</th>
                    <th className="py-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Retornado</th>
                    <th className="py-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Em campo</th>
                    <th className="py-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pend. saída</th>
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ult. mov.</th>
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <ProductRow
                      key={product.productId}
                      product={product}
                      eventId={eventId || ""}
                      eventName={event.name}
                      onShortcut={handleShortcut}
                      onViewDetail={setDrawerProduct}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Movimentações ──────────────────────────────────────────────── */}
        <TabsContent value="movements" className="mt-4">
          {movements.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-foreground mb-1">Ainda não existem movimentações registradas para este evento.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20">
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nº</th>
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
                    <th className="py-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Produtos</th>
                    <th className="py-2 px-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Qtd total</th>
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responsável</th>
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                    <th className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Situação</th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-3">
                        <span className="text-[10px] font-mono text-muted-foreground">{m.movementNumber}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs font-medium text-foreground truncate max-w-[140px] block">{m.name}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs text-muted-foreground">{m.typeName || "—"}</span>
                      </td>
                      <td className="py-2 px-3 text-center tabular-nums">
                        <span className="text-xs">{m.productCount}</span>
                      </td>
                      <td className="py-2 px-3 text-center tabular-nums">
                        <span className="text-xs font-medium">{m.totalQty}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs text-muted-foreground">{m.createdByName || "—"}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs text-muted-foreground">{fmtDate(m.createdAt, true)}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={cn("text-xs font-medium", movStatusColorClass(m.status))}>
                          {movStatusLabel(m.status)}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => navigate(`/movements/${m.id}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Pendências ────────────────────────────────────────────────── */}
        <TabsContent value="pending" className="mt-4">
          <div className="space-y-4">
            {/* Pendências de saída */}
            {(() => {
              const list = products.filter((p) => p.pendingExit > 0);
              if (list.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Pendências de saída ({list.length})
                  </p>
                  <div className="rounded-lg border border-border/60 divide-y divide-border/40">
                    {list.map((p) => (
                      <div key={p.productId} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/20 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Pendente</p>
                            <p className="text-sm font-bold text-red-500">{p.pendingExit}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleShortcut(p, "exit")}
                          >
                            <TrendingDown className="h-3 w-3" />
                            Registrar saída
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Pendências de retorno */}
            {(() => {
              const list = products.filter((p) => p.inField > 0);
              if (list.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Em campo — aguardando retorno ({list.length})
                  </p>
                  <div className="rounded-lg border border-border/60 divide-y divide-border/40">
                    {list.map((p) => (
                      <div key={p.productId} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/20 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Em campo</p>
                            <p className="text-sm font-bold text-amber-500">{p.inField}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleShortcut(p, "return")}
                          >
                            <TrendingUp className="h-3 w-3" />
                            Registrar retorno
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {totals.totalPendingExit === 0 && totals.totalInField === 0 && (
              <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Nenhuma pendência encontrada.</p>
                <p className="text-xs text-muted-foreground mt-1">Todas as movimentações estão conciliadas.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Histórico ─────────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          {movements.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
              <History className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-foreground">Nenhum histórico de movimentação disponível.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {movements.map((m, idx) => {
                const prev = movements[idx - 1];
                const thisDate = m.createdAt ? fmtDate(m.createdAt) : "";
                const prevDate = prev?.createdAt ? fmtDate(prev.createdAt) : "";
                const showDateHeader = thisDate !== prevDate;

                return (
                  <div key={m.id}>
                    {showDateHeader && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 px-1 border-b border-border/40 mt-3 first:mt-0">
                        {thisDate}
                      </p>
                    )}
                    <div className="flex items-start gap-3 py-2.5 px-1 hover:bg-muted/10 rounded-md transition-colors">
                      <div className="flex flex-col items-center shrink-0 pt-0.5">
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          m.nature === "outbound" ? "bg-amber-500" : "bg-emerald-500",
                        )} />
                        {idx < movements.length - 1 && <div className="w-px flex-1 bg-border/40 mt-1" style={{ minHeight: 16 }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground leading-tight">{m.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {m.typeName && <span>{m.typeName} · </span>}
                              {m.totalQty > 0 && <span>{m.totalQty} un. · </span>}
                              {m.productCount > 0 && <span>{m.productCount} produto{m.productCount !== 1 ? "s" : ""} · </span>}
                              {m.createdByName && <span>{m.createdByName} · </span>}
                              <span>{fmtDate(m.createdAt, true)}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn("text-[10px] font-medium", movStatusColorClass(m.status))}>
                              {movStatusLabel(m.status)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px]"
                              onClick={() => navigate(`/movements/${m.id}`)}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  Package, Boxes, Download, Search, ChevronRight, ChevronDown,
  Layers, Scale, FileText, Building2, MapPin, Calendar, ArrowLeft,
  Info, X, ExternalLink, Tag, AlertTriangle, Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KitComponent {
  productId: string; name: string; sku: string; unit: string;
  formulaDisplay: string; quantityPerKit: number | null;
  totalGenerated: number; hasWeight: boolean; weight: number; totalWeight: number | null;
}
interface KitRequestBD {
  requestId: string; area: string | null; requestedByName: string; status: string; quantity: number;
}
interface KitDetail {
  kitId: string; name: string; quantity: number; requestCount: number;
  totalUnitsGenerated: number; weightEstimate: number;
  components: KitComponent[]; requestBreakdown: KitRequestBD[];
}
interface PieceDetail {
  productId: string; sku: string; name: string; unit: string;
  category: string | null; ownership: string; location: string | null;
  weight: number; hasWeight: boolean;
  quantity: number; fromKits: number; direct: number; totalWeight: number | null;
}
interface CategoryDetail {
  category: string; distinctProducts: number; totalPieces: number;
  participation: number; weight: number; piecesWithoutWeight: number;
}
type RequestItem =
  | { type: "product"; id: string; productId: string; name: string; sku: string; unit: string; quantity: number; notes: string | null }
  | { type: "kit"; id: string; kitId: string; name: string; quantity: number; notes: string | null; components: Array<{ productId: string; name: string; sku: string; unit: string; quantity: number }> };
interface RequestDetail {
  id: string; area: string | null; status: string; requestedByName: string;
  createdAt: string | null; itemCount: number; unitCount: number; kitCount: number;
  weightEstimate: number; items: RequestItem[];
}
interface MaterialsData {
  calculatedAt: string; eventId: string;
  event: { id: string; name: string; client: string | null; location: string | null; eventDate: string | null };
  requestCount: number; pendingCount: number; approvedCount: number;
  totals: { distinctProducts: number; totalPieces: number; distinctKits: number; totalKits: number; totalWeight: number; weightKnownCount: number; piecesWithoutWeight: number };
  categories: CategoryDetail[];
  pieces: PieceDetail[];
  kits: KitDetail[];
  requests: RequestDetail[];
}

// ── Utils ─────────────────────────────────────────────────────────────────────

const OWNERSHIP_LABEL: Record<string, string> = { owned: "Próprio", rented: "Alugado", third_party: "Terceiros" };

function fmtDate(val: string | null | undefined, p = "dd/MM/yyyy") {
  if (!val) return "—";
  try { return format(new Date(val), p, { locale: ptBR }); } catch { return "—"; }
}
function fmtNum(n: number, decimals = 0) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtWeight(w: number | null | undefined) {
  if (w == null) return null;
  return w.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, tooltip }: {
  icon: typeof Package; label: string; value: string | number; sub?: string; tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="border-border/60 cursor-default">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
              {sub && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{sub}</p>}
            </div>
            <Info className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ── Piece Drawer ──────────────────────────────────────────────────────────────

function PieceDrawer({ piece, data, open, onClose }: {
  piece: PieceDetail | null; data: MaterialsData; open: boolean; onClose: () => void;
}) {
  const directOrigins = useMemo(() => {
    if (!piece || !data) return [];
    return data.requests.flatMap((r) =>
      r.items
        .filter((it): it is Extract<RequestItem, { type: "product" }> =>
          it.type === "product" && it.productId === piece.productId
        )
        .map((it) => ({ request: r, item: it }))
    );
  }, [piece, data]);

  const kitOrigins = useMemo(() => {
    if (!piece || !data) return [];
    return data.requests.flatMap((r) =>
      r.items
        .filter((it): it is Extract<RequestItem, { type: "kit" }> =>
          it.type === "kit" && it.components.some((c) => c.productId === piece.productId)
        )
        .map((it) => {
          const comp = it.components.find((c) => c.productId === piece.productId)!;
          const kitDef = data.kits.find((k) => k.kitId === it.kitId);
          return { request: r, item: it, component: comp, kitDef };
        })
    );
  }, [piece, data]);

  if (!piece) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[420px] max-w-full overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="text-base leading-snug">{piece.name}</SheetTitle>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{piece.sku}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose} className="shrink-0 -mt-1">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Product info grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-4 text-sm border-b border-border/40">
          {[
            ["Categoria", piece.category ?? "Sem categoria"],
            ["Titularidade", OWNERSHIP_LABEL[piece.ownership] ?? piece.ownership],
            ["Unidade", piece.unit],
            ["Peso unitário", piece.hasWeight ? fmtWeight(piece.weight) : "Não cadastrado"],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="font-medium mt-0.5">{v}</p>
            </div>
          ))}
        </div>

        {/* Quantity summary */}
        <div className="flex gap-4 py-4 border-b border-border/40">
          {[
            { label: "Avulso", value: piece.direct },
            { label: "Via kits", value: piece.fromKits },
            { label: "Total", value: piece.quantity, bold: true },
          ].map(({ label, value, bold }) => (
            <div key={label} className="flex-1 text-center">
              <p className={`text-xl tabular-nums ${bold ? "font-bold" : "font-semibold"}`}>{fmtNum(value)}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
          ))}
          {piece.hasWeight && (
            <div className="flex-1 text-center">
              <p className="text-xl font-semibold tabular-nums">{fmtWeight(piece.totalWeight)}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Peso total</p>
            </div>
          )}
        </div>

        {/* Direct origins */}
        {directOrigins.length > 0 && (
          <div className="py-4 border-b border-border/40 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Origem avulsa</p>
            {directOrigins.map(({ request: r, item: it }) => (
              <div key={it.id} className="rounded-md border border-border/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{r.area ?? "Sem área"}</p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-xs text-muted-foreground">{r.requestedByName} · {fmtDate(r.createdAt)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm tabular-nums font-semibold">{it.quantity} {piece.unit}</span>
                  {it.notes && <span className="text-xs text-muted-foreground italic truncate max-w-[160px]">{it.notes}</span>}
                </div>
                <a
                  href={`/requests/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir requisição
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Kit origins */}
        {kitOrigins.length > 0 && (
          <div className="py-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Origem via kits</p>
            {kitOrigins.map(({ request: r, item: it, component: comp }) => (
              <div key={`${it.id}-${comp.productId}`} className="rounded-md border border-border/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Boxes className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium truncate">{it.name}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">{it.quantity}x</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.area ?? "Sem área"} · {r.requestedByName}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{comp.quantity} {piece.unit} gerado(s)</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="flex gap-2">
                  <a href={`/requests/${r.id}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Abrir requisição
                  </a>
                  <a href={`/kits/${it.kitId}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                    <ExternalLink className="h-3 w-3" /> Ver kit
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {directOrigins.length === 0 && kitOrigins.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma origem encontrada nas requisições consideradas.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EventMaterials() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  // Filters — pieces
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  // Filters — requests
  const [reqStatusFilter, setReqStatusFilter] = useState("all");
  const [reqKitFilter, setReqKitFilter] = useState("all");
  // Tabs
  const [activeTab, setActiveTab] = useState("pieces");
  // Piece drawer
  const [drawerPieceId, setDrawerPieceId] = useState<string | null>(null);
  // Export state
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<MaterialsData>({
    queryKey: ["/api/events", id, "materials-summary"],
    refetchOnWindowFocus: true,
  });

  // ── Filtered & sorted pieces ───────────────────────────────────────────────

  const filteredPieces = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let list = data.pieces.filter((p) => {
      if (categoryFilter !== "all" && (p.category ?? "Sem categoria") !== categoryFilter) return false;
      if (ownershipFilter !== "all" && p.ownership !== ownershipFilter) return false;
      if (originFilter === "direct" && !(p.direct > 0 && p.fromKits === 0)) return false;
      if (originFilter === "kit" && !(p.direct === 0 && p.fromKits > 0)) return false;
      if (originFilter === "both" && !(p.direct > 0 && p.fromKits > 0)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "name-desc": return b.name.localeCompare(a.name, "pt-BR");
        case "qty-desc": return b.quantity - a.quantity;
        case "qty-asc": return a.quantity - b.quantity;
        case "weight-desc": return (b.totalWeight ?? -1) - (a.totalWeight ?? -1);
        case "category": return (a.category ?? "Sem categoria").localeCompare(b.category ?? "Sem categoria", "pt-BR") || a.name.localeCompare(b.name, "pt-BR");
        case "ownership": return a.ownership.localeCompare(b.ownership) || a.name.localeCompare(b.name, "pt-BR");
        default: return a.name.localeCompare(b.name, "pt-BR");
      }
    });
    return list;
  }, [data, search, categoryFilter, ownershipFilter, originFilter, sortBy]);

  const filteredRequests = useMemo(() => {
    if (!data) return [];
    return data.requests.filter((r) => {
      if (reqStatusFilter !== "all" && r.status !== reqStatusFilter) return false;
      if (reqKitFilter === "with" && r.kitCount === 0) return false;
      if (reqKitFilter === "without" && r.kitCount > 0) return false;
      return true;
    });
  }, [data, reqStatusFilter, reqKitFilter]);

  // Per-piece requisition count
  const pieceReqCount = useMemo(() => {
    if (!data) return new Map<string, number>();
    const counts = new Map<string, Set<string>>();
    for (const r of data.requests) {
      for (const it of r.items) {
        if (it.type === "product") {
          const s = counts.get(it.productId) ?? new Set<string>();
          s.add(r.id); counts.set(it.productId, s);
        } else {
          for (const c of it.components) {
            const s = counts.get(c.productId) ?? new Set<string>();
            s.add(r.id); counts.set(c.productId, s);
          }
        }
      }
    }
    return new Map(Array.from(counts.entries()).map(([k, v]) => [k, v.size]));
  }, [data]);

  const activeFilterCount = [
    categoryFilter !== "all", ownershipFilter !== "all", originFilter !== "all",
  ].filter(Boolean).length;

  const selectedPiece = data?.pieces.find((p) => p.productId === drawerPieceId) ?? null;

  // ── Excel export ───────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const ev = data.event;

      // 1. Resumo
      const resumoRows = [
        ["Evento", ev.name], ["Cliente", ev.client ?? "—"], ["Local", ev.location ?? "—"],
        ["Data do evento", fmtDate(ev.eventDate)],
        ["Requisições consideradas", data.requestCount],
        ["Pendentes", data.pendingCount], ["Aprovadas", data.approvedCount],
        ["Peças distintas", data.totals.distinctProducts],
        ["Total de unidades", data.totals.totalPieces],
        ["Kits distintos", data.totals.distinctKits],
        ["Unidades de kits", data.totals.totalKits],
        ["Peso estimado (kg)", data.totals.totalWeight],
        ["Itens sem peso cadastrado", data.totals.piecesWithoutWeight],
        ["Gerado em", format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoRows), "Resumo");

      // 2. Peças
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        filteredPieces.map((p) => ({
          Peça: p.name, SKU: p.sku,
          Categoria: p.category ?? "Sem categoria",
          Titularidade: OWNERSHIP_LABEL[p.ownership] ?? p.ownership,
          Unidade: p.unit,
          Avulso: p.direct, "Via kits": p.fromKits, "Total": p.quantity,
          "Peso unit. (kg)": p.hasWeight ? p.weight : "",
          "Peso total (kg)": p.totalWeight ?? "",
          Requisições: pieceReqCount.get(p.productId) ?? 0,
        }))
      ), "Peças");

      // 3. Kits
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        data.kits.map((k) => ({
          Kit: k.name, "Qtd solicitada": k.quantity, Requisições: k.requestCount,
          "Componentes distintos": k.components.length,
          "Unidades geradas": k.totalUnitsGenerated,
          "Peso estimado (kg)": k.weightEstimate || "",
        }))
      ), "Kits");

      // 4. Composição dos Kits
      const compRows = data.kits.flatMap((k) =>
        k.components.map((c) => ({
          Kit: k.name, Produto: c.name, SKU: c.sku,
          "Qtd por kit": c.quantityPerKit ?? c.formulaDisplay,
          "Qtd de kits": k.quantity,
          "Total gerado": c.totalGenerated,
          "Peso total (kg)": c.totalWeight ?? "",
        }))
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compRows.length ? compRows : [{}]), "Composição dos Kits");

      // 5. Categorias
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        data.categories.map((c) => ({
          Categoria: c.category, "Peças distintas": c.distinctProducts,
          "Total de unidades": c.totalPieces,
          "Participação (%)": c.participation,
          "Peso estimado (kg)": c.weight || "",
          "Itens sem peso": c.piecesWithoutWeight,
        }))
      ), "Categorias");

      // 6. Por Requisição
      const reqRows: any[] = [];
      for (const r of data.requests) {
        for (const it of r.items) {
          if (it.type === "kit") {
            reqRows.push({ Requisição: r.area ?? "—", Solicitante: r.requestedByName, Área: r.area ?? "—", Status: r.status, Tipo: "Kit", "Produto/Kit": it.name, SKU: "—", Qtd: it.quantity, "Peso (kg)": "", Observação: it.notes ?? "" });
            for (const c of it.components) {
              reqRows.push({ Requisição: r.area ?? "—", Solicitante: r.requestedByName, Área: r.area ?? "—", Status: r.status, Tipo: "  Componente", "Produto/Kit": c.name, SKU: c.sku, Qtd: c.quantity, "Peso (kg)": "", Observação: "" });
            }
          } else {
            reqRows.push({ Requisição: r.area ?? "—", Solicitante: r.requestedByName, Área: r.area ?? "—", Status: r.status, Tipo: "Peça", "Produto/Kit": it.name, SKU: it.sku, Qtd: it.quantity, "Peso (kg)": "", Observação: it.notes ?? "" });
          }
        }
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reqRows.length ? reqRows : [{}]), "Por Requisição");

      const safeName = (ev.name || "evento").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      XLSX.writeFile(wb, `materiais-${safeName}.xlsx`);
      toast({ title: "Excel exportado com sucesso" });
    } catch {
      toast({ title: "Erro ao exportar Excel", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <a href={`/events/${id}`}><ArrowLeft className="h-3.5 w-3.5" /> Voltar ao evento</a>
        </Button>
        <Card className="border-border/60">
          <CardContent className="p-8">
            <EmptyState icon={Package} title="Não foi possível carregar"
              description="Os materiais deste evento não puderam ser carregados." />
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasData = data.pieces.length > 0 || data.kits.length > 0;
  const calcTime = format(new Date(data.calculatedAt), "HH:mm", { locale: ptBR });
  const uniqueStatuses = Array.from(new Set(data.requests.map((r) => r.status)));

  // ── Full page ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2" data-testid="link-back-event">
          <a href={`/events/${id}`}><ArrowLeft className="h-3.5 w-3.5" /> Voltar ao evento</a>
        </Button>

        <PageHeader title={`Materiais — ${data.event.name}`}>
          <Button size="sm" onClick={handleExport} disabled={!hasData || exporting} data-testid="button-export">
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Exportando…" : "Exportar Excel"}
          </Button>
        </PageHeader>

        {/* Chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          {data.event.client && (
            <span className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1 text-muted-foreground">
              <Building2 className="h-3 w-3" />{data.event.client}
            </span>
          )}
          {data.event.location && (
            <span className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />{data.event.location}
            </span>
          )}
          {data.event.eventDate && (
            <span className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />{fmtDate(data.event.eventDate)}
            </span>
          )}
          <span className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1 text-muted-foreground">
            <FileText className="h-3 w-3" />{data.requestCount} requisição(ões)
          </span>
          {data.pendingCount > 0 && (
            <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md px-2 py-1">
              <AlertTriangle className="h-3 w-3" />{data.pendingCount} pendente(s)
            </span>
          )}
          {data.approvedCount > 0 && (
            <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md px-2 py-1">
              {data.approvedCount} aprovada(s)
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/60">Dados calculados às {calcTime}</p>
      </div>

      {/* ── Stat cards (2 groups) ── */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Estrutura dos materiais</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Package} label="Peças distintas" value={fmtNum(data.totals.distinctProducts)}
            tooltip="Quantidade de SKUs únicos após consolidar itens avulsos e componentes de kits." />
          <StatCard icon={Boxes} label="Kits distintos" value={fmtNum(data.totals.distinctKits)}
            tooltip="Quantidade de modelos diferentes de kits solicitados." />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-3">Volume operacional</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard icon={Layers} label="Total de unidades" value={fmtNum(data.totals.totalPieces)}
            tooltip="Soma das quantidades avulsas e das quantidades geradas pela composição dos kits." />
          <StatCard icon={Boxes} label="Unidades de kits" value={fmtNum(data.totals.totalKits)}
            tooltip="Soma da quantidade de kits solicitados, sem contar os componentes internos." />
          <StatCard icon={Scale} label="Peso estimado"
            value={`${fmtNum(data.totals.totalWeight, 1)} kg`}
            sub={data.totals.piecesWithoutWeight > 0
              ? `${data.totals.weightKnownCount} de ${data.totals.distinctProducts} peças com peso`
              : `Cobertura total (${data.totals.distinctProducts} peças)`}
            tooltip="Soma do peso total dos produtos que possuem peso cadastrado. Produtos sem peso não são incluídos." />
        </div>
        {data.totals.piecesWithoutWeight > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {data.totals.piecesWithoutWeight} peça(s) sem peso cadastrado — peso real pode ser maior.
          </p>
        )}
      </div>

      {/* ── Tabs ── */}
      {!hasData ? (
        <Card className="border-border/60">
          <CardContent className="p-8">
            <EmptyState icon={Package} title="Nenhum material"
              description="Nenhuma requisição com itens foi criada para este evento ainda." />
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto gap-1 flex-wrap">
            {[
              { value: "pieces", label: "Peças", count: data.pieces.length, icon: Package },
              { value: "kits", label: "Kits", count: data.kits.length, icon: Boxes },
              { value: "categories", label: "Categorias", count: data.categories.length, icon: Tag },
              { value: "requests", label: "Por Requisição", count: data.requests.length, icon: FileText },
            ].map(({ value, label, count, icon: Icon }) => (
              <TabsTrigger key={value} value={value} data-testid={`tab-${value}`}
                className="flex items-center gap-1.5 text-xs">
                <Icon className="h-3 w-3" />
                {label}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 no-default-active-elevate">
                  {count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ───────────────────── PEÇAS ───────────────────── */}
          <TabsContent value="pieces" className="mt-4 space-y-3">
            {/* Controls */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou SKU…" value={search}
                  onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm"
                  data-testid="input-search-pieces" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[155px] h-8 text-sm" data-testid="select-category">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {data.categories.map((c) => (
                    <SelectItem key={c.category} value={c.category || "Sem categoria"}>
                      {c.category || "Sem categoria"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
                <SelectTrigger className="w-[130px] h-8 text-sm" data-testid="select-ownership">
                  <SelectValue placeholder="Titularidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda titularidade</SelectItem>
                  <SelectItem value="owned">Próprio</SelectItem>
                  <SelectItem value="rented">Alugado</SelectItem>
                  <SelectItem value="third_party">Terceiros</SelectItem>
                </SelectContent>
              </Select>
              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger className="w-[140px] h-8 text-sm" data-testid="select-origin">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda origem</SelectItem>
                  <SelectItem value="direct">Somente avulso</SelectItem>
                  <SelectItem value="kit">Somente via kit</SelectItem>
                  <SelectItem value="both">Avulso e via kit</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px] h-8 text-sm" data-testid="select-sort">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Nome A–Z</SelectItem>
                  <SelectItem value="name-desc">Nome Z–A</SelectItem>
                  <SelectItem value="qty-desc">Maior quantidade</SelectItem>
                  <SelectItem value="qty-asc">Menor quantidade</SelectItem>
                  <SelectItem value="weight-desc">Maior peso</SelectItem>
                  <SelectItem value="category">Por categoria</SelectItem>
                  <SelectItem value="ownership">Por titularidade</SelectItem>
                </SelectContent>
              </Select>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => {
                  setCategoryFilter("all"); setOwnershipFilter("all"); setOriginFilter("all");
                }}>
                  <Filter className="h-3 w-3" />
                  Limpar filtros
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{activeFilterCount}</Badge>
                </Button>
              )}
            </div>

            {/* Table */}
            <Card className="border-border/60">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left font-medium px-4 py-2.5">Peça / SKU</th>
                      <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Categoria</th>
                      <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Titularidade</th>
                      <th className="text-right font-medium px-4 py-2.5">Avulso</th>
                      <th className="text-right font-medium px-4 py-2.5">Via kits</th>
                      <th className="text-right font-medium px-4 py-2.5 font-semibold">Total</th>
                      <th className="text-right font-medium px-4 py-2.5 hidden lg:table-cell">Peso total</th>
                      <th className="text-right font-medium px-4 py-2.5 hidden xl:table-cell">Req.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPieces.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          {search || activeFilterCount > 0
                            ? "Nenhuma peça corresponde aos filtros aplicados."
                            : "Nenhuma peça encontrada."}
                        </td>
                      </tr>
                    ) : (
                      filteredPieces.map((p) => (
                        <tr key={p.productId}
                          className="border-b border-border/40 last:border-0 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => setDrawerPieceId(p.productId)}
                          data-testid={`row-piece-${p.productId}`}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-sm leading-snug">{p.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{p.sku}</p>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                            {p.category ?? <span className="italic">Sem categoria</span>}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <Badge variant="outline" className="text-[10px]">
                              {OWNERSHIP_LABEL[p.ownership] ?? p.ownership}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground text-sm">
                            {p.direct || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground text-sm">
                            {p.fromKits || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-sm">
                            {fmtNum(p.quantity)}{" "}
                            <span className="text-[10px] text-muted-foreground font-normal">{p.unit}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground hidden lg:table-cell">
                            {p.hasWeight
                              ? fmtWeight(p.totalWeight)
                              : <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default">—</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Peso não cadastrado</TooltipContent>
                                </Tooltip>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground hidden xl:table-cell">
                            {pieceReqCount.get(p.productId) ?? 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground px-1">
              {filteredPieces.length} de {data.pieces.length} peças.
              {activeFilterCount > 0 && " Filtros ativos."}
              {" "}Clique em uma linha para ver a origem.
            </p>
          </TabsContent>

          {/* ───────────────────── KITS ───────────────────── */}
          <TabsContent value="kits" className="mt-4 space-y-3">
            {data.kits.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="p-8">
                  <EmptyState icon={Boxes} title="Nenhum kit solicitado"
                    description="Nenhum kit foi solicitado nas requisições consideradas." />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {data.kits.map((k) => (
                  <Collapsible key={k.kitId}>
                    <Card className="border-border/60" data-testid={`kit-card-${k.kitId}`}>
                      <CollapsibleTrigger asChild>
                        <button className="group w-full px-4 py-3 flex items-center gap-3 text-left rounded-md hover:bg-muted/20 transition-colors">
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                          <Boxes className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{k.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {fmtNum(k.quantity)} kit(s) · {k.requestCount} requisição(ões) · {k.components.length} componente(s)
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums">{fmtNum(k.totalUnitsGenerated)} unid.</p>
                            {k.weightEstimate > 0 && (
                              <p className="text-[11px] text-muted-foreground">{fmtWeight(k.weightEstimate)}</p>
                            )}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-border/40 px-4 py-3 space-y-4">
                          {/* BOM */}
                          {k.components.length === 0 ? (
                            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" /> Kit sem composição cadastrada
                            </p>
                          ) : (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Composição</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[480px]">
                                  <thead>
                                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                                      <th className="text-left font-medium py-1.5 pr-4">Componente</th>
                                      <th className="text-right font-medium py-1.5 px-4">Qtd/kit</th>
                                      <th className="text-right font-medium py-1.5 px-4">Kits solicitados</th>
                                      <th className="text-right font-medium py-1.5 px-4">Total gerado</th>
                                      <th className="text-right font-medium py-1.5 pl-4">Peso total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {k.components.map((c) => (
                                      <tr key={c.productId} className="border-b border-border/40 last:border-0">
                                        <td className="py-2 pr-4">
                                          <p className="font-medium text-sm leading-snug">{c.name}</p>
                                          <p className="font-mono text-[10px] text-muted-foreground">{c.sku}</p>
                                        </td>
                                        <td className="py-2 px-4 text-right tabular-nums text-muted-foreground text-sm">
                                          {c.quantityPerKit != null ? `${c.quantityPerKit} ${c.unit}` : <span className="italic text-xs">variável</span>}
                                        </td>
                                        <td className="py-2 px-4 text-right tabular-nums text-muted-foreground text-sm">{fmtNum(k.quantity)}</td>
                                        <td className="py-2 px-4 text-right tabular-nums font-semibold text-sm">{fmtNum(c.totalGenerated)} {c.unit}</td>
                                        <td className="py-2 pl-4 text-right tabular-nums text-muted-foreground text-sm">
                                          {c.hasWeight ? fmtWeight(c.totalWeight) : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {/* Request breakdown */}
                          {k.requestBreakdown.length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Requisições</p>
                              <div className="space-y-1">
                                {k.requestBreakdown.map((rb) => (
                                  <div key={rb.requestId} className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{rb.area ?? "Sem área"}</p>
                                      <p className="text-xs text-muted-foreground">{rb.requestedByName}</p>
                                    </div>
                                    <span className="text-sm tabular-nums font-semibold shrink-0">{fmtNum(rb.quantity)}×</span>
                                    <StatusBadge status={rb.status} />
                                    <a href={`/requests/${rb.requestId}`} target="_blank" rel="noopener noreferrer">
                                      <Button size="icon" variant="ghost" className="h-7 w-7">
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <a href={`/kits/${k.kitId}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                            <ExternalLink className="h-3 w-3" /> Ver cadastro do kit
                          </a>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ───────────────────── CATEGORIAS ───────────────────── */}
          <TabsContent value="categories" className="mt-4">
            {data.categories.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="p-8">
                  <EmptyState icon={Tag} title="Sem categorias" description="Nenhuma categoria encontrada." />
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/60">
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="text-left font-medium px-4 py-2.5">Categoria</th>
                        <th className="text-right font-medium px-4 py-2.5">Peças</th>
                        <th className="text-right font-medium px-4 py-2.5">Unidades</th>
                        <th className="text-left font-medium px-4 py-2.5">Participação</th>
                        <th className="text-right font-medium px-4 py-2.5 hidden lg:table-cell">Peso est.</th>
                        <th className="text-right font-medium px-4 py-2.5 hidden lg:table-cell">Sem peso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.categories.map((c) => (
                        <tr key={c.category}
                          className="border-b border-border/40 last:border-0 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => { setCategoryFilter(c.category); setActiveTab("pieces"); }}
                          data-testid={`row-category-${c.category}`}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{c.category}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{c.distinctProducts}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmtNum(c.totalPieces)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
                                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${c.participation}%` }} />
                              </div>
                              <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{c.participation}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground hidden lg:table-cell text-sm">
                            {c.weight > 0 ? fmtWeight(c.weight) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right hidden lg:table-cell">
                            {c.piecesWithoutWeight > 0
                              ? <span className="text-amber-600 dark:text-amber-400 text-xs">{c.piecesWithoutWeight}</span>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
            <p className="text-xs text-muted-foreground mt-2 px-1">
              Clique em uma categoria para filtrar as peças.
            </p>
          </TabsContent>

          {/* ───────────────────── POR REQUISIÇÃO ───────────────────── */}
          <TabsContent value="requests" className="mt-4 space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={reqStatusFilter} onValueChange={setReqStatusFilter}>
                <SelectTrigger className="w-[160px] h-8 text-sm" data-testid="select-req-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {uniqueStatuses.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={reqKitFilter} onValueChange={setReqKitFilter}>
                <SelectTrigger className="w-[140px] h-8 text-sm" data-testid="select-req-kit">
                  <SelectValue placeholder="Kits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Com e sem kits</SelectItem>
                  <SelectItem value="with">Com kits</SelectItem>
                  <SelectItem value="without">Sem kits</SelectItem>
                </SelectContent>
              </Select>
              {(reqStatusFilter !== "all" || reqKitFilter !== "all") && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setReqStatusFilter("all"); setReqKitFilter("all"); }}>
                  Limpar
                </Button>
              )}
            </div>

            {filteredRequests.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="p-8">
                  <EmptyState icon={FileText} title="Nenhuma requisição"
                    description={reqStatusFilter !== "all" || reqKitFilter !== "all"
                      ? "Não existem requisições neste filtro."
                      : "Nenhuma requisição considerada neste evento."} />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredRequests.map((r) => {
                  const directItems = r.items.filter((it) => it.type === "product") as Extract<RequestItem, { type: "product" }>[];
                  const kitItems = r.items.filter((it) => it.type === "kit") as Extract<RequestItem, { type: "kit" }>[];
                  return (
                    <Collapsible key={r.id}>
                      <Card className="border-border/60" data-testid={`request-header-${r.id}`}>
                        <CollapsibleTrigger asChild>
                          <button className="group w-full px-4 py-3 flex items-center gap-3 text-left rounded-md hover:bg-muted/20 transition-colors">
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{r.area ?? "Sem área"}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {r.requestedByName} · {fmtDate(r.createdAt)}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {r.itemCount} item(ns) · {fmtNum(r.unitCount)} unid.
                                {r.kitCount > 0 && ` · ${r.kitCount} kit(s)`}
                                {r.weightEstimate > 0 && ` · ~${fmtWeight(r.weightEstimate)}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge status={r.status} />
                              <a href={`/requests/${r.id}`} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </a>
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t border-border/40 px-4 py-3 space-y-4">
                            {/* Peças avulsas */}
                            {directItems.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Peças avulsas</p>
                                <div className="space-y-0">
                                  {directItems.map((it) => (
                                    <div key={it.id} className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
                                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm truncate">{it.name}</p>
                                        <p className="font-mono text-[10px] text-muted-foreground">{it.sku}</p>
                                        {it.notes && <p className="text-[11px] text-muted-foreground italic">{it.notes}</p>}
                                      </div>
                                      <span className="text-sm tabular-nums font-semibold shrink-0">{it.quantity} {it.unit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Kits */}
                            {kitItems.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Kits</p>
                                <div className="space-y-3">
                                  {kitItems.map((it) => (
                                    <div key={it.id}>
                                      <div className="flex items-center gap-2">
                                        <Boxes className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-sm font-medium flex-1 min-w-0 truncate">{it.name}</span>
                                        <Badge variant="secondary" className="text-xs shrink-0">{it.quantity}×</Badge>
                                        <a href={`/kits/${it.kitId}`} target="_blank" rel="noopener noreferrer">
                                          <Button size="icon" variant="ghost" className="h-6 w-6">
                                            <ExternalLink className="h-3 w-3" />
                                          </Button>
                                        </a>
                                      </div>
                                      {it.components.length > 0 && (
                                        <Collapsible>
                                          <CollapsibleTrigger className="ml-5 mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                                            <ChevronDown className="h-3 w-3" />
                                            Ver {it.components.length} componente(s)
                                          </CollapsibleTrigger>
                                          <CollapsibleContent>
                                            <div className="ml-5 mt-1 pl-3 border-l border-border/40 space-y-1">
                                              {it.components.map((c) => (
                                                <div key={c.productId} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                  <span className="flex-1 min-w-0 truncate">
                                                    {c.name}
                                                    <span className="font-mono ml-1.5 text-[10px]">{c.sku}</span>
                                                  </span>
                                                  <span className="tabular-nums shrink-0 font-medium text-foreground">{c.quantity} {c.unit}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      )}
                                      {it.notes && (
                                        <p className="ml-5 text-[11px] text-muted-foreground italic mt-0.5">{it.notes}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ── Piece drawer ── */}
      <PieceDrawer
        piece={selectedPiece}
        data={data}
        open={!!drawerPieceId}
        onClose={() => setDrawerPieceId(null)}
      />
    </div>
  );
}

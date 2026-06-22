import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Package, Boxes, RefreshCw, Download, Search, ChevronRight,
  Layers, Scale, FileText, Building2, MapPin, Calendar, ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/page-header";

// ── Types ────────────────────────────────────────────────────────────────

interface MaterialsDetail {
  eventId: string;
  event: {
    id: string;
    name: string;
    client: string | null;
    location: string | null;
    eventDate: string | null;
  };
  requestCount: number;
  totals: {
    distinctProducts: number;
    totalPieces: number;
    distinctKits: number;
    totalKits: number;
    totalWeight: number;
  };
  categories: Array<{ category: string; distinctProducts: number; totalPieces: number }>;
  pieces: Array<{
    productId: string;
    sku: string;
    name: string;
    unit: string;
    category: string | null;
    ownership: string;
    location: string | null;
    weight: number;
    quantity: number;
    fromKits: number;
    direct: number;
    totalWeight: number;
  }>;
  kits: Array<{ kitId: string; name: string; quantity: number; requestCount: number }>;
  requests: Array<{
    id: string;
    area: string | null;
    status: string;
    requestedByName: string;
    createdAt: string | null;
    itemCount: number;
    items: Array<
      | {
          type: "product";
          id: string;
          name: string;
          sku: string;
          unit: string;
          quantity: number;
          notes: string | null;
        }
      | {
          type: "kit";
          id: string;
          name: string;
          quantity: number;
          notes: string | null;
          components: Array<{
            productId: string;
            name: string;
            sku: string;
            unit: string;
            quantity: number;
          }>;
        }
    >;
  }>;
}

const OWNERSHIP_LABEL: Record<string, string> = {
  owned: "Próprio",
  rented: "Alugado",
  third_party: "Terceiros",
};

function fmtDate(val: string | Date | null | undefined, pattern = "dd/MM/yyyy") {
  if (!val) return "—";
  try {
    return format(new Date(val as string), pattern, { locale: ptBR });
  } catch {
    return "—";
  }
}

// ── Stat card ────────────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Package;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-semibold leading-tight tabular-nums" data-testid={`stat-${label}`}>
            {value}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </p>
          {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function EventMaterials() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");

  const { data, isLoading, refetch, isFetching } = useQuery<MaterialsDetail>({
    queryKey: ["/api/events", id, "materials-summary"],
  });

  const filteredPieces = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.pieces.filter((p) => {
      if (categoryFilter !== "all" && (p.category ?? "Sem categoria") !== categoryFilter) return false;
      if (ownershipFilter !== "all" && p.ownership !== ownershipFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, categoryFilter, ownershipFilter]);

  const filteredKits = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.kits.filter((k) => !q || k.name.toLowerCase().includes(q));
  }, [data, search]);

  const handleExport = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    const piecesSheet = XLSX.utils.json_to_sheet(
      data.pieces.map((p) => ({
        SKU: p.sku,
        Peça: p.name,
        Categoria: p.category ?? "Sem categoria",
        Propriedade: OWNERSHIP_LABEL[p.ownership] ?? p.ownership,
        Local: p.location ?? "—",
        Unidade: p.unit,
        Avulso: p.direct,
        "De kits": p.fromKits,
        "Qtd total": p.quantity,
        "Peso unit. (kg)": p.weight,
        "Peso total (kg)": p.totalWeight,
      })),
    );
    XLSX.utils.book_append_sheet(wb, piecesSheet, "Peças");

    const kitsSheet = XLSX.utils.json_to_sheet(
      data.kits.map((k) => ({
        Kit: k.name,
        "Qtd total": k.quantity,
        "Requisições": k.requestCount,
      })),
    );
    XLSX.utils.book_append_sheet(wb, kitsSheet, "Kits");

    const reqRows: any[] = [];
    for (const r of data.requests) {
      for (const it of r.items) {
        if (it.type === "kit") {
          reqRows.push({
            Área: r.area ?? "—",
            Status: r.status,
            Solicitante: r.requestedByName,
            Tipo: "Kit",
            Item: it.name,
            SKU: "—",
            Qtd: it.quantity,
            Observação: it.notes ?? "",
          });
          for (const c of it.components) {
            reqRows.push({
              Área: r.area ?? "—",
              Status: r.status,
              Solicitante: r.requestedByName,
              Tipo: "  └ Componente",
              Item: c.name,
              SKU: c.sku,
              Qtd: c.quantity,
              Observação: "",
            });
          }
        } else {
          reqRows.push({
            Área: r.area ?? "—",
            Status: r.status,
            Solicitante: r.requestedByName,
            Tipo: "Peça",
            Item: it.name,
            SKU: it.sku,
            Qtd: it.quantity,
            Observação: it.notes ?? "",
          });
        }
      }
    }
    const reqSheet = XLSX.utils.json_to_sheet(reqRows);
    XLSX.utils.book_append_sheet(wb, reqSheet, "Por Requisição");

    const safeName = (data.event.name || "evento").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    XLSX.writeFile(wb, `materiais-${safeName}.xlsx`);
  };

  if (isLoading) return <PageLoading />;

  if (!data) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Não foi possível carregar"
          description="Os materiais deste evento não puderam ser carregados."
        />
      </div>
    );
  }

  const hasData = data.pieces.length > 0 || data.kits.length > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2"
          data-testid="link-back-event"
        >
          <a href={`/events/${id}`}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao evento
          </a>
        </Button>
        <PageHeader title={`Materiais — ${data.event.name}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={!hasData}
            data-testid="button-export"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
        </PageHeader>
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          {data.event.client && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {data.event.client}
            </span>
          )}
          {data.event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {data.event.location}
            </span>
          )}
          {data.event.eventDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {fmtDate(data.event.eventDate)}
            </span>
          )}
          <span>{data.requestCount} requisição(ões), incluindo pendentes</span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat icon={Package} label="Peças distintas" value={data.totals.distinctProducts} />
          <Stat icon={Layers} label="Total de unidades" value={data.totals.totalPieces} />
          <Stat icon={Boxes} label="Kits distintos" value={data.totals.distinctKits} />
          <Stat icon={Boxes} label="Unidades de kits" value={data.totals.totalKits} />
          <Stat
            icon={Scale}
            label="Peso estimado"
            value={`${data.totals.totalWeight.toLocaleString("pt-BR")} kg`}
          />
        </div>

        {!hasData ? (
          <Card className="border-border/60">
            <CardContent className="p-6">
              <EmptyState
                icon={Package}
                title="Nenhum material"
                description="Nenhuma requisição com itens foi criada para este evento ainda."
              />
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="pieces" className="w-full">
            <TabsList>
              <TabsTrigger value="pieces" data-testid="tab-pieces">
                Peças ({data.pieces.length})
              </TabsTrigger>
              <TabsTrigger value="kits" data-testid="tab-kits">
                Kits ({data.kits.length})
              </TabsTrigger>
              <TabsTrigger value="categories" data-testid="tab-categories">
                Categorias ({data.categories.length})
              </TabsTrigger>
              <TabsTrigger value="requests" data-testid="tab-requests">
                Por Requisição ({data.requests.length})
              </TabsTrigger>
            </TabsList>

            {/* ── Peças ──────────────────────────────────────────────── */}
            <TabsContent value="pieces" className="mt-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                    data-testid="input-search-pieces"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-category">
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
                  <SelectTrigger className="w-[150px]" data-testid="select-ownership">
                    <SelectValue placeholder="Propriedade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toda propriedade</SelectItem>
                    <SelectItem value="owned">Próprio</SelectItem>
                    <SelectItem value="rented">Alugado</SelectItem>
                    <SelectItem value="third_party">Terceiros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="border-border/60">
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="text-left font-medium px-4 py-2.5">SKU</th>
                        <th className="text-left font-medium px-4 py-2.5">Peça</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Categoria</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Propriedade</th>
                        <th className="text-right font-medium px-4 py-2.5">Avulso</th>
                        <th className="text-right font-medium px-4 py-2.5">De kits</th>
                        <th className="text-right font-medium px-4 py-2.5">Total</th>
                        <th className="text-right font-medium px-4 py-2.5 hidden lg:table-cell">Peso (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPieces.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                            Nenhuma peça encontrada com os filtros atuais.
                          </td>
                        </tr>
                      ) : (
                        filteredPieces.map((p) => (
                          <tr
                            key={p.productId}
                            className="border-b border-border/40 last:border-0"
                            data-testid={`row-piece-${p.productId}`}
                          >
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                              {p.sku}
                            </td>
                            <td className="px-4 py-2.5 font-medium">{p.name}</td>
                            <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground text-xs">
                              {p.category ?? "Sem categoria"}
                            </td>
                            <td className="px-4 py-2.5 hidden lg:table-cell">
                              <Badge variant="outline" className="text-[10px]">
                                {OWNERSHIP_LABEL[p.ownership] ?? p.ownership}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                              {p.direct || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                              {p.fromKits || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                              {p.quantity} <span className="text-[10px] text-muted-foreground font-normal">{p.unit}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                              {p.totalWeight ? p.totalWeight.toLocaleString("pt-BR") : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground px-1">
                Mostrando {filteredPieces.length} de {data.pieces.length} peças. "De kits" são unidades que vêm da explosão de kits.
              </p>
            </TabsContent>

            {/* ── Kits ───────────────────────────────────────────────── */}
            <TabsContent value="kits" className="mt-4 space-y-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar kit..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-kits"
                />
              </div>
              <Card className="border-border/60">
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="text-left font-medium px-4 py-2.5">Kit</th>
                        <th className="text-right font-medium px-4 py-2.5">Requisições</th>
                        <th className="text-right font-medium px-4 py-2.5">Qtd total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKits.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">
                            Nenhum kit encontrado.
                          </td>
                        </tr>
                      ) : (
                        filteredKits.map((k) => (
                          <tr
                            key={k.kitId}
                            className="border-b border-border/40 last:border-0"
                            data-testid={`row-kit-${k.kitId}`}
                          >
                            <td className="px-4 py-2.5 font-medium">{k.name}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                              {k.requestCount}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                              {k.quantity}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Categorias ─────────────────────────────────────────── */}
            <TabsContent value="categories" className="mt-4">
              <Card className="border-border/60">
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="text-left font-medium px-4 py-2.5">Categoria</th>
                        <th className="text-right font-medium px-4 py-2.5">Peças distintas</th>
                        <th className="text-right font-medium px-4 py-2.5">Total de unidades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.categories.map((c) => (
                        <tr
                          key={c.category}
                          className="border-b border-border/40 last:border-0"
                          data-testid={`row-category-${c.category}`}
                        >
                          <td className="px-4 py-2.5 font-medium">{c.category}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {c.distinctProducts}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                            {c.totalPieces}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Por Requisição ─────────────────────────────────────── */}
            <TabsContent value="requests" className="mt-4 space-y-2.5">
              {data.requests.map((r) => (
                <Collapsible key={r.id}>
                  <Card className="border-border/60">
                    <CollapsibleTrigger asChild>
                      <button
                        className="group w-full px-4 py-3 flex items-center gap-3 text-left hover-elevate rounded-md"
                        data-testid={`request-header-${r.id}`}
                      >
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {r.area || "Sem área"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.requestedByName} · {fmtDate(r.createdAt)} · {r.itemCount} item(ns)
                          </p>
                        </div>
                        <StatusBadge status={r.status} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-border/40 divide-y divide-border/40">
                        {r.items.map((it) => (
                          <div key={it.id} className="px-4 py-2.5">
                            {it.type === "kit" ? (
                              <div>
                                <div className="flex items-center gap-2">
                                  <Boxes className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm font-medium flex-1 min-w-0">{it.name}</span>
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {it.quantity}x
                                  </Badge>
                                </div>
                                {it.components.length > 0 && (
                                  <div className="mt-1.5 ml-5 pl-3 border-l border-border/40 space-y-1">
                                    {it.components.map((c) => (
                                      <div
                                        key={c.productId}
                                        className="flex items-center gap-2 text-xs text-muted-foreground"
                                      >
                                        <span className="flex-1 min-w-0 truncate">
                                          {c.name}
                                          <span className="font-mono ml-1.5 text-[10px]">{c.sku}</span>
                                        </span>
                                        <span className="tabular-nums shrink-0">
                                          {c.quantity} {c.unit}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {it.notes && (
                                  <p className="mt-1 ml-5 text-[11px] text-muted-foreground italic">{it.notes}</p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm flex-1 min-w-0 truncate">
                                    {it.name}
                                    <span className="font-mono ml-1.5 text-[10px] text-muted-foreground">{it.sku}</span>
                                  </span>
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    {it.quantity} {it.unit}
                                  </Badge>
                                </div>
                                {it.notes && (
                                  <p className="mt-1 ml-5 text-[11px] text-muted-foreground italic">{it.notes}</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

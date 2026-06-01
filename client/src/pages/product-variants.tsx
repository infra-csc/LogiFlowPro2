import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { type Product } from "@shared/schema";
import {
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  Package,
  Search,
  X,
} from "lucide-react";

const OWNERSHIP_LABELS: Record<string, { label: string; className: string }> = {
  owned: { label: "Próprio", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  rented: { label: "Locado", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  third_party: { label: "Terceiro", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30" },
};

export default function ProductVariantsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOwnership, setFilterOwnership] = useState("all");
  const [filterHasVariants, setFilterHasVariants] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeFilterCount = [
    filterOwnership !== "all",
    filterHasVariants,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setFilterOwnership("all");
    setFilterHasVariants(false);
  };

  const groups = products
    .filter((p) => p.productType === "principal")
    .map((principal) => ({
      principal,
      variants: products.filter(
        (v) =>
          v.productType === "variante" &&
          v.equivalentSku === principal.sku &&
          (filterOwnership === "all" || v.ownership === filterOwnership)
      ),
    }))
    .filter((group) => {
      if (filterHasVariants && group.variants.length === 0) return false;

      const q = searchQuery.toLowerCase();
      if (!q) return true;
      return (
        group.principal.name.toLowerCase().includes(q) ||
        group.principal.sku.toLowerCase().includes(q) ||
        group.variants.some(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            v.sku.toLowerCase().includes(q)
        )
      );
    });

  if (isLoading) {
    return <PageLoading message="Carregando variantes..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Variantes de Produtos"
        description="Gerencie produtos locados, terceiros e variações vinculadas aos produtos principais"
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por produto principal, SKU ou variante..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
          data-testid="input-search"
        />
        {searchQuery && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <FilterBar
        badgeCount={activeFilterCount}
        onClear={handleClearFilters}
        defaultOpen={false}
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Titularidade da Variante</Label>
          <Select value={filterOwnership} onValueChange={setFilterOwnership}>
            <SelectTrigger data-testid="filter-ownership">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="rented">Locado</SelectItem>
              <SelectItem value="third_party">Terceiro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Exibição</Label>
          <button
            type="button"
            onClick={() => setFilterHasVariants((v) => !v)}
            data-testid="filter-has-variants"
            className={`flex items-center gap-2 w-full rounded-md border px-3 h-9 text-sm transition-colors ${
              filterHasVariants
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/60 bg-background text-foreground hover-elevate"
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
            Apenas com variantes
          </button>
        </div>
      </FilterBar>

      {/* Content */}
      {groups.length === 0 ? (
        searchQuery || activeFilterCount > 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto encontrado"
            description="Tente ajustar a busca ou limpar os filtros."
            action={{ label: "Limpar filtros", onClick: () => { setSearchQuery(""); handleClearFilters(); } }}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="Nenhuma variante cadastrada"
            description="Cadastre produtos do tipo Variante vinculados a um produto principal para visualizá-los aqui."
          />
        )
      ) : (
        <div className="space-y-3">
          {groups.map(({ principal, variants }) => {
            const expanded = expandedIds.has(principal.id);
            const hasVariants = variants.length > 0;

            return (
              <div
                key={principal.id}
                className="rounded-lg border border-border/60 bg-card overflow-hidden"
                data-testid={`card-principal-${principal.id}`}
              >
                {/* Principal header */}
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover-elevate transition-colors"
                  onClick={() => toggleExpand(principal.id)}
                  aria-expanded={expanded}
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-primary/70" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base text-foreground truncate">
                        {principal.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        Principal
                      </Badge>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5">
                      SKU: {principal.sku}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={hasVariants ? "border-primary/30 text-primary" : "text-muted-foreground"}
                    >
                      {variants.length} {variants.length === 1 ? "variante" : "variantes"}
                    </Badge>
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Variants list */}
                {expanded && (
                  <div className="border-t border-border/40 bg-muted/20">
                    {variants.length === 0 ? (
                      <div className="px-4 py-4 flex items-center gap-2 text-muted-foreground">
                        <LinkIcon className="h-4 w-4 shrink-0" />
                        <p className="text-sm">Nenhuma variante vinculada a este produto.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {variants.map((variant) => {
                          const ob = OWNERSHIP_LABELS[variant.ownership] || { label: variant.ownership, className: "" };
                          return (
                            <div
                              key={variant.id}
                              className="px-4 py-3 flex items-center gap-3 flex-wrap"
                              data-testid={`row-variant-${variant.id}`}
                            >
                              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 ml-2" />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-foreground">{variant.name}</span>
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {variant.sku}
                                  </span>
                                </div>
                                {variant.barcode && (
                                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                    Cód: {variant.barcode}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] ${ob.className}`}>
                                  {ob.label}
                                </Badge>
                                {variant.requiresSupplier && (
                                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                    Exige fornecedor
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

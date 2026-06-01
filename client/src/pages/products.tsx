import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Package, Search, AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product } from "@shared/schema";
import { ProductDialog } from "@/components/product-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";

const OWNERSHIP_LABELS: Record<string, { label: string; className: string }> = {
  owned: { label: "Próprio", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  rented: { label: "Alugado", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  third_party: { label: "Terceiro", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30" },
};

const TYPE_LABELS: Record<string, string> = {
  principal: "Principal",
  variante: "Variante",
};

function isLowStock(product: Product): boolean {
  return !!(product.minimumStock && product.minimumStock > 0 && product.currentStock !== null && product.currentStock !== undefined && product.currentStock <= product.minimumStock);
}

function isZeroStock(product: Product): boolean {
  return product.currentStock === 0;
}

export default function Products() {
  const { user } = useAuth();
  const canWrite = userIsAdmin(user);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [search, setSearch] = useState("");
  const [filterOwnership, setFilterOwnership] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterLowStock, setFilterLowStock] = useState(false);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredProducts = products?.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));

    const matchesOwnership = filterOwnership === "all" || p.ownership === filterOwnership;
    const matchesType = filterType === "all" || p.productType === filterType;
    const matchesLowStock = !filterLowStock || isLowStock(p);

    return matchesSearch && matchesOwnership && matchesType && matchesLowStock;
  });

  const activeFilterCount = [
    filterOwnership !== "all",
    filterType !== "all",
    filterLowStock,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setFilterOwnership("all");
    setFilterType("all");
    setFilterLowStock(false);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedProduct(undefined);
    setShowDialog(false);
  };

  // Stats computed from full list (not filtered)
  const stats = products
    ? {
        total: products.length,
        owned: products.filter((p) => p.ownership === "owned").length,
        external: products.filter((p) => p.ownership !== "owned").length,
        lowStock: products.filter(isLowStock).length,
        noImage: products.filter((p) => !p.imageUrl).length,
      }
    : null;

  if (isLoading) {
    return <PageLoading message="Carregando catálogo de produtos..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo de Produtos"
        description="Gerencie itens de estoque, materiais e produtos utilizados nas operações"
      >
        {canWrite && (
          <Button onClick={() => setShowDialog(true)} data-testid="button-create-product">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto
          </Button>
        )}
      </PageHeader>

      {/* Stats strip */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, onClick: () => { handleClearFilters(); setSearch(""); } },
            { label: "Próprios", value: stats.owned, onClick: () => { handleClearFilters(); setFilterOwnership("owned"); } },
            { label: "Locado/Terceiro", value: stats.external, onClick: () => { handleClearFilters(); setFilterOwnership("rented"); } },
            { label: "Estoque baixo", value: stats.lowStock, onClick: () => { handleClearFilters(); setFilterLowStock(true); }, warn: stats.lowStock > 0 },
            { label: "Sem imagem", value: stats.noImage, onClick: undefined },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              disabled={!s.onClick}
              className={`rounded-lg border border-border/60 bg-card p-3 text-left transition-colors ${s.onClick ? "hover-elevate cursor-pointer" : "cursor-default"}`}
              data-testid={`stat-${s.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
            >
              <p className={`text-xl font-bold ${s.warn ? "text-amber-500" : "text-foreground"}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search bar — always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, SKU ou código de barras..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-10"
          data-testid="input-search-products"
        />
        {search && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Collapsible filters */}
      <FilterBar
        badgeCount={activeFilterCount}
        onClear={handleClearFilters}
        defaultOpen={false}
      >
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Titularidade</Label>
          <Select value={filterOwnership} onValueChange={setFilterOwnership}>
            <SelectTrigger data-testid="filter-ownership">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="owned">Próprio</SelectItem>
              <SelectItem value="rented">Alugado</SelectItem>
              <SelectItem value="third_party">Terceiro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tipo de Produto</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger data-testid="filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="principal">Principal</SelectItem>
              <SelectItem value="variante">Variante</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Estoque</Label>
          <button
            type="button"
            onClick={() => setFilterLowStock((v) => !v)}
            data-testid="filter-low-stock"
            className={`flex items-center gap-2 w-full rounded-md border px-3 h-9 text-sm transition-colors ${
              filterLowStock
                ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-border/60 bg-background text-foreground hover-elevate"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Estoque baixo
          </button>
        </div>
      </FilterBar>

      {/* Product grid or empty state */}
      {!filteredProducts || filteredProducts.length === 0 ? (
        search || activeFilterCount > 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto encontrado"
            description="Tente ajustar a busca ou limpar os filtros."
            action={{ label: "Limpar filtros", onClick: () => { setSearch(""); handleClearFilters(); } }}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Adicione produtos para utilizá-los em requisições, kits e movimentações."
            action={canWrite ? { label: "Adicionar Produto", onClick: () => setShowDialog(true) } : undefined}
          />
        )
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const low = isLowStock(product);
            const zero = isZeroStock(product);
            const ob = OWNERSHIP_LABELS[product.ownership] || { label: product.ownership, className: "" };

            return (
              <Card
                key={product.id}
                className={`overflow-hidden border-border/60 flex flex-col ${canWrite ? "hover-elevate cursor-pointer" : ""}`}
                onClick={canWrite ? () => handleEdit(product) : undefined}
                data-testid={`card-product-${product.id}`}
              >
                {/* Image area — fixed height h-36 */}
                {product.imageUrl ? (
                  <div className="h-36 w-full bg-muted relative shrink-0">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-36 w-full bg-muted/50 flex items-center justify-center shrink-0">
                    <Package className="h-9 w-9 text-muted-foreground/25" />
                  </div>
                )}

                <CardContent className="p-4 flex flex-col flex-1">
                  {/* Name + SKU */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-base text-foreground leading-snug line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5">
                      SKU: {product.sku}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="mt-auto pt-3 border-t border-border/40 space-y-2">
                    {/* Stock */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Estoque</span>
                      <span
                        className={`text-sm font-medium flex items-center gap-1 ${
                          zero ? "text-destructive" : low ? "text-amber-500 dark:text-amber-400" : "text-foreground"
                        }`}
                      >
                        {low && !zero && <AlertTriangle className="h-3 w-3" />}
                        {product.currentStock ?? 0}{" "}
                        <span className="font-normal text-muted-foreground">{product.unit}</span>
                      </span>
                    </div>

                    {/* Location */}
                    {product.location && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Local</span>
                        <span className="text-xs text-foreground truncate max-w-[120px]">{product.location}</span>
                      </div>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge variant="outline" className={`text-[10px] ${ob.className}`}>
                        {ob.label}
                      </Badge>
                      {product.productType === "variante" && (
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_LABELS[product.productType] || product.productType}
                        </Badge>
                      )}
                      {zero && (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                          Sem estoque
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProductDialog
        open={showDialog}
        onOpenChange={handleClose}
        product={selectedProduct}
      />
    </div>
  );
}

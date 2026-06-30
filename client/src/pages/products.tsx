import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Package, Search, AlertTriangle, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Product } from "@shared/schema";
import { ProductDialog } from "@/components/product-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { ProductViewToggle } from "@/components/products/product-view-toggle";
import { ProductGrid } from "@/components/products/product-grid";
import { ProductList } from "@/components/products/product-list";
import { ProductHistoryModal } from "@/components/products/product-history-modal";
import {
  isLowStock,
  stockStatus,
  sortProducts,
  sortValueFor,
  SORT_OPTIONS,
  type ViewMode,
  type Density,
  type SortKey,
  type SortDir,
} from "@/components/products/product-helpers";

const VIEW_STORAGE_KEY = "products:viewMode";
const DENSITY_STORAGE_KEY = "products:density";

export default function Products() {
  const { user } = useAuth();
  const canWrite = userIsAdmin(user);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [historyProduct, setHistoryProduct] = useState<Product | undefined>();

  // Search + filters
  const [search, setSearch] = useState("");
  const [filterOwnership, setFilterOwnership] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [filterImage, setFilterImage] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // View mode + density (persisted). List is the default operational view;
  // a saved preference (e.g. user switched to grid) is respected afterwards.
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [density, setDensity] = useState<Density>("comfortable");

  useEffect(() => {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "grid" || v === "list") setViewMode(v);
    const d = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (d === "comfortable" || d === "compact") setDensity(d);
  }, []);

  const handleViewChange = (v: ViewMode) => {
    setViewMode(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  const handleDensityChange = (d: Density) => {
    setDensity(d);
    localStorage.setItem(DENSITY_STORAGE_KEY, d);
  };

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Dynamic filter option lists
  const { units, locations } = useMemo(() => {
    const uni = new Set<string>();
    const loc = new Set<string>();
    (products ?? []).forEach((p) => {
      if (p.unit) uni.add(p.unit);
      if (p.location) loc.add(p.location);
    });
    const sorter = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });
    return {
      units: Array.from(uni).sort(sorter),
      locations: Array.from(loc).sort(sorter),
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const result = (products ?? []).filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));

      const matchesOwnership =
        filterOwnership === "all" ||
        (filterOwnership === "external" ? p.ownership !== "owned" : p.ownership === filterOwnership);
      const matchesType = filterType === "all" || p.productType === filterType;

      const st = stockStatus(p);
      const matchesStock =
        filterStock === "all" ||
        (filterStock === "in_stock" && st === "ok") ||
        (filterStock === "low" && st === "low") ||
        (filterStock === "zero" && st === "zero");

      const matchesImage =
        filterImage === "all" ||
        (filterImage === "with" && !!p.imageUrl) ||
        (filterImage === "without" && !p.imageUrl);

      const matchesUnit = filterUnit === "all" || p.unit === filterUnit;
      const matchesLocation = filterLocation === "all" || p.location === filterLocation;

      return (
        matchesSearch &&
        matchesOwnership &&
        matchesType &&
        matchesStock &&
        matchesImage &&
        matchesUnit &&
        matchesLocation
      );
    });
    return sortProducts(result, sortKey, sortDir);
  }, [
    products,
    search,
    filterOwnership,
    filterType,
    filterStock,
    filterImage,
    filterUnit,
    filterLocation,
    sortKey,
    sortDir,
  ]);

  const activeFilterCount = [
    filterOwnership !== "all",
    filterType !== "all",
    filterStock !== "all",
    filterImage !== "all",
    filterUnit !== "all",
    filterLocation !== "all",
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setFilterOwnership("all");
    setFilterType("all");
    setFilterStock("all");
    setFilterImage("all");
    setFilterUnit("all");
    setFilterLocation("all");
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedProduct(undefined);
    setShowDialog(false);
  };

  const handleColumnSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Active filter chips
  const OWNERSHIP_CHIP: Record<string, string> = {
    owned: "Próprio",
    rented: "Alugado",
    third_party: "Terceiro",
    external: "Locado/Terceiro",
  };
  const STOCK_CHIP: Record<string, string> = {
    in_stock: "Em estoque",
    low: "Estoque baixo",
    zero: "Sem estoque",
  };
  const chips: { label: string; onRemove: () => void }[] = [];
  if (filterOwnership !== "all") chips.push({ label: OWNERSHIP_CHIP[filterOwnership] ?? filterOwnership, onRemove: () => setFilterOwnership("all") });
  if (filterType !== "all") chips.push({ label: filterType === "principal" ? "Principal" : "Variante", onRemove: () => setFilterType("all") });
  if (filterStock !== "all") chips.push({ label: STOCK_CHIP[filterStock] ?? filterStock, onRemove: () => setFilterStock("all") });
  if (filterImage !== "all") chips.push({ label: filterImage === "with" ? "Com imagem" : "Sem imagem", onRemove: () => setFilterImage("all") });
  if (filterUnit !== "all") chips.push({ label: filterUnit, onRemove: () => setFilterUnit("all") });
  if (filterLocation !== "all") chips.push({ label: filterLocation, onRemove: () => setFilterLocation("all") });

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

  const sortValue = sortValueFor(sortKey, sortDir);

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
            { label: "Total", value: stats.total, onClick: () => { handleClearFilters(); setSearch(""); }, active: activeFilterCount === 0 && !search },
            { label: "Próprios", value: stats.owned, onClick: () => { handleClearFilters(); setFilterOwnership("owned"); }, active: filterOwnership === "owned" },
            { label: "Locado/Terceiro", value: stats.external, onClick: () => { handleClearFilters(); setFilterOwnership("external"); }, active: filterOwnership === "external" },
            { label: "Estoque baixo", value: stats.lowStock, onClick: () => { handleClearFilters(); setFilterStock("low"); }, warn: stats.lowStock > 0, active: filterStock === "low" },
            { label: "Sem imagem", value: stats.noImage, onClick: () => { handleClearFilters(); setFilterImage("without"); }, active: filterImage === "without" },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              aria-pressed={s.active}
              className={`rounded-lg border bg-card p-3 text-left transition-colors hover-elevate cursor-pointer ${
                s.active ? "border-primary ring-1 ring-primary/40" : "border-border/60"
              }`}
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
              <SelectItem value="external">Locado/Terceiro</SelectItem>
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
          <Label className="text-xs text-muted-foreground">Status de Estoque</Label>
          <Select value={filterStock} onValueChange={setFilterStock}>
            <SelectTrigger data-testid="filter-stock">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="in_stock">Em estoque</SelectItem>
              <SelectItem value="low">Estoque baixo</SelectItem>
              <SelectItem value="zero">Sem estoque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Imagem</Label>
          <Select value={filterImage} onValueChange={setFilterImage}>
            <SelectTrigger data-testid="filter-image">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="with">Com imagem</SelectItem>
              <SelectItem value="without">Sem imagem</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Unidade</Label>
          <Select value={filterUnit} onValueChange={setFilterUnit} disabled={units.length === 0}>
            <SelectTrigger data-testid="filter-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {units.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Localização</Label>
          <Select value={filterLocation} onValueChange={setFilterLocation} disabled={locations.length === 0}>
            <SelectTrigger data-testid="filter-location">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Badge
              key={chip.label}
              variant="secondary"
              className="gap-1 pr-1"
              data-testid={`chip-${chip.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="rounded-sm hover-elevate p-0.5"
                aria-label={`Remover filtro ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Toolbar: view toggle + result count + sort + density */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProductViewToggle value={viewMode} onChange={handleViewChange} />
          <span className="text-sm text-muted-foreground" data-testid="text-result-count">
            {filteredProducts.length}{" "}
            {filteredProducts.length === 1 ? "produto" : "produtos"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {viewMode === "list" && (
            <ToggleGroup
              type="single"
              value={density}
              onValueChange={(v) => {
                if (v === "comfortable" || v === "compact") handleDensityChange(v);
              }}
              className="gap-1"
            >
              <ToggleGroupItem value="comfortable" data-testid="toggle-density-comfortable" className="text-xs">
                Confortável
              </ToggleGroupItem>
              <ToggleGroupItem value="compact" data-testid="toggle-density-compact" className="text-xs">
                Compacta
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Ordenar</Label>
            <Select
              value={sortValue}
              onValueChange={(v) => {
                const opt = SORT_OPTIONS.find((o) => o.value === v);
                if (opt) {
                  setSortKey(opt.key);
                  setSortDir(opt.dir);
                }
              }}
            >
              <SelectTrigger className="w-[190px]" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading skeletons */}
      {isLoading ? (
        viewMode === "grid" ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-border/60">
                <div className="h-36 w-full bg-muted animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-full bg-muted animate-pulse rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <div className="h-9 w-9 bg-muted animate-pulse rounded-md shrink-0" />
                <div className="h-4 flex-1 bg-muted animate-pulse rounded" />
                <div className="h-4 w-16 bg-muted animate-pulse rounded hidden md:block" />
                <div className="h-4 w-20 bg-muted animate-pulse rounded hidden lg:block" />
              </div>
            ))}
          </div>
        )
      ) : filteredProducts.length === 0 ? (
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
      ) : viewMode === "grid" ? (
        <ProductGrid
          products={filteredProducts}
          canWrite={canWrite}
          onEdit={handleEdit}
          onViewHistory={setHistoryProduct}
        />
      ) : (
        <ProductList
          products={filteredProducts}
          canWrite={canWrite}
          onEdit={handleEdit}
          onViewHistory={setHistoryProduct}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleColumnSort}
          density={density}
        />
      )}

      <ProductDialog
        open={showDialog}
        onOpenChange={handleClose}
        product={selectedProduct}
      />

      <ProductHistoryModal
        product={historyProduct}
        onOpenChange={(open) => { if (!open) setHistoryProduct(undefined); }}
      />
    </div>
  );
}

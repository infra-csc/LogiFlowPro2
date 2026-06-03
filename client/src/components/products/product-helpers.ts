import type { Product } from "@shared/schema";

export type ViewMode = "grid" | "list";
export type Density = "comfortable" | "compact";
export type SortKey =
  | "name"
  | "sku"
  | "currentStock"
  | "minimumStock"
  | "ownership"
  | "createdAt";
export type SortDir = "asc" | "desc";
export type StockStatus = "zero" | "low" | "ok";

export const OWNERSHIP_LABELS: Record<string, { label: string; className: string }> = {
  owned: { label: "Próprio", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  rented: { label: "Alugado", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  third_party: { label: "Terceiro", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30" },
};

export const TYPE_LABELS: Record<string, string> = {
  principal: "Principal",
  variante: "Variante",
};

export function ownershipInfo(ownership: string) {
  return OWNERSHIP_LABELS[ownership] || { label: ownership, className: "" };
}

export function isLowStock(product: Product): boolean {
  return !!(
    product.minimumStock &&
    product.minimumStock > 0 &&
    product.currentStock !== null &&
    product.currentStock !== undefined &&
    product.currentStock <= product.minimumStock
  );
}

export function isZeroStock(product: Product): boolean {
  return product.currentStock === 0;
}

export function stockStatus(product: Product): StockStatus {
  if (isZeroStock(product)) return "zero";
  if (isLowStock(product)) return "low";
  return "ok";
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  zero: "Sem estoque",
  low: "Estoque baixo",
  ok: "OK",
};

export const SORT_OPTIONS: { value: string; label: string; key: SortKey; dir: SortDir }[] = [
  { value: "name-asc", label: "Nome A-Z", key: "name", dir: "asc" },
  { value: "name-desc", label: "Nome Z-A", key: "name", dir: "desc" },
  { value: "sku-asc", label: "SKU (A-Z)", key: "sku", dir: "asc" },
  { value: "sku-desc", label: "SKU (Z-A)", key: "sku", dir: "desc" },
  { value: "ownership-asc", label: "Titularidade (A-Z)", key: "ownership", dir: "asc" },
  { value: "ownership-desc", label: "Titularidade (Z-A)", key: "ownership", dir: "desc" },
  { value: "stock-asc", label: "Estoque (menor)", key: "currentStock", dir: "asc" },
  { value: "stock-desc", label: "Estoque (maior)", key: "currentStock", dir: "desc" },
  { value: "minstock-asc", label: "Mínimo (menor)", key: "minimumStock", dir: "asc" },
  { value: "minstock-desc", label: "Mínimo (maior)", key: "minimumStock", dir: "desc" },
  { value: "recent", label: "Últimos cadastrados", key: "createdAt", dir: "desc" },
];

export function sortValueFor(key: SortKey, dir: SortDir): string {
  return SORT_OPTIONS.find((o) => o.key === key && o.dir === dir)?.value ?? "name-asc";
}

export function sortProducts(products: Product[], key: SortKey, dir: SortDir): Product[] {
  const factor = dir === "asc" ? 1 : -1;
  const arr = [...products];
  arr.sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "name":
        cmp = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
        break;
      case "sku":
        cmp = a.sku.localeCompare(b.sku, "pt-BR", { sensitivity: "base" });
        break;
      case "currentStock":
        cmp = (a.currentStock ?? 0) - (b.currentStock ?? 0);
        break;
      case "minimumStock":
        cmp = (a.minimumStock ?? 0) - (b.minimumStock ?? 0);
        break;
      case "ownership":
        cmp = ownershipInfo(a.ownership).label.localeCompare(ownershipInfo(b.ownership).label, "pt-BR");
        break;
      case "createdAt": {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        cmp = ta - tb;
        break;
      }
    }
    if (cmp === 0) cmp = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    return cmp * factor;
  });
  return arr;
}

import { Package, AlertTriangle, ArrowUp, ArrowDown, ChevronsUpDown, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Product } from "@shared/schema";
import {
  ownershipInfo,
  isLowStock,
  isZeroStock,
  type SortKey,
  type SortDir,
  type Density,
} from "./product-helpers";

interface ProductListProps {
  products: Product[];
  canWrite: boolean;
  onEdit: (product: Product) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  density: Density;
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = sortKey === column;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors ${
          active ? "text-foreground" : "text-muted-foreground"
        } ${align === "right" ? "ml-auto" : ""}`}
        data-testid={`sort-${column}`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export function ProductList({
  products,
  canWrite,
  onEdit,
  sortKey,
  sortDir,
  onSort,
  density,
}: ProductListProps) {
  const cellPad = density === "compact" ? "py-1.5" : "py-3";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[52px]"></TableHead>
                <SortHeader label="Produto" column="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHeader label="SKU" column="sku" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="hidden md:table-cell" />
                <SortHeader label="Titularidade" column="ownership" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="hidden lg:table-cell" />
                <TableHead className="hidden xl:table-cell text-xs font-medium text-muted-foreground">Categoria</TableHead>
                <TableHead className="hidden lg:table-cell text-xs font-medium text-muted-foreground">Unidade</TableHead>
                <SortHeader label="Estoque" column="currentStock" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="text-right" align="right" />
                <SortHeader label="Mínimo" column="minimumStock" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="hidden md:table-cell text-right" align="right" />
                <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="hidden xl:table-cell text-xs font-medium text-muted-foreground">Local</TableHead>
                {canWrite && <TableHead className="w-[56px] text-right"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const low = isLowStock(product);
                const zero = isZeroStock(product);
                const ob = ownershipInfo(product.ownership);

                return (
                  <TableRow
                    key={product.id}
                    className={canWrite ? "cursor-pointer" : ""}
                    onClick={canWrite ? () => onEdit(product) : undefined}
                    data-testid={`row-product-${product.id}`}
                  >
                    {/* Thumbnail */}
                    <TableCell className={cellPad}>
                      {product.imageUrl ? (
                        <div className="h-9 w-9 rounded-md overflow-hidden bg-muted shrink-0">
                          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-9 w-9 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </TableCell>

                    {/* Name + variant indicator */}
                    <TableCell className={cellPad}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium text-sm text-foreground truncate max-w-[220px] block" data-testid={`text-product-name-${product.id}`}>
                              {product.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{product.name}</TooltipContent>
                        </Tooltip>
                        {product.productType === "variante" && (
                          <Badge variant="outline" className="text-[10px] shrink-0">Variante</Badge>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground md:hidden">{product.sku}</span>
                    </TableCell>

                    {/* SKU */}
                    <TableCell className={`${cellPad} hidden md:table-cell`}>
                      <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                    </TableCell>

                    {/* Ownership */}
                    <TableCell className={`${cellPad} hidden lg:table-cell`}>
                      <Badge variant="outline" className={`text-[10px] ${ob.className}`}>{ob.label}</Badge>
                    </TableCell>

                    {/* Category */}
                    <TableCell className={`${cellPad} hidden xl:table-cell`}>
                      <span className="text-xs text-muted-foreground truncate block max-w-[140px]">{product.category || "—"}</span>
                    </TableCell>

                    {/* Unit */}
                    <TableCell className={`${cellPad} hidden lg:table-cell`}>
                      <span className="text-xs text-muted-foreground">{product.unit}</span>
                    </TableCell>

                    {/* Current stock */}
                    <TableCell className={`${cellPad} text-right`}>
                      <span
                        className={`text-sm font-medium inline-flex items-center gap-1 justify-end ${
                          zero ? "text-destructive" : low ? "text-amber-500 dark:text-amber-400" : "text-foreground"
                        }`}
                        data-testid={`text-stock-${product.id}`}
                      >
                        {low && !zero && <AlertTriangle className="h-3 w-3" />}
                        {product.currentStock ?? 0}
                      </span>
                    </TableCell>

                    {/* Minimum stock */}
                    <TableCell className={`${cellPad} hidden md:table-cell text-right`}>
                      <span className="text-sm text-muted-foreground">{product.minimumStock ?? 0}</span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className={cellPad}>
                      {zero ? (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Sem estoque</Badge>
                      ) : low ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">Estoque baixo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">OK</Badge>
                      )}
                    </TableCell>

                    {/* Location */}
                    <TableCell className={`${cellPad} hidden xl:table-cell`}>
                      <span className="text-xs text-muted-foreground truncate block max-w-[140px]">{product.location || "—"}</span>
                    </TableCell>

                    {/* Actions */}
                    {canWrite && (
                      <TableCell className={`${cellPad} text-right`} onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onEdit(product)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover-elevate"
                              data-testid={`button-edit-product-${product.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Editar produto</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

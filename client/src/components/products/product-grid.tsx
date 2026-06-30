import { Package, AlertTriangle, ImageOff, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@shared/schema";
import {
  ownershipInfo,
  TYPE_LABELS,
  isLowStock,
  isZeroStock,
} from "./product-helpers";

interface ProductGridProps {
  products: Product[];
  canWrite: boolean;
  onEdit: (product: Product) => void;
  onViewHistory?: (product: Product) => void;
}

export function ProductGrid({ products, canWrite, onEdit, onViewHistory }: ProductGridProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => {
        const low = isLowStock(product);
        const zero = isZeroStock(product);
        const ob = ownershipInfo(product.ownership);
        const noImage = !product.imageUrl;

        return (
          <Card
            key={product.id}
            className={`overflow-hidden border-border/60 flex flex-col ${
              zero
                ? "border-destructive/40"
                : low
                ? "border-amber-500/40"
                : ""
            } hover-elevate cursor-pointer group`}
            onClick={() => onViewHistory ? onViewHistory(product) : canWrite ? onEdit(product) : undefined}
            data-testid={`card-product-${product.id}`}
          >
            {/* Image area — fixed height for consistent card height */}
            {product.imageUrl ? (
              <div className="h-36 w-full bg-muted relative shrink-0">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {canWrite && (
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center invisible group-hover:visible">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-background/90 rounded-md px-2.5 py-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-36 w-full bg-muted/50 flex flex-col items-center justify-center gap-1 shrink-0">
                <Package className="h-9 w-9 text-muted-foreground/25" />
                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                  <ImageOff className="h-3 w-3" /> Sem imagem
                </span>
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
                  {zero ? (
                    <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                      Sem estoque
                    </Badge>
                  ) : low ? (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                      Estoque baixo
                    </Badge>
                  ) : null}
                  {noImage && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Sem imagem
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

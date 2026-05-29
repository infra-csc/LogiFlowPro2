import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Package, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@shared/schema";
import { ProductDialog } from "@/components/product-dialog";
import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

export default function Products() {
  const { user } = useAuth();
  const canWrite = userIsAdmin(user);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [search, setSearch] = useState("");

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Sync selectedProduct with latest data from cache
  useEffect(() => {
    if (selectedProduct?.id && products) {
      const updatedProduct = products.find(p => p.id === selectedProduct.id);
      if (updatedProduct) {
        setSelectedProduct(updatedProduct);
      }
    }
  }, [products, selectedProduct?.id]);

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setShowDialog(true);
  };

  const handleClose = () => {
    setSelectedProduct(undefined);
    setShowDialog(false);
  };

  const getOwnershipColor = (ownership: string) => {
    switch(ownership) {
      case "owned": return "bg-chart-4 text-white";
      case "rented": return "bg-chart-5 text-white";
      case "third_party": return "bg-chart-2 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <PageLoading message="Carregando produtos..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo de Produtos"
        description="Gerencie itens de estoque e materiais"
      >
        {canWrite && (
          <Button onClick={() => setShowDialog(true)} data-testid="button-create-product">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto
          </Button>
        )}
      </PageHeader>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos por nome ou SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-products"
        />
      </div>

      {!filteredProducts || filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search ? "Nenhum produto encontrado" : "Nenhum produto ainda"}
          description={search ? "Tente ajustar sua busca" : "Comece adicionando seu primeiro produto"}
          action={!search && canWrite ? { label: "Adicionar Produto", onClick: () => setShowDialog(true) } : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <Card 
              key={product.id}
              className={`overflow-hidden ${canWrite ? "hover-elevate cursor-pointer" : ""}`}
              onClick={canWrite ? () => handleEdit(product) : undefined}
              data-testid={`card-product-${product.id}`}
            >
              {product.imageUrl && (
                <div className="aspect-video w-full bg-muted relative">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="h-4 w-4 text-primary/70" />
                      </div>
                      <h3 className="font-semibold text-base text-foreground truncate">{product.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground ml-10">SKU: {product.sku}</p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Estoque:</span>
                    <span className={`text-sm font-medium ${
                      product.currentStock && product.minimumStock && product.currentStock < product.minimumStock
                        ? "text-destructive"
                        : "text-foreground"
                    }`}>
                      {product.currentStock || 0} {product.unit}
                    </span>
                  </div>

                  {product.location && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Localização:</span>
                      <span className="text-sm">{product.location}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <Badge className={getOwnershipColor(product.ownership)}>
                      {product.ownership === "owned" ? "Proprietário" : product.ownership === "rented" ? "Alugado" : "Terceiro"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

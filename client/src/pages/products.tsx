import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Package, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@shared/schema";
import { ProductDialog } from "@/components/product-dialog";

export default function Products() {
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
        console.log("Products page: Syncing selectedProduct with cache", {
          productId: selectedProduct.id,
          oldImageUrl: selectedProduct.imageUrl,
          newImageUrl: updatedProduct.imageUrl
        });
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
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Catálogo de Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie itens de estoque e materiais</p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="button-create-product">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Produto
        </Button>
      </div>

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
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">
                {search ? "Nenhum produto encontrado" : "Nenhum produto ainda"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search ? "Tente ajustar sua busca" : "Comece adicionando seu primeiro produto"}
              </p>
              {!search && (
                <Button onClick={() => setShowDialog(true)} className="mt-4" data-testid="button-add-first-product">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Produto
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <Card 
              key={product.id}
              className="hover-elevate cursor-pointer overflow-hidden"
              onClick={() => handleEdit(product)}
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
                    <h3 className="font-medium truncate">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                  </div>
                  {!product.imageUrl && <Package className="h-5 w-5 text-muted-foreground ml-2" />}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Stock:</span>
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
                      <span className="text-xs text-muted-foreground">Location:</span>
                      <span className="text-sm">{product.location}</span>
                    </div>
                  )}
                  
                  <div className="pt-2">
                    <Badge className={getOwnershipColor(product.ownership)}>
                      {product.ownership === "owned" ? "Owned" : product.ownership === "rented" ? "Rented" : "Third Party"}
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

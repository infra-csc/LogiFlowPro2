import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Package, TrendingDown, TrendingUp, Warehouse } from "lucide-react";
import type { Product } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

export default function Inventory() {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  if (isLoading) {
    return (
      <PageLoading message="Carregando estoque..." />
    );
  }

  const totalItems = products?.reduce((sum, p) => sum + (p.currentStock || 0), 0) || 0;
  const lowStockItems = products?.filter(p => 
    p.minimumStock && p.currentStock !== null && p.currentStock < p.minimumStock
  ).length || 0;
  const availableItems = products?.filter(p => p.currentStock && p.currentStock > 0).length || 0;

  const stats = [
    {
      title: "Estoque Total",
      value: totalItems,
      icon: Warehouse,
      color: "text-chart-1",
    },
    {
      title: "Itens Disponíveis",
      value: availableItems,
      icon: Package,
      color: "text-chart-4",
    },
    {
      title: "Alertas de Estoque Baixo",
      value: lowStockItems,
      icon: TrendingDown,
      color: "text-chart-5",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Estoque"
        description="Monitore níveis de estoque e disponibilidade"
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover-elevate border-border/60 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.color.replace('text-', 'bg-')}/10`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight" data-testid={`stat-${stat.title.toLowerCase().replace(/\s/g, '-')}`}>
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 hover-elevate">
        <CardContent className="p-4">
          {!products || products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto no estoque"
              description="Produtos aparecerão aqui quando cadastrados"
            />
          ) : (
            <div className="space-y-4">
              {products.map((product) => {
                const isLowStock = product.minimumStock && product.currentStock !== null && 
                                   product.currentStock < product.minimumStock;
                const stockPercentage = product.minimumStock && product.currentStock !== null
                  ? Math.min((product.currentStock / (product.minimumStock * 2)) * 100, 100)
                  : 50;

                return (
                  <div key={product.id} className="space-y-2" data-testid={`inventory-item-${product.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          {isLowStock && (
                            <Badge variant="destructive" className="text-xs">Estoque Baixo</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          SKU: {product.sku} | {product.location || "Sem localização"}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className={`text-sm font-medium ${isLowStock ? 'text-destructive' : 'text-foreground'}`}>
                          {product.currentStock || 0} {product.unit}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Min: {product.minimumStock || 0}
                        </p>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          isLowStock ? 'bg-destructive' : 'bg-chart-4'
                        }`}
                        style={{ width: `${stockPercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

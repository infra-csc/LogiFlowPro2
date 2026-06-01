import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Product } from "@shared/schema";
import { Link as LinkIcon, Package } from "lucide-react";

export default function ProductVariantsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Group variants by their principal product
  const variantsByPrincipal = products
    .filter(p => p.productType === "principal")
    .map(principal => ({
      principal,
      variants: products.filter(
        v => v.productType === "variante" && v.equivalentSku === principal.sku
      ),
    }))
    .filter(group => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        group.principal.name.toLowerCase().includes(query) ||
        group.principal.sku.toLowerCase().includes(query) ||
        group.variants.some(v => 
          v.name.toLowerCase().includes(query) || 
          v.sku.toLowerCase().includes(query)
        )
      );
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Variantes de Produtos"
        description="Consulta de variantes de produtos (locados, terceiros) vinculadas aos produtos principais"
      />

      <Card className="border-border/60">
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Buscar por produto principal ou variante..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />

            {isLoading ? (
              <PageLoading message="Carregando variantes..." />
            ) : (
              <div className="space-y-6">
                {variantsByPrincipal.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado
                  </p>
                ) : (
                  variantsByPrincipal.map((group) => (
                    <Card key={group.principal.id} className="border-border/60">
                      <CardHeader className="bg-accent/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Package className="h-6 w-6 text-primary" />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold">{group.principal.name}</h3>
                                <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500">
                                  PRINCIPAL
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">SKU: {group.principal.sku}</p>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {group.variants.length} {group.variants.length === 1 ? "variante" : "variantes"}
                          </Badge>
                        </div>
                      </CardHeader>
                      {group.variants.length > 0 && (
                        <CardContent className="pt-6">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>SKU Variante</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Código de Barras</TableHead>
                                <TableHead>Requer Fornecedor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.variants.map((variant) => (
                                <TableRow key={variant.id} data-testid={`row-variant-${variant.id}`}>
                                  <TableCell className="font-mono">
                                    <div className="flex items-center gap-2">
                                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                                      {variant.sku}
                                    </div>
                                  </TableCell>
                                  <TableCell>{variant.name}</TableCell>
                                  <TableCell>
                                    {variant.ownership === "rented" ? (
                                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500">
                                        🟡 LOCADO
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500">
                                        🔵 TERCEIROS
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {variant.barcode || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {variant.requiresSupplier ? (
                                      <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40">
                                        Sim
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">Não</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

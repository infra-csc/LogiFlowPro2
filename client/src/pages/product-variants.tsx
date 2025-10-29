import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertProductSchema, type Product } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Link as LinkIcon, Package } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const formSchema = insertProductSchema.extend({
  equivalentSku: z.string().min(1, "SKU principal é obrigatório para variantes"),
});

export default function ProductVariantsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      name: "",
      barcode: "",
      productType: "variante",
      requiresSupplier: true,
      ownership: "rented",
      equivalentSku: "",
      description: "",
      unit: "unit",
      minimumStock: 0,
      currentStock: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/products", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create variant");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Variante criada com sucesso" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao criar variante", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (data: z.infer<typeof formSchema>) => {
    createMutation.mutate(data);
  };

  // Filter principal products for the select
  const principalProducts = products.filter(p => p.productType === "principal");

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
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold">Variantes de Produtos</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Gerencie as variantes de produtos (locados, terceiros) vinculadas aos produtos principais
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-variant">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Variante
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nova Variante de Produto</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="equivalentSku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Produto Principal *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-principal-product">
                                <SelectValue placeholder="Selecione o produto principal" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {principalProducts.map(product => (
                                <SelectItem key={product.id} value={product.sku}>
                                  {product.sku} - {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Produto ao qual esta variante pertence
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="sku"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SKU da Variante *</FormLabel>
                            <FormControl>
                              <Input placeholder="CAD-LOC-001" {...field} data-testid="input-variant-sku" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="barcode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código de Barras</FormLabel>
                            <FormControl>
                              <Input placeholder="7891234560011" {...field} value={field.value || ""} data-testid="input-barcode" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Variante *</FormLabel>
                          <FormControl>
                            <Input placeholder="Cadeira Tiffany Branca (Locada)" {...field} data-testid="input-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ownership"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Propriedade *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-ownership">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="rented">Locado</SelectItem>
                              <SelectItem value="third_party">Terceiros</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Input placeholder="Informações adicionais" {...field} value={field.value || ""} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requiresSupplier"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <FormLabel>Requer Fornecedor</FormLabel>
                            <FormDescription>
                              Obriga informar fornecedor ao adicionar em movimentações
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-requires-supplier"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          form.reset();
                        }}
                        data-testid="button-cancel"
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                        {createMutation.isPending ? "Criando..." : "Criar Variante"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Buscar por produto principal ou variante..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />

            {isLoading ? (
              <p>Carregando...</p>
            ) : (
              <div className="space-y-6">
                {variantsByPrincipal.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado
                  </p>
                ) : (
                  variantsByPrincipal.map((group) => (
                    <Card key={group.principal.id} className="border-2">
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

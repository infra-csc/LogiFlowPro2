import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Package, Boxes, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Data Types ---------- */

type Product = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};

type Kit = {
  id: string;
  name: string;
  description?: string;
};

type AddItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  products: Product[];
  kits: Kit[];
  productsLoading?: boolean;
  kitsLoading?: boolean;
};

/* ---------- Component ---------- */

export function AddItemDialog({
  open,
  onOpenChange,
  requestId,
  products,
  kits,
  productsLoading = false,
  kitsLoading = false,
}: AddItemDialogProps) {
  const { toast } = useToast();
  const [itemType, setItemType] = useState<"product" | "kit">("product");
  const [productId, setProductId] = useState("");
  const [kitId, setKitId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);
  const [quantityError, setQuantityError] = useState(false);

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const selectedKit = useMemo(() => kits.find((k) => k.id === kitId), [kits, kitId]);

  const createMutation = useMutation({
    mutationFn: async (data: { requestId: string; productId?: string; kitId?: string; quantity: number; notes?: string }) => {
      return await apiRequest("POST", `/api/requests/${requestId}/items`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", requestId, "items"] });
      toast({
        title: "Item adicionado",
        description: "O item foi adicionado a requisicao com sucesso",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro ao adicionar item",
        description: "Nao foi possivel adicionar o item a requisicao",
      });
    },
  });

  const resetForm = () => {
    setProductId("");
    setKitId("");
    setQuantity("1");
    setNotes("");
    setItemType("product");
    setQuantityError(false);
    setProductOpen(false);
    setKitOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (itemType === "product" && !productId) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um produto" });
      return;
    }

    if (itemType === "kit" && !kitId) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um kit" });
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      setQuantityError(true);
      toast({ variant: "destructive", title: "Erro", description: "Quantidade deve ser maior que zero" });
      return;
    }
    setQuantityError(false);

    createMutation.mutate({
      requestId,
      productId: itemType === "product" ? productId : undefined,
      kitId: itemType === "kit" ? kitId : undefined,
      quantity: qty,
      notes: notes || undefined,
    });
  };

  const isValid = itemType === "product" ? !!productId && parseInt(quantity) >= 1 : !!kitId && parseInt(quantity) >= 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg overflow-hidden p-0 gap-0">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Adicionar Material</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Escolha entre adicionar um produto individual ou um kit completo. A quantidade deve ser maior que zero.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <Tabs value={itemType} onValueChange={(v) => setItemType(v as "product" | "kit")}>
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="product" data-testid="tab-product" className="gap-1.5">
                <Package className="h-4 w-4" />
                Produto
              </TabsTrigger>
              <TabsTrigger value="kit" data-testid="tab-kit" className="gap-1.5">
                <Boxes className="h-4 w-4" />
                Kit
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6 pt-2">
          {/* Product Selector */}
          {itemType === "product" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Produto *</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productOpen}
                      className="w-full justify-between h-10 font-normal"
                      data-testid="combobox-product"
                    >
                      {selectedProduct ? selectedProduct.name : "Buscar produto por nome ou SKU"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar produto por nome ou SKU..." />
                      <CommandList>
                        {productsLoading ? (
                          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando produtos...
                          </div>
                        ) : products.length === 0 ? (
                          <CommandEmpty>
                            <div className="flex flex-col items-center py-4 gap-2">
                              <AlertCircle className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm">Nenhum produto encontrado</span>
                            </div>
                          </CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {products.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.sku}`}
                                onSelect={() => {
                                  setProductId(product.id);
                                  setProductOpen(false);
                                }}
                                data-testid={`product-option-${product.id}`}
                              >
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="text-sm font-medium truncate">{product.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-muted-foreground">SKU: {product.sku}</span>
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">Produto</Badge>
                                  </div>
                                </div>
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4 shrink-0",
                                    productId === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-sm font-medium">Quantidade *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setQuantityError(false);
                  }}
                  data-testid="input-quantity"
                  className={cn("h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", quantityError && "border-destructive focus-visible:ring-destructive")}
                />
                {quantityError && (
                  <p className="text-xs text-destructive">Quantidade deve ser maior que zero</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">Observacoes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observacoes sobre o item (opcional)"
                  data-testid="input-notes"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Kit Selector */}
          {itemType === "kit" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Kit *</Label>
                <Popover open={kitOpen} onOpenChange={setKitOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={kitOpen}
                      className="w-full justify-between h-10 font-normal"
                      data-testid="combobox-kit"
                    >
                      {selectedKit ? selectedKit.name : "Buscar kit por nome"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar kit por nome..." />
                      <CommandList>
                        {kitsLoading ? (
                          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando kits...
                          </div>
                        ) : kits.length === 0 ? (
                          <CommandEmpty>
                            <div className="flex flex-col items-center py-4 gap-2">
                              <AlertCircle className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm">Nenhum kit encontrado</span>
                            </div>
                          </CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {kits.map((kit) => (
                              <CommandItem
                                key={kit.id}
                                value={kit.name}
                                onSelect={() => {
                                  setKitId(kit.id);
                                  setKitOpen(false);
                                }}
                                data-testid={`kit-option-${kit.id}`}
                              >
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="text-sm font-medium truncate">{kit.name}</span>
                                  {kit.description && (
                                    <span className="text-xs text-muted-foreground truncate">{kit.description}</span>
                                  )}
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 w-fit">Kit</Badge>
                                </div>
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4 shrink-0",
                                    kitId === kit.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="kit-quantity" className="text-sm font-medium">Quantidade *</Label>
                <Input
                  id="kit-quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setQuantityError(false);
                  }}
                  data-testid="input-kit-quantity"
                  className={cn("h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", quantityError && "border-destructive focus-visible:ring-destructive")}
                />
                {quantityError && (
                  <p className="text-xs text-destructive">Quantidade deve ser maior que zero</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="kit-notes" className="text-sm font-medium">Observacoes</Label>
                <Textarea
                  id="kit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observacoes sobre o item (opcional)"
                  data-testid="input-kit-notes"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Selected Item Summary */}
          {(selectedProduct || selectedKit) && (
            <div className="p-3 rounded-lg border bg-muted/30 border-border/60">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Resumo</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {selectedProduct ? <Package className="h-4 w-4 text-primary" /> : <Boxes className="h-4 w-4 text-primary" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedProduct ? selectedProduct.name : selectedKit?.name}
                  </p>
                  <div className="flex items-center gap-2">
                    {selectedProduct && (
                      <span className="text-xs font-mono text-muted-foreground">SKU: {selectedProduct.sku}</span>
                    )}
                    <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">
                      {selectedProduct ? "Produto" : "Kit"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Qtd: {quantity} {selectedProduct?.unit || "unid"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="bg-muted/50 p-4 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            data-testid="button-cancel-add-item"
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !isValid}
            data-testid="button-submit-add-item"
            className="w-full sm:w-auto"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adicionando...
              </>
            ) : (
              "Adicionar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

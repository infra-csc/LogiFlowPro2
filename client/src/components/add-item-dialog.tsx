import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
};

export function AddItemDialog({ open, onOpenChange, requestId }: AddItemDialogProps) {
  const { toast } = useToast();
  const [itemType, setItemType] = useState<"product" | "kit">("product");
  const [productId, setProductId] = useState("");
  const [kitId, setKitId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: open && itemType === "product",
  });

  const { data: kits = [] } = useQuery<Kit[]>({
    queryKey: ["/api/kits"],
    enabled: open && itemType === "kit",
  });

  const createMutation = useMutation({
    mutationFn: async (data: { requestId: string; productId?: string; kitId?: string; quantity: number; notes?: string }) => {
      return await apiRequest("POST", `/api/requests/${requestId}/items`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", requestId, "items"] });
      toast({
        title: "Item adicionado",
        description: "O item foi adicionado à requisição com sucesso",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro ao adicionar item",
        description: "Não foi possível adicionar o item à requisição",
      });
    },
  });

  const resetForm = () => {
    setProductId("");
    setKitId("");
    setQuantity("1");
    setNotes("");
    setItemType("product");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (itemType === "product" && !productId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um produto",
      });
      return;
    }

    if (itemType === "kit" && !kitId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um kit",
      });
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Quantidade deve ser maior que zero",
      });
      return;
    }

    createMutation.mutate({
      requestId,
      productId: itemType === "product" ? productId : undefined,
      kitId: itemType === "kit" ? kitId : undefined,
      quantity: qty,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Material</DialogTitle>
          <DialogDescription>
            Escolha entre adicionar um produto individual ou um kit completo. A quantidade deve ser maior que zero.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={itemType} onValueChange={(v) => setItemType(v as "product" | "kit")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="product" data-testid="tab-product">Produto</TabsTrigger>
              <TabsTrigger value="kit" data-testid="tab-kit">Kit</TabsTrigger>
            </TabsList>

            <TabsContent value="product" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="product">Produto *</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger data-testid="select-product">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações sobre o item (opcional)"
                  data-testid="input-notes"
                  rows={2}
                />
              </div>
            </TabsContent>

            <TabsContent value="kit" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="kit">Kit *</Label>
                <Select value={kitId} onValueChange={setKitId}>
                  <SelectTrigger data-testid="select-kit">
                    <SelectValue placeholder="Selecione o kit" />
                  </SelectTrigger>
                  <SelectContent>
                    {kits.map((kit) => (
                      <SelectItem key={kit.id} value={kit.id}>
                        {kit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kit-quantity">Quantidade *</Label>
                <Input
                  id="kit-quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-kit-quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kit-notes">Observações</Label>
                <Textarea
                  id="kit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações sobre o item (opcional)"
                  data-testid="input-kit-notes"
                  rows={2}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              data-testid="button-cancel-add-item"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              data-testid="button-submit-add-item"
            >
              {createMutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Product, InsertProduct } from "@shared/schema";
import { ObjectUploader, type ObjectUploaderResult } from "@/components/ObjectUploader";
import { ImageIcon, Trash2, AlertTriangle, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {children}
      </span>
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Partial<InsertProduct>>({
    sku: "",
    name: "",
    description: "",
    ownership: "owned",
    productType: "principal",
    equivalentSku: undefined,
    requiresSupplier: false,
    unit: "unit",
    weight: undefined,
    dimensions: "",
    barcode: "",
    location: "",
    minimumStock: 0,
    currentStock: 0,
  });

  const { data: allProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        sku: product?.sku || "",
        name: product?.name || "",
        description: product?.description || "",
        ownership: product?.ownership || "owned",
        productType: product?.productType || "principal",
        equivalentSku: product?.equivalentSku || undefined,
        requiresSupplier: product?.requiresSupplier || false,
        unit: product?.unit || "unit",
        weight: product?.weight || undefined,
        dimensions: product?.dimensions || "",
        barcode: product?.barcode || "",
        location: product?.location || "",
        minimumStock: product?.minimumStock || 0,
        currentStock: product?.currentStock || 0,
      });
      setImageUrl(product?.imageUrl || null);
      setErrors({});
    }
  }, [open, product]);

  const principalProducts =
    allProducts?.filter((p) => p.productType === "principal" && p.id !== product?.id) || [];

  const isLowStock =
    (formData.minimumStock ?? 0) > 0 &&
    (formData.currentStock ?? 0) <= (formData.minimumStock ?? 0);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.sku?.trim()) newErrors.sku = "Informe o SKU do produto.";
    if (!formData.name?.trim()) newErrors.name = "Informe o nome do produto.";
    if (!formData.unit?.trim()) newErrors.unit = "Informe a unidade do produto.";
    if (formData.productType === "variante" && !formData.equivalentSku) {
      newErrors.equivalentSku = "Selecione o produto principal para esta variante.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      const created: any = await apiRequest("POST", "/api/products", data);
      if (imageUrl && created.id) {
        try {
          const imageResponse: any = await apiRequest("PUT", `/api/products/${created.id}/image`, {
            imageUrl,
          });
          if (imageResponse.objectPath) setImageUrl(imageResponse.objectPath);
        } catch {
          toast({ description: "Produto criado, mas houve erro ao processar a imagem.", variant: "destructive" });
        }
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ description: "Produto criado com sucesso." });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg = error?.message || "";
      if (msg.includes("409") || msg.includes("duplicate") || msg.includes("SKU")) {
        setErrors((prev) => ({ ...prev, sku: "SKU já cadastrado. Escolha outro." }));
        toast({ description: "SKU já cadastrado.", variant: "destructive" });
      } else if (msg.includes("barcode")) {
        setErrors((prev) => ({ ...prev, barcode: "Código de barras já cadastrado." }));
        toast({ description: "Código de barras já cadastrado.", variant: "destructive" });
      } else {
        toast({ description: "Erro ao criar produto. Verifique os dados e tente novamente.", variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertProduct>) =>
      apiRequest("PATCH", `/api/products/${product?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ description: "Produto atualizado com sucesso." });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const msg = error?.message || "";
      if (msg.includes("409") || msg.includes("duplicate") || msg.includes("SKU")) {
        setErrors((prev) => ({ ...prev, sku: "SKU já cadastrado. Escolha outro." }));
        toast({ description: "SKU já cadastrado.", variant: "destructive" });
      } else if (msg.includes("barcode")) {
        setErrors((prev) => ({ ...prev, barcode: "Código de barras já cadastrado." }));
        toast({ description: "Código de barras já cadastrado.", variant: "destructive" });
      } else {
        toast({ description: "Erro ao atualizar produto. Verifique os dados e tente novamente.", variant: "destructive" });
      }
    },
  });

  const handleUploadComplete = async (result: ObjectUploaderResult) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const objectPath = (uploadedFile.response as any)?.body?.url as string;
      if (!objectPath) {
        toast({ description: "Erro: URL da imagem não recebida.", variant: "destructive" });
        return;
      }
      if (!product?.id) {
        setImageUrl(objectPath);
        toast({ description: "Imagem carregada. Será salva ao confirmar o produto." });
        return;
      }
      try {
        const response: any = await apiRequest("PUT", `/api/products/${product.id}/image`, {
          imageUrl: objectPath,
        });
        setImageUrl(response.objectPath || objectPath);
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        toast({ description: "Imagem atualizada com sucesso." });
      } catch {
        toast({ description: "Erro ao atualizar imagem.", variant: "destructive" });
      }
    }
  };

  const handleRemoveImage = async () => {
    if (product?.id) {
      try {
        await apiRequest("PATCH", `/api/products/${product.id}`, { imageUrl: null });
        setImageUrl(null);
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        toast({ description: "Imagem removida com sucesso." });
      } catch {
        toast({ description: "Erro ao remover imagem.", variant: "destructive" });
      }
    } else {
      setImageUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const submitData: InsertProduct = {
      sku: formData.sku!.trim(),
      name: formData.name!.trim(),
      description: formData.description?.trim() || undefined,
      ownership: (formData.ownership as any) || "owned",
      productType: (formData.productType as any) || "principal",
      equivalentSku: formData.productType === "variante" ? formData.equivalentSku : undefined,
      requiresSupplier: formData.requiresSupplier || false,
      unit: formData.unit?.trim() || "unit",
      weight: formData.weight,
      dimensions: formData.dimensions?.trim() || undefined,
      barcode: formData.barcode?.trim() || undefined,
      location: formData.location?.trim() || undefined,
      minimumStock: formData.minimumStock ?? 0,
      currentStock: formData.currentStock ?? 0,
    };

    if (product) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col p-0 gap-0 max-h-[90vh] border-border/60">
        {/* Fixed header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>
            {product
              ? "Atualize as informações do produto para uso em estoque, requisições e movimentações."
              : "Cadastre as informações do item para uso em estoque, requisições e movimentações."}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable form body */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
          id="product-form"
        >
          <div
            className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
            style={{ scrollbarWidth: "thin" }}
          >
            {/* ── A. Identificação ── */}
            <SectionLabel>Identificação</SectionLabel>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sku">
                  SKU <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => {
                    setFormData({ ...formData, sku: e.target.value });
                    if (errors.sku) setErrors((prev) => ({ ...prev, sku: "" }));
                  }}
                  placeholder="Ex: PROD-001"
                  className={`font-mono ${errors.sku ? "border-destructive" : ""}`}
                  data-testid="input-sku"
                />
                {errors.sku && (
                  <p className="text-xs text-destructive">{errors.sku}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="Nome do produto"
                  className={errors.name ? "border-destructive" : ""}
                  data-testid="input-name"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do produto, características ou observações"
                rows={2}
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="productType">Tipo de Produto</Label>
                <Select
                  value={formData.productType as string}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      productType: value as any,
                      equivalentSku: value === "principal" ? undefined : formData.equivalentSku,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-product-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principal">Principal</SelectItem>
                    <SelectItem value="variante">Variante</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.productType === "variante" && (
                <div className="space-y-1.5">
                  <Label htmlFor="equivalentSku">
                    Produto Principal <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.equivalentSku || ""}
                    onValueChange={(value) => {
                      setFormData({ ...formData, equivalentSku: value });
                      if (errors.equivalentSku) setErrors((prev) => ({ ...prev, equivalentSku: "" }));
                    }}
                  >
                    <SelectTrigger
                      data-testid="select-principal-product"
                      className={errors.equivalentSku ? "border-destructive" : ""}
                    >
                      <SelectValue placeholder="Selecione o produto principal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {principalProducts.map((p) => (
                        <SelectItem key={p.id} value={p.sku}>
                          {p.sku} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.equivalentSku && (
                    <p className="text-xs text-destructive">{errors.equivalentSku}</p>
                  )}
                </div>
              )}
            </div>

            {/* ── B. Controle Operacional ── */}
            <SectionLabel>Controle Operacional</SectionLabel>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ownership">Titularidade</Label>
                <Select
                  value={formData.ownership as string}
                  onValueChange={(value) => setFormData({ ...formData, ownership: value as any })}
                >
                  <SelectTrigger data-testid="select-ownership">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owned">Próprio</SelectItem>
                    <SelectItem value="rented">Locado</SelectItem>
                    <SelectItem value="third_party">Terceiros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="unit">
                  Unidade <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => {
                    setFormData({ ...formData, unit: e.target.value });
                    if (errors.unit) setErrors((prev) => ({ ...prev, unit: "" }));
                  }}
                  placeholder="Ex: unidade, caixa, metro"
                  className={errors.unit ? "border-destructive" : ""}
                  data-testid="input-unit"
                />
                {errors.unit && (
                  <p className="text-xs text-destructive">{errors.unit}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.weight || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, weight: e.target.value || undefined })
                  }
                  placeholder="0,00"
                  data-testid="input-weight"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="barcode">Código de Barras / QR Code</Label>
                <Input
                  id="barcode"
                  value={formData.barcode || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, barcode: e.target.value });
                    if (errors.barcode) setErrors((prev) => ({ ...prev, barcode: "" }));
                  }}
                  placeholder="Código de barras ou QR code"
                  className={errors.barcode ? "border-destructive" : ""}
                  data-testid="input-barcode"
                />
                {errors.barcode && (
                  <p className="text-xs text-destructive">{errors.barcode}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location">Localização</Label>
                <Input
                  id="location"
                  value={formData.location || ""}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ex: Rua A, Prateleira 3, Box 02"
                  data-testid="input-location"
                />
              </div>
            </div>

            {/* ── C. Estoque ── */}
            <SectionLabel>Estoque</SectionLabel>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentStock">Estoque Atual</Label>
                <Input
                  id="currentStock"
                  type="number"
                  min="0"
                  value={formData.currentStock ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })
                  }
                  data-testid="input-current-stock"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="minimumStock">Estoque Mínimo</Label>
                <Input
                  id="minimumStock"
                  type="number"
                  min="0"
                  value={formData.minimumStock ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, minimumStock: parseInt(e.target.value) || 0 })
                  }
                  data-testid="input-minimum-stock"
                />
              </div>
            </div>

            {isLowStock && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Este produto ficará marcado como <strong>estoque baixo</strong> com os valores atuais.
                </p>
              </div>
            )}

            {/* ── D. Regras Operacionais ── */}
            <SectionLabel>Regras Operacionais</SectionLabel>

            <div className="rounded-md border border-border/60 bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="requiresSupplier"
                  checked={formData.requiresSupplier}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requiresSupplier: checked as boolean })
                  }
                  className="mt-0.5"
                  data-testid="checkbox-requires-supplier"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="requiresSupplier" className="text-sm font-medium cursor-pointer">
                    Exigir fornecedor ao movimentar este produto
                  </Label>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3 shrink-0" />
                    Use para itens locados ou de terceiros que precisam registrar origem/fornecedor.
                  </p>
                </div>
              </div>
            </div>

            {/* ── E. Imagem do Produto ── */}
            <SectionLabel>Imagem do Produto</SectionLabel>

            {imageUrl ? (
              <div className="flex items-center gap-4 p-3 rounded-md border border-border/60 bg-muted/20">
                <div className="h-20 w-20 rounded-md border border-border/60 overflow-hidden shrink-0">
                  <img
                    src={imageUrl}
                    alt="Pré-visualização"
                    className="h-full w-full object-cover"
                    data-testid="img-product-preview"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Imagem carregada</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Clique em remover para substituir a imagem.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveImage}
                  data-testid="button-remove-image"
                  className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Remover
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-6 flex flex-col items-center gap-3 text-center">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Arraste uma imagem aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PNG, JPG ou WebP — máximo 10 MB
                  </p>
                </div>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  onComplete={handleUploadComplete}
                  buttonVariant="outline"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Selecionar imagem
                </ObjectUploader>
              </div>
            )}
          </div>

          {/* Fixed footer */}
          <DialogFooter className="px-6 py-4 border-t border-border/40 shrink-0 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel-product"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !formData.sku?.trim() || !formData.name?.trim()}
              data-testid="button-submit-product"
            >
              {isPending ? "Salvando..." : "Salvar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

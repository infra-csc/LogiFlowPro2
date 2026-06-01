import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import type { Kit, InsertKit, Product, BomLine } from "@shared/schema";
import { Plus, Trash2, Image as ImageIcon, Boxes, Package } from "lucide-react";
import { ObjectUploader, type ObjectUploaderResult } from "@/components/ObjectUploader";

interface KitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit?: Kit;
}

type Parameter = {
  name: string;
  type: "number" | "select";
  unit?: string;
  options?: string[];
};

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

export function KitDialog({ open, onOpenChange, kit }: KitDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<InsertKit>>({
    name: "",
    description: "",
    parameters: [],
  });
  const [nameError, setNameError] = useState("");
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [bomLines, setBomLines] = useState<
    Array<{ productId: string; quantityFormula: string; notes?: string }>
  >([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: existingBomLines } = useQuery<BomLine[]>({
    queryKey: ["/api/kits", kit?.id, "bom"],
    enabled: !!kit?.id,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: kit?.name || "",
        description: kit?.description || "",
        parameters: kit?.parameters || [],
      });
      setParameters(kit?.parameters || []);
      setBomLines([]);
      setImageUrl(kit?.imageUrl || null);
      setNameError("");
    }
  }, [open, kit]);

  useEffect(() => {
    if (open && kit?.id && existingBomLines) {
      setBomLines(
        existingBomLines.map((line) => ({
          productId: line.productId,
          quantityFormula: line.quantityFormula,
          notes: line.notes || "",
        }))
      );
    }
  }, [open, kit?.id, existingBomLines]);

  const handleUploadComplete = async (result: ObjectUploaderResult) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const objectPath = (uploadedFile.response as any)?.body?.url as string;
      if (!objectPath) {
        toast({ description: "Erro: URL da imagem não recebida.", variant: "destructive" });
        return;
      }
      if (!kit?.id) {
        setImageUrl(objectPath);
        toast({ description: "Imagem carregada. Será salva ao confirmar o kit." });
        return;
      }
      try {
        const response: any = await apiRequest("PUT", `/api/kits/${kit.id}/image`, {
          imageUrl: objectPath,
        });
        setImageUrl(response.objectPath || objectPath);
        queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
        toast({ description: "Imagem atualizada com sucesso." });
      } catch {
        toast({ description: "Erro ao atualizar imagem.", variant: "destructive" });
      }
    }
  };

  const handleRemoveImage = async () => {
    if (kit?.id) {
      try {
        await apiRequest("PATCH", `/api/kits/${kit.id}`, { imageUrl: null });
        setImageUrl(null);
        queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
        toast({ description: "Imagem removida com sucesso." });
      } catch {
        toast({ description: "Erro ao remover imagem.", variant: "destructive" });
      }
    } else {
      setImageUrl(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: {
      kit: InsertKit;
      bomLines: Array<{ productId: string; quantityFormula: string; notes?: string }>;
    }) => {
      const created: any = await apiRequest("POST", "/api/kits", data);
      if (imageUrl && created.id) {
        try {
          const imageResponse: any = await apiRequest("PUT", `/api/kits/${created.id}/image`, {
            imageUrl,
          });
          if (imageResponse.objectPath) setImageUrl(imageResponse.objectPath);
        } catch {
          toast({ description: "Kit criado, mas houve erro ao processar a imagem.", variant: "destructive" });
        }
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
      toast({ description: "Kit criado com sucesso." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao criar kit. Verifique os dados e tente novamente.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      kit: Partial<InsertKit>;
      bomLines: Array<{ productId: string; quantityFormula: string; notes?: string }>;
    }) => apiRequest("PATCH", `/api/kits/${kit?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
      if (kit?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/kits", kit.id, "bom"] });
      }
      toast({ description: "Kit atualizado com sucesso." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao atualizar kit.", variant: "destructive" });
    },
  });

  const addParameter = () =>
    setParameters([...parameters, { name: "", type: "number", unit: "" }]);

  const removeParameter = (index: number) =>
    setParameters(parameters.filter((_, i) => i !== index));

  const updateParameter = (index: number, field: keyof Parameter, value: any) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  const addBomLine = () =>
    setBomLines([...bomLines, { productId: "", quantityFormula: "1", notes: "" }]);

  const removeBomLine = (index: number) =>
    setBomLines(bomLines.filter((_, i) => i !== index));

  const updateBomLine = (index: number, field: string, value: string) => {
    const updated = [...bomLines];
    updated[index] = { ...updated[index], [field]: value };
    setBomLines(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setNameError("Informe o nome do kit.");
      return;
    }
    if (parameters.length === 0) {
      toast({ description: "Adicione ao menos um parâmetro antes de salvar.", variant: "destructive" });
      return;
    }

    const submitData: InsertKit = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      parameters,
    };

    if (kit) {
      updateMutation.mutate({ kit: submitData, bomLines });
    } else {
      createMutation.mutate({ kit: submitData, bomLines });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const productMap = new Map(products?.map((p) => [p.id, p]) || []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl flex flex-col p-0 gap-0 max-h-[90vh] border-border/60">
        {/* Fixed header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle>{kit ? "Editar Kit" : "Novo Kit"}</DialogTitle>
          <DialogDescription>
            Defina um kit paramétrico com parâmetros e lista de materiais (BOM).
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable form body */}
        <form
          id="kit-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div
            className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
            style={{ scrollbarWidth: "thin" }}
          >
            {/* ── A. Identificação ── */}
            <SectionLabel>Identificação</SectionLabel>

            <div className="space-y-1.5">
              <Label htmlFor="kit-name">
                Nome do Kit <span className="text-destructive">*</span>
              </Label>
              <Input
                id="kit-name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (nameError) setNameError("");
                }}
                placeholder="Ex: Palco Modular 10x8"
                className={nameError ? "border-destructive" : ""}
                data-testid="input-kit-name"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kit-description">Descrição</Label>
              <Textarea
                id="kit-description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do kit, finalidade ou observações"
                rows={2}
                data-testid="input-kit-description"
              />
            </div>

            {/* ── B. Imagem do Kit ── */}
            <SectionLabel>Imagem do Kit</SectionLabel>

            {imageUrl ? (
              <div className="flex items-center gap-4 p-3 rounded-md border border-border/60 bg-muted/20">
                <div className="h-20 w-20 rounded-md border border-border/60 overflow-hidden shrink-0">
                  <img
                    src={imageUrl}
                    alt="Pré-visualização do kit"
                    className="h-full w-full object-cover"
                    data-testid="img-kit-preview"
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

            {/* ── C. Parâmetros ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Parâmetros
                </span>
                <div className="border-t border-border/40 w-12" />
                <span className="text-destructive text-xs">*</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addParameter}
                data-testid="button-add-parameter"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Parâmetro
              </Button>
            </div>

            <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Parâmetros permitem calcular quantidades do BOM automaticamente. Ex: largura, altura, quantidade.
              </p>
            </div>

            {parameters.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 py-6 flex flex-col items-center gap-2 text-center">
                <Boxes className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum parâmetro definido.</p>
                <Button type="button" variant="ghost" size="sm" onClick={addParameter} className="text-primary">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar parâmetro
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {parameters.map((param, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-end rounded-md border border-border/60 bg-card px-3 py-3"
                    data-testid={`param-row-${index}`}
                  >
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={param.name}
                        onChange={(e) => updateParameter(index, "name", e.target.value)}
                        placeholder="Ex: Largura, Altura..."
                        className="h-8 text-sm"
                        data-testid={`input-param-name-${index}`}
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={param.type}
                        onValueChange={(value) => updateParameter(index, "type", value)}
                      >
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-param-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="number">Número</SelectItem>
                          <SelectItem value="select">Seleção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">
                        {param.type === "select" ? "Opções (vírgula)" : "Unidade"}
                      </Label>
                      <Input
                        value={
                          param.type === "select"
                            ? param.options?.join(",") || ""
                            : param.unit || ""
                        }
                        onChange={(e) => {
                          if (param.type === "select") {
                            updateParameter(
                              index,
                              "options",
                              e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                            );
                          } else {
                            updateParameter(index, "unit", e.target.value);
                          }
                        }}
                        placeholder={param.type === "select" ? "Ex: P,M,G" : "Ex: m, kg, unid"}
                        className="h-8 text-sm"
                        data-testid={`input-param-${param.type === "select" ? "options" : "unit"}-${index}`}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeParameter(index)}
                        data-testid={`button-remove-param-${index}`}
                        aria-label="Remover parâmetro"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── D. Itens do BOM ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Itens do Kit (BOM)
                </span>
                <div className="border-t border-border/40 w-12" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addBomLine}
                data-testid="button-add-bom-line"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Item
              </Button>
            </div>

            {bomLines.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 py-6 flex flex-col items-center gap-2 text-center">
                <Package className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum item no BOM.</p>
                <Button type="button" variant="ghost" size="sm" onClick={addBomLine} className="text-primary">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar item
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {bomLines.map((line, index) => {
                  const selectedProduct = line.productId ? productMap.get(line.productId) : undefined;
                  return (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-end rounded-md border border-border/60 bg-card px-3 py-3"
                      data-testid={`bom-row-${index}`}
                    >
                      <div className="col-span-6 space-y-1">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={line.productId}
                          onValueChange={(value) => updateBomLine(index, "productId", value)}
                        >
                          <SelectTrigger className="h-8 text-sm" data-testid={`select-bom-product-${index}`}>
                            <SelectValue placeholder="Selecionar produto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}{" "}
                                <span className="text-muted-foreground font-mono text-xs">
                                  ({product.sku})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedProduct && (
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {selectedProduct.sku} · {selectedProduct.unit}
                          </p>
                        )}
                      </div>
                      <div className="col-span-5 space-y-1">
                        <Label className="text-xs">Fórmula de Quantidade</Label>
                        <Input
                          value={line.quantityFormula}
                          onChange={(e) => updateBomLine(index, "quantityFormula", e.target.value)}
                          placeholder="Ex: largura * altura / 2"
                          className="h-8 text-sm font-mono"
                          data-testid={`input-bom-formula-${index}`}
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBomLine(index)}
                          data-testid={`button-remove-bom-${index}`}
                          aria-label="Remover item do BOM"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── E. Resumo ── */}
            {(parameters.length > 0 || bomLines.length > 0) && (
              <>
                <SectionLabel>Resumo</SectionLabel>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Parâmetros", value: parameters.length },
                    { label: "Itens no BOM", value: bomLines.length },
                    { label: "Imagem", value: imageUrl ? "Sim" : "Não" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-md border border-border/60 bg-card px-3 py-2.5 text-center"
                    >
                      <p className="text-lg font-bold text-foreground">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Fixed footer */}
          <DialogFooter className="px-6 py-4 border-t border-border/40 shrink-0 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel-kit"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !formData.name?.trim()}
              data-testid="button-submit-kit"
            >
              {isPending ? "Salvando..." : "Salvar Kit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

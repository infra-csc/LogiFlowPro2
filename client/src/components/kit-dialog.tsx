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
import { Plus, Trash2, Image as ImageIcon, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

export function KitDialog({ open, onOpenChange, kit }: KitDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<InsertKit>>({
    name: "",
    description: "",
    parameters: [],
  });

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [bomLines, setBomLines] = useState<Array<{ productId: string; quantityFormula: string; notes?: string }>>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: existingBomLines } = useQuery<BomLine[]>({
    queryKey: ["/api/kits", kit?.id, "bom"],
    enabled: !!kit?.id,
  });

  // Reset form data when dialog opens or kit changes
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
    }
  }, [open, kit]);

  // Load existing BOM lines when editing a kit
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
      // Get the URL from the server response
      const objectPath = (uploadedFile.response as any)?.body?.url as string;

      if (!objectPath) {
        toast({ description: "Erro: URL da imagem não recebida", variant: "destructive" });
        return;
      }

      if (!kit?.id) {
        // If creating a new kit, just store the URL to be used after creation
        setImageUrl(objectPath);
        toast({ description: "Imagem carregada com sucesso" });
        return;
      }

      // If editing, update the kit image immediately
      try {
        const response: any = await apiRequest("PUT", `/api/kits/${kit.id}/image`, {
          imageUrl: objectPath,
        });
        // Use the normalized object path from the response
        setImageUrl(response.objectPath || objectPath);
        queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
        toast({ description: "Imagem atualizada com sucesso" });
      } catch (error) {
        toast({ description: "Erro ao atualizar imagem", variant: "destructive" });
      }
    }
  };

  const handleRemoveImage = async () => {
    if (kit?.id) {
      // If editing, update the kit to remove the image
      try {
        await apiRequest("PATCH", `/api/kits/${kit.id}`, {
          imageUrl: null,
        });
        setImageUrl(null);
        queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
        toast({ description: "Imagem removida com sucesso" });
      } catch (error) {
        toast({ description: "Erro ao remover imagem", variant: "destructive" });
      }
    } else {
      // If creating, just clear the local state
      setImageUrl(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: { kit: InsertKit; bomLines: Array<{ productId: string; quantityFormula: string; notes?: string }> }) => {
      const kit: any = await apiRequest("POST", "/api/kits", data);
      
      // If there's an image URL from upload, set it with proper ACL
      if (imageUrl && kit.id) {
        try {
          const imageResponse: any = await apiRequest("PUT", `/api/kits/${kit.id}/image`, {
            imageUrl: imageUrl,
          });
          // Update local state with the normalized object path
          if (imageResponse.objectPath) {
            setImageUrl(imageResponse.objectPath);
          }
        } catch (error) {
          console.error("Failed to set kit image:", error);
          toast({ 
            description: "Kit criado, mas houve erro ao processar a imagem", 
            variant: "destructive" 
          });
        }
      }
      
      return kit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
      toast({ description: "Kit criado com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao criar kit", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { kit: Partial<InsertKit>; bomLines: Array<{ productId: string; quantityFormula: string; notes?: string }> }) => {
      return apiRequest("PATCH", `/api/kits/${kit?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
      if (kit?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/kits", kit.id, "bom"] });
      }
      toast({ description: "Kit atualizado com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao atualizar kit", variant: "destructive" });
    },
  });

  const addParameter = () => {
    setParameters([...parameters, { name: "", type: "number", unit: "" }]);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const updateParameter = (index: number, field: keyof Parameter, value: any) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  const addBomLine = () => {
    setBomLines([...bomLines, { productId: "", quantityFormula: "1", notes: "" }]);
  };

  const removeBomLine = (index: number) => {
    setBomLines(bomLines.filter((_, i) => i !== index));
  };

  const updateBomLine = (index: number, field: string, value: string) => {
    const updated = [...bomLines];
    updated[index] = { ...updated[index], [field]: value };
    setBomLines(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || parameters.length === 0) {
      toast({ description: "Preencha o nome e adicione ao menos um parâmetro", variant: "destructive" });
      return;
    }

    const submitData: InsertKit = {
      name: formData.name,
      description: formData.description,
      parameters: parameters,
    };

    if (kit) {
      updateMutation.mutate({ kit: submitData, bomLines });
    } else {
      createMutation.mutate({ kit: submitData, bomLines });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0 border-border/60">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{kit ? "Editar Kit" : "Novo Kit"}</DialogTitle>
          <DialogDescription>
            {kit ? "Atualize a configuração e as fórmulas BOM do kit" : "Defina um kit paramétrico com geração automática de BOM"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <form id="kit-form" onSubmit={handleSubmit} className="space-y-6 pb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Kit *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Palco Modular 10x8"
                  data-testid="input-kit-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Kit description..."
                  rows={2}
                  data-testid="input-kit-description"
                />
              </div>

              <div className="space-y-2">
                <Label>Imagem do Kit</Label>
                {imageUrl ? (
                  <div className="relative">
                    <img 
                      src={imageUrl} 
                      alt="Kit preview" 
                      className="w-full h-48 object-cover rounded-md"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2"
                      data-testid="button-remove-image"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <ObjectUploader
                    onComplete={handleUploadComplete}
                    buttonClassName="w-full"
                    buttonVariant="outline"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Adicionar Imagem
                  </ObjectUploader>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Parâmetros *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addParameter} data-testid="button-add-parameter">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Parâmetro
                </Button>
              </div>

              {parameters.map((param, index) => (
                <Card key={index} className="border-border/60">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-4">
                        <Label>Nome</Label>
                        <Input
                          value={param.name}
                          onChange={(e) => updateParameter(index, "name", e.target.value)}
                          placeholder="Width, Height, etc."
                          data-testid={`input-param-name-${index}`}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label>Tipo</Label>
                        <Select
                          value={param.type}
                          onValueChange={(value) => updateParameter(index, "type", value)}
                        >
                          <SelectTrigger data-testid={`select-param-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="select">Seleção</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Label>{param.type === "select" ? "Options" : "Unit"}</Label>
                        <Input
                          value={param.type === "select" ? (param.options?.join(",") || "") : (param.unit || "")}
                          onChange={(e) => {
                            if (param.type === "select") {
                              updateParameter(index, "options", e.target.value.split(",").map(s => s.trim()).filter(Boolean));
                            } else {
                              updateParameter(index, "unit", e.target.value);
                            }
                          }}
                          placeholder={param.type === "select" ? "Option1,Option2,Option3" : "m, kg, etc."}
                          data-testid={`input-param-${param.type === "select" ? "options" : "unit"}-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeParameter(index)}
                          data-testid={`button-remove-param-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Itens do Kit (BOM)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBomLine} data-testid="button-add-bom-line">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Item
                </Button>
              </div>

              {bomLines.map((line, index) => (
                <Card key={index} className="border-border/60">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-5">
                        <Label>Produto</Label>
                        <Select
                          value={line.productId}
                          onValueChange={(value) => updateBomLine(index, "productId", value)}
                        >
                          <SelectTrigger data-testid={`select-bom-product-${index}`}>
                            <SelectValue placeholder="Selecionar produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} ({product.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-5">
                        <Label>Fórmula de Quantidade</Label>
                        <Input
                          value={line.quantityFormula}
                          onChange={(e) => updateBomLine(index, "quantityFormula", e.target.value)}
                          placeholder="width * height / 2"
                          data-testid={`input-bom-formula-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBomLine(index)}
                          data-testid={`button-remove-bom-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </form>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            type="submit"
            form="kit-form"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit-kit"
          >
            {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : "Salvar Kit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

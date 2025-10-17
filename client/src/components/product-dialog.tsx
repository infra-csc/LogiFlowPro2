import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import { ImageIcon, Trash2 } from "lucide-react";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InsertProduct>>({
    sku: "",
    name: "",
    description: "",
    ownership: "owned",
    unit: "unit",
    weight: undefined,
    dimensions: "",
    barcode: "",
    location: "",
    minimumStock: 0,
    currentStock: 0,
  });

  // Reset form data when dialog opens or product changes
  useEffect(() => {
    if (open) {
      console.log("ProductDialog: Loading product data", { 
        productId: product?.id, 
        imageUrl: product?.imageUrl 
      });
      setFormData({
        sku: product?.sku || "",
        name: product?.name || "",
        description: product?.description || "",
        ownership: product?.ownership || "owned",
        unit: product?.unit || "unit",
        weight: product?.weight || undefined,
        dimensions: product?.dimensions || "",
        barcode: product?.barcode || "",
        location: product?.location || "",
        minimumStock: product?.minimumStock || 0,
        currentStock: product?.currentStock || 0,
      });
      setImageUrl(product?.imageUrl || null);
    }
  }, [open, product]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      const product: any = await apiRequest("POST", "/api/products", data);
      
      // If there's an image URL from upload, set it with proper ACL
      if (imageUrl && product.id) {
        try {
          const imageResponse: any = await apiRequest("PUT", `/api/products/${product.id}/image`, {
            imageUrl: imageUrl,
          });
          // Update local state with the normalized object path
          if (imageResponse.objectPath) {
            setImageUrl(imageResponse.objectPath);
          }
        } catch (error) {
          console.error("Failed to set product image:", error);
          toast({ 
            description: "Produto criado, mas houve erro ao processar a imagem", 
            variant: "destructive" 
          });
        }
      }
      
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ description: "Produto criado com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Erro ao criar produto", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertProduct>) => {
      return apiRequest("PATCH", `/api/products/${product?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ description: "Product updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to update product", variant: "destructive" });
    },
  });

  const handleGetUploadParameters = async () => {
    const response: any = await apiRequest("POST", "/api/objects/upload", {});
    const data = await response.json();
    console.log("Upload parameters response:", data);
    console.log("Upload URL:", data.uploadURL);
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const uploadURL = uploadedFile.uploadURL as string;

      if (!product?.id) {
        // If creating a new product, just store the URL to be used after creation
        setImageUrl(uploadURL || null);
        toast({ description: "Imagem carregada com sucesso" });
        return;
      }

      // If editing, update the product image immediately
      try {
        const response: any = await apiRequest("PUT", `/api/products/${product.id}/image`, {
          imageUrl: uploadURL,
        });
        console.log("Image upload response:", response);
        // Use the normalized object path from the response
        setImageUrl(response.objectPath || uploadURL);
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        toast({ description: "Imagem atualizada com sucesso" });
      } catch (error) {
        console.error("Error uploading image:", error);
        toast({ description: "Erro ao atualizar imagem", variant: "destructive" });
      }
    }
  };

  const handleRemoveImage = async () => {
    if (product?.id) {
      // If editing, update the product to remove the image
      try {
        await apiRequest("PATCH", `/api/products/${product.id}`, {
          imageUrl: null,
        });
        setImageUrl(null);
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        toast({ description: "Imagem removida com sucesso" });
      } catch (error) {
        toast({ description: "Erro ao remover imagem", variant: "destructive" });
      }
    } else {
      // If creating, just clear the local state
      setImageUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sku || !formData.name) {
      toast({ description: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    const submitData: InsertProduct = {
      sku: formData.sku,
      name: formData.name,
      description: formData.description,
      ownership: formData.ownership as any || "owned",
      unit: formData.unit || "unit",
      weight: formData.weight,
      dimensions: formData.dimensions,
      barcode: formData.barcode,
      location: formData.location,
      minimumStock: formData.minimumStock || 0,
      currentStock: formData.currentStock || 0,
    };

    if (product) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update product details" : "Add a new product to the catalog"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="PROD-001"
                data-testid="input-sku"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product name"
                data-testid="input-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição do produto..."
              rows={2}
              data-testid="input-description"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ownership">Ownership</Label>
              <Select 
                value={formData.ownership as string}
                onValueChange={(value) => setFormData({ ...formData, ownership: value as any })}
              >
                <SelectTrigger data-testid="select-ownership">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owned">Owned</SelectItem>
                  <SelectItem value="rented">Rented</SelectItem>
                  <SelectItem value="third_party">Third Party</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="unit, box, meter"
                data-testid="input-unit"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                value={formData.weight || ""}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value || undefined })}
                placeholder="0.00"
                data-testid="input-weight"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="barcode">Código de Barras</Label>
              <Input
                id="barcode"
                value={formData.barcode || ""}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="Código de barras/QR code"
                data-testid="input-barcode"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Localização</Label>
              <Input
                id="location"
                value={formData.location || ""}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Zona do armazém"
                data-testid="input-location"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentStock">Estoque Atual</Label>
              <Input
                id="currentStock"
                type="number"
                value={formData.currentStock || 0}
                onChange={(e) => setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })}
                data-testid="input-current-stock"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimumStock">Estoque Mínimo</Label>
              <Input
                id="minimumStock"
                type="number"
                value={formData.minimumStock || 0}
                onChange={(e) => setFormData({ ...formData, minimumStock: parseInt(e.target.value) || 0 })}
                data-testid="input-minimum-stock"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Imagem do Produto</Label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative h-20 w-20 border rounded-md overflow-hidden">
                    <img 
                      src={imageUrl} 
                      alt="Product preview" 
                      className="h-full w-full object-cover"
                      data-testid="img-product-preview"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={handleRemoveImage}
                    data-testid="button-remove-image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleUploadComplete}
                  buttonVariant="outline"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Enviar Imagem
                </ObjectUploader>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-product"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (product ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
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
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
    name: kit?.name || "",
    description: kit?.description || "",
    parameters: kit?.parameters || [],
  });

  const [parameters, setParameters] = useState<Parameter[]>(kit?.parameters || []);
  const [bomLines, setBomLines] = useState<Array<{ productId: string; quantityFormula: string; notes?: string }>>([]);

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: existingBomLines } = useQuery<BomLine[]>({
    queryKey: ["/api/kits", kit?.id, "bom"],
    enabled: !!kit?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { kit: InsertKit; bomLines: Array<{ productId: string; quantityFormula: string; notes?: string }> }) => {
      return apiRequest("POST", "/api/kits", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
      toast({ description: "Kit created successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to create kit", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { kit: Partial<InsertKit>; bomLines: Array<{ productId: string; quantityFormula: string; notes?: string }> }) => {
      return apiRequest("PATCH", `/api/kits/${kit?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kits"] });
      toast({ description: "Kit updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ description: "Failed to update kit", variant: "destructive" });
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
      toast({ description: "Please provide a name and at least one parameter", variant: "destructive" });
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kit ? "Edit Kit" : "Create Kit"}</DialogTitle>
          <DialogDescription>
            {kit ? "Update kit configuration and BOM formulas" : "Define a parametric kit with automatic BOM generation"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Kit Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Modular Stage 10x8"
                data-testid="input-kit-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Kit description..."
                rows={2}
                data-testid="input-kit-description"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Parameters *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addParameter} data-testid="button-add-parameter">
                <Plus className="h-4 w-4 mr-1" />
                Add Parameter
              </Button>
            </div>

            {parameters.map((param, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-4">
                      <Label>Name</Label>
                      <Input
                        value={param.name}
                        onChange={(e) => updateParameter(index, "name", e.target.value)}
                        placeholder="Width, Height, etc."
                        data-testid={`input-param-name-${index}`}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label>Type</Label>
                      <Select
                        value={param.type}
                        onValueChange={(value) => updateParameter(index, "type", value)}
                      >
                        <SelectTrigger data-testid={`select-param-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="select">Select</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label>Unit</Label>
                      <Input
                        value={param.unit || ""}
                        onChange={(e) => updateParameter(index, "unit", e.target.value)}
                        placeholder="m, kg, etc."
                        data-testid={`input-param-unit-${index}`}
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
              <Label>BOM Lines</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBomLine} data-testid="button-add-bom-line">
                <Plus className="h-4 w-4 mr-1" />
                Add BOM Line
              </Button>
            </div>

            {bomLines.map((line, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5">
                      <Label>Product</Label>
                      <Select
                        value={line.productId}
                        onValueChange={(value) => updateBomLine(index, "productId", value)}
                      >
                        <SelectTrigger data-testid={`select-bom-product-${index}`}>
                          <SelectValue placeholder="Select product" />
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
                      <Label>Quantity Formula</Label>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-kit"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (kit ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

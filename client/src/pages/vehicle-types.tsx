import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Truck, Package2, Weight, Ruler, Maximize2, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VehicleType } from "@shared/schema";
import { insertVehicleTypeSchema } from "@shared/schema";
import type { z } from "zod";

type InsertVehicleType = z.infer<typeof insertVehicleTypeSchema>;

export default function VehicleTypes() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState<VehicleType | null>(null);
  const { toast } = useToast();
  const { data: vehicleTypes, isLoading } = useQuery<VehicleType[]>({ queryKey: ["/api/vehicle-types"] });

  const form = useForm<InsertVehicleType>({
    resolver: zodResolver(insertVehicleTypeSchema),
    defaultValues: {
      name: "",
      description: null,
      capacity: null,
      weightLimit: null,
      lengthLimit: null,
      cargoLength: null,
      cargoHeight: null,
      cargoWidth: null,
      axleCount: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertVehicleType) => {
      if (editingType) {
        return await apiRequest("PATCH", `/api/vehicle-types/${editingType.id}`, data);
      }
      return await apiRequest("POST", "/api/vehicle-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-types"] });
      toast({
        title: editingType ? "Tipo atualizado" : "Tipo criado",
        description: editingType 
          ? "O tipo de veículo foi atualizado com sucesso."
          : "O tipo de veículo foi criado com sucesso.",
      });
      setIsCreateOpen(false);
      setEditingType(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: editingType ? "Erro ao atualizar tipo" : "Erro ao criar tipo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVehicleType) => {
    createMutation.mutate(data);
  };

  const handleEdit = (vehicleType: VehicleType) => {
    setEditingType(vehicleType);
    form.reset({
      name: vehicleType.name,
      description: vehicleType.description || null,
      capacity: vehicleType.capacity || null,
      weightLimit: vehicleType.weightLimit || null,
      lengthLimit: vehicleType.lengthLimit || null,
      cargoLength: vehicleType.cargoLength || null,
      cargoHeight: vehicleType.cargoHeight || null,
      cargoWidth: vehicleType.cargoWidth || null,
      axleCount: vehicleType.axleCount || null,
    });
    setIsCreateOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingType(null);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Tipos de Veículos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os tipos de veículos e suas capacidades
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-vehicle-type">
              <Plus className="h-4 w-4 mr-2" />
              Novo Tipo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Editar Tipo de Veículo" : "Criar Novo Tipo de Veículo"}
              </DialogTitle>
              <DialogDescription>
                {editingType 
                  ? "Atualize as informações do tipo de veículo"
                  : "Adicione um novo tipo de veículo ao sistema"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Informações Básicas</h3>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Tipo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Caminhão Baú 3/4"
                            data-testid="input-vehicle-type-name"
                            {...field}
                          />
                        </FormControl>
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
                          <Textarea
                            placeholder="Informações adicionais sobre o tipo de veículo"
                            data-testid="input-vehicle-type-description"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Cargo Bay Measurements */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Medidas do Baú</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="cargoLength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Comprimento (m)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              data-testid="input-vehicle-type-cargo-length"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cargoHeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Altura (m)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              data-testid="input-vehicle-type-cargo-height"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cargoWidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Largura (m)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              data-testid="input-vehicle-type-cargo-width"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Other Specifications */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Outras Especificações</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="axleCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade de Eixos</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              data-testid="input-vehicle-type-axle-count"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacidade (m³)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              data-testid="input-vehicle-type-capacity"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="weightLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Limite de Peso (kg)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              data-testid="input-vehicle-type-weight"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lengthLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Limite de Comprimento (m)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              data-testid="input-vehicle-type-length"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Comprimento máximo de carga individual
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    data-testid="button-cancel-vehicle-type"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-vehicle-type"
                  >
                    {createMutation.isPending 
                      ? (editingType ? "Atualizando..." : "Criando...") 
                      : (editingType ? "Atualizar Tipo" : "Criar Tipo")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : vehicleTypes && vehicleTypes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vehicleTypes.map((type) => (
            <Card 
              key={type.id} 
              data-testid={`vehicle-type-card-${type.id}`}
              className="hover-elevate cursor-pointer"
              onClick={() => handleEdit(type)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-base">
                  <Truck className="h-5 w-5" />
                  {type.name}
                </div>
                {type.description && (
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                )}
                {/* Cargo Bay Measurements */}
                {(type.cargoLength || type.cargoHeight || type.cargoWidth) && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Medidas do Baú</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Maximize2 className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {type.cargoLength ? `${type.cargoLength}m` : "—"} × {type.cargoHeight ? `${type.cargoHeight}m` : "—"} × {type.cargoWidth ? `${type.cargoWidth}m` : "—"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Axle Count */}
                {type.axleCount !== null && parseInt(String(type.axleCount)) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Eixos:</span>
                    <span className="font-medium">{type.axleCount}</span>
                  </div>
                )}

                {/* Capacity */}
                {type.capacity !== null && parseFloat(type.capacity) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Capacidade:</span>
                    <span className="font-medium">{type.capacity} m³</span>
                  </div>
                )}

                {/* Weight Limit */}
                {type.weightLimit !== null && parseFloat(type.weightLimit) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Weight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Peso máx:</span>
                    <span className="font-medium">{type.weightLimit} kg</span>
                  </div>
                )}

                {/* Length Limit */}
                {type.lengthLimit !== null && parseFloat(type.lengthLimit) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Ruler className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Comp. máx carga:</span>
                    <span className="font-medium">{type.lengthLimit} m</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum tipo de veículo cadastrado. Crie o primeiro tipo clicando no botão acima.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

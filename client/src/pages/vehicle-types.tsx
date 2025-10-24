import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Truck, Package2, Weight, Ruler } from "lucide-react";
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
      capacity: null,
      weightLimit: null,
      lengthLimit: null,
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
      capacity: vehicleType.capacity || null,
      weightLimit: vehicleType.weightLimit || null,
      lengthLimit: vehicleType.lengthLimit || null,
    });
    setIsCreateOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingType(null);
    form.reset();
  };

  return (
    <div className="p-6 space-y-6">
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
          <DialogContent>
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {type.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {type.capacity !== null && parseFloat(type.capacity) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Capacidade:</span>
                    <span className="font-medium">{type.capacity} m³</span>
                  </div>
                )}
                {type.weightLimit !== null && parseFloat(type.weightLimit) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Weight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Peso máx:</span>
                    <span className="font-medium">{type.weightLimit} kg</span>
                  </div>
                )}
                {type.lengthLimit !== null && parseFloat(type.lengthLimit) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Ruler className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Comprimento:</span>
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

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Truck, Edit, Trash2, Ruler, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Vehicle, VehicleType } from "@shared/schema";
import { insertVehicleSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import type { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export default function Vehicles() {
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const { toast } = useToast();
  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: vehicleTypes } = useQuery<VehicleType[]>({ queryKey: ["/api/vehicle-types"] });

  const form = useForm<InsertVehicle>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: {
      plate: "",
      vehicleTypeId: undefined,
      type: "",
      model: undefined,
      cargoHeight: undefined,
      cargoWidth: undefined,
      cargoLength: undefined,
      truckPlate: undefined,
      trailerPlate: undefined,
      maxWeight: undefined,
      maxVolume: undefined,
      dimensions: undefined,
      active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertVehicle) => {
      if (editingVehicle) {
        return await apiRequest("PATCH", `/api/vehicles/${editingVehicle.id}`, data);
      }
      return await apiRequest("POST", "/api/vehicles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: editingVehicle ? "Veículo atualizado" : "Veículo criado",
        description: editingVehicle 
          ? "O veículo foi atualizado com sucesso."
          : "O veículo foi criado com sucesso.",
      });
      setIsCreateOpen(false);
      setEditingVehicle(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: editingVehicle ? "Erro ao atualizar veículo" : "Erro ao criar veículo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/vehicles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Veículo excluído",
        description: "O veículo foi excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir veículo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVehicle) => {
    createMutation.mutate(data);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    form.reset({
      plate: vehicle.plate,
      vehicleTypeId: vehicle.vehicleTypeId || undefined,
      type: vehicle.type,
      model: vehicle.model || undefined,
      cargoHeight: vehicle.cargoHeight || undefined,
      cargoWidth: vehicle.cargoWidth || undefined,
      cargoLength: vehicle.cargoLength || undefined,
      truckPlate: vehicle.truckPlate || undefined,
      trailerPlate: vehicle.trailerPlate || undefined,
      maxWeight: vehicle.maxWeight || undefined,
      maxVolume: vehicle.maxVolume || undefined,
      dimensions: vehicle.dimensions || undefined,
      active: vehicle.active,
    });
    setIsCreateOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      setEditingVehicle(null);
      form.reset();
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este veículo?")) {
      deleteMutation.mutate(id);
    }
  };

  const getVehicleTypeName = (vehicleTypeId: string | null) => {
    if (!vehicleTypeId || !vehicleTypes) return "-";
    const type = vehicleTypes.find(vt => vt.id === vehicleTypeId);
    return type?.name || "-";
  };

  if (isLoading) {
    return (
      <PageLoading message="Carregando veículos..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Veículos"
        description="Gerencie os veículos da frota"
      >
        <Dialog open={isCreateOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-vehicle">
              <Plus className="h-4 w-4 mr-2" />
              Novo Veículo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVehicle ? "Editar Veículo" : "Criar Novo Veículo"}
              </DialogTitle>
              <DialogDescription>
                {editingVehicle 
                  ? "Atualize as informações do veículo"
                  : "Adicione um novo veículo à frota"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Informações Básicas */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Informações Básicas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="plate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Placa</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="ABC-1234"
                              data-testid="input-vehicle-plate"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo (compatibilidade)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: Caminhão"
                              data-testid="input-vehicle-type"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vehicleTypeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Veículo</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-vehicle-type">
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vehicleTypes?.map((vt) => (
                                <SelectItem key={vt.id} value={vt.id}>
                                  {vt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: Mercedes-Benz Atego"
                              data-testid="input-vehicle-model"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Medidas do Baú */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    Medidas do Baú (metros)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="cargoLength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Comprimento</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-cargo-length"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
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
                          <FormLabel>Largura</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-cargo-width"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
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
                          <FormLabel>Altura</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-cargo-height"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Placas */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Placas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="truckPlate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chapa Cavalo</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="ABC-1234"
                              data-testid="input-truck-plate"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="trailerPlate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chapa Carreta</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="XYZ-5678"
                              data-testid="input-trailer-plate"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Capacidades */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Capacidades</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="maxWeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso Máximo (kg)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-max-weight"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxVolume"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Volume Máximo (m³)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-max-volume"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending ? "Salvando..." : (editingVehicle ? "Atualizar" : "Criar")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles?.map((vehicle) => (
          <Card key={vehicle.id} className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span data-testid={`text-vehicle-plate-${vehicle.id}`}>
                      {vehicle.plate}
                    </span>
                  </h3>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {canWrite && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(vehicle)}
                      data-testid={`button-edit-${vehicle.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {canWrite && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(vehicle.id)}
                      data-testid={`button-delete-${vehicle.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-medium" data-testid={`text-vehicle-type-${vehicle.id}`}>
                      {getVehicleTypeName(vehicle.vehicleTypeId)}
                    </p>
                  </div>
                  {vehicle.model && (
                    <div>
                      <p className="text-xs text-muted-foreground">Modelo</p>
                      <p className="font-medium" data-testid={`text-vehicle-model-${vehicle.id}`}>
                        {vehicle.model}
                      </p>
                    </div>
                  )}
                </div>

                {(vehicle.cargoLength || vehicle.cargoWidth || vehicle.cargoHeight) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Medidas do Baú (m)</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {vehicle.cargoLength && (
                        <div>
                          <p className="text-muted-foreground">Comp.</p>
                          <p className="font-medium">{vehicle.cargoLength}</p>
                        </div>
                      )}
                      {vehicle.cargoWidth && (
                        <div>
                          <p className="text-muted-foreground">Larg.</p>
                          <p className="font-medium">{vehicle.cargoWidth}</p>
                        </div>
                      )}
                      {vehicle.cargoHeight && (
                        <div>
                          <p className="text-muted-foreground">Alt.</p>
                          <p className="font-medium">{vehicle.cargoHeight}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(vehicle.truckPlate || vehicle.trailerPlate) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Placas</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {vehicle.truckPlate && (
                        <div>
                          <p className="text-muted-foreground">Cavalo</p>
                          <p className="font-medium">{vehicle.truckPlate}</p>
                        </div>
                      )}
                      {vehicle.trailerPlate && (
                        <div>
                          <p className="text-muted-foreground">Carreta</p>
                          <p className="font-medium">{vehicle.trailerPlate}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(vehicle.maxWeight || vehicle.maxVolume) && (
                  <div className="grid grid-cols-2 gap-2">
                    {vehicle.maxWeight && (
                      <div>
                        <p className="text-xs text-muted-foreground">Peso Máx.</p>
                        <p className="font-medium">{vehicle.maxWeight} kg</p>
                      </div>
                    )}
                    {vehicle.maxVolume && (
                      <div>
                        <p className="text-xs text-muted-foreground">Volume Máx.</p>
                        <p className="font-medium">{vehicle.maxVolume} m³</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-border/40">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                    vehicle.active
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-gray-500/10 text-gray-700 dark:text-gray-400"
                  }`}>
                    {vehicle.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {vehicles?.length === 0 && (
        <EmptyState
          icon={Truck}
          title="Nenhum veículo cadastrado"
          description="Clique em 'Novo Veículo' para começar."
        />
      )}
    </div>
  );
}

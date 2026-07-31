import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Truck, Edit, Trash2, Ruler, Tag, Search, Weight, Box } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Vehicle, VehicleType } from "@shared/schema";
import { insertVehicleSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";

const vehicleFormSchema = insertVehicleSchema.extend({
  type: z.string().optional().default(""),
});
type InsertVehicle = z.infer<typeof vehicleFormSchema>;

function parseApiError(err: Error): string {
  try {
    const match = err.message.match(/^(\d+): ([\s\S]+)$/);
    if (match) {
      const parsed = JSON.parse(match[2]);
      return parsed.error ?? err.message;
    }
  } catch {}
  return err.message;
}

function SectionDivider({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 border-t border-border/40" />
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}

export default function Vehicles() {
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: vehicleTypes } = useQuery<VehicleType[]>({ queryKey: ["/api/vehicle-types"] });

  const form = useForm<InsertVehicle>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      plate: undefined,
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

  const watchedVehicleTypeId = form.watch("vehicleTypeId");
  useEffect(() => {
    if (watchedVehicleTypeId && vehicleTypes) {
      const vt = vehicleTypes.find((v) => v.id === watchedVehicleTypeId);
      if (vt) form.setValue("type", vt.name);
    }
  }, [watchedVehicleTypeId, vehicleTypes]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertVehicle) => {
      const payload = { ...data, type: data.type || "" };
      if (editingVehicle) {
        return await apiRequest("PATCH", `/api/vehicles/${editingVehicle.id}`, payload);
      }
      return await apiRequest("POST", "/api/vehicles", payload);
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
        description: parseApiError(error),
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
      toast({ title: "Veículo excluído", description: "O veículo foi excluído com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir veículo", description: error.message, variant: "destructive" });
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
    const vt = vehicleTypes.find((v) => v.id === vehicleTypeId);
    return vt?.name || "-";
  };

  const filteredVehicles = (vehicles ?? []).filter((v) => {
    const q = search.toLowerCase();
    return (
      (v.plate ?? "").toLowerCase().includes(q) ||
      (v.truckPlate ?? "").toLowerCase().includes(q) ||
      (v.trailerPlate ?? "").toLowerCase().includes(q) ||
      (v.type && v.type.toLowerCase().includes(q)) ||
      (v.model && v.model.toLowerCase().includes(q)) ||
      getVehicleTypeName(v.vehicleTypeId).toLowerCase().includes(q)
    );
  });

  if (isLoading) return <PageLoading message="Carregando veículos..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Veículos" description="Gerencie a frota e seus tipos">
        <Dialog open={isCreateOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-vehicle">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Veículo
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl border-border/60">
            <DialogHeader>
              <DialogTitle>
                {editingVehicle ? "Editar Veículo" : "Criar Novo Veículo"}
              </DialogTitle>
              <DialogDescription>
                {editingVehicle ? "Atualize as informações do veículo." : "Preencha os dados do veículo a ser adicionado à frota."}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* Identificação principal */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="plate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Placa
                          <span className="text-muted-foreground text-xs font-normal ml-1">(opcional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ABC-1234"
                            data-testid="input-vehicle-plate"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehicleTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Veículo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
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
                </div>

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Mercedes-Benz Atego 2430"
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

                {/* Baú */}
                <SectionDivider icon={Ruler} label="Baú (metros)" />

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: "cargoLength" as const, label: "Comprimento", testid: "input-cargo-length" },
                    { name: "cargoWidth" as const, label: "Largura", testid: "input-cargo-width" },
                    { name: "cargoHeight" as const, label: "Altura", testid: "input-cargo-height" },
                  ].map(({ name, label, testid }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              data-testid={testid}
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                {/* Placas — cavalo e carreta (conjuntos com duas placas) */}
                <SectionDivider icon={Tag} label="Placa do Cavalo e da Carreta" />
                <p className="text-xs text-muted-foreground -mt-2">
                  Para conjuntos (cavalo + carreta), informe as duas placas. Veículos de unidade única podem usar apenas a “Placa” acima.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="truckPlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa do Cavalo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ABC-1234"
                            data-testid="input-truck-plate"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase() || undefined)}
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
                        <FormLabel>Placa da Carreta</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="XYZ-5678"
                            data-testid="input-trailer-plate"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase() || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Capacidades */}
                <SectionDivider icon={Weight} label="Capacidades" />

                <div className="grid grid-cols-2 gap-3">
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

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-2">
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
                    {createMutation.isPending
                      ? "Salvando..."
                      : editingVehicle
                      ? "Salvar Veículo"
                      : "Criar Veículo"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {(vehicles?.length ?? 0) > 0 && (
        <FilterBar
          badgeCount={search ? 1 : 0}
          onClear={search ? () => setSearch("") : undefined}
          defaultOpen
        >
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Placa, modelo, tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-card border-border/60 rounded-md text-sm"
                data-testid="input-search-vehicles"
              />
            </div>
          </div>
        </FilterBar>
      )}

      {filteredVehicles.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={search ? "Nenhum veículo encontrado" : "Nenhum veículo cadastrado"}
          description={search ? "Tente ajustar a busca." : "Clique em 'Adicionar Veículo' para começar."}
          action={!search && canWrite ? { label: "Adicionar Veículo", onClick: () => setIsCreateOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="hover-elevate border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span data-testid={`text-vehicle-plate-${vehicle.id}`} className="truncate">
                        {vehicle.plate || vehicle.truckPlate || vehicle.trailerPlate || "Sem placa"}
                      </span>
                    </h3>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {canWrite && (
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(vehicle)} data-testid={`button-edit-${vehicle.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canWrite && (
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(vehicle.id)} data-testid={`button-delete-${vehicle.id}`}>
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
                        <p className="font-medium truncate" data-testid={`text-vehicle-model-${vehicle.id}`}>
                          {vehicle.model}
                        </p>
                      </div>
                    )}
                  </div>

                  {(vehicle.truckPlate || vehicle.trailerPlate) && (
                    <div className="grid grid-cols-2 gap-2">
                      {vehicle.truckPlate && (
                        <div>
                          <p className="text-xs text-muted-foreground">Placa do Cavalo</p>
                          <p className="font-medium font-mono truncate" data-testid={`text-vehicle-truck-plate-${vehicle.id}`}>
                            {vehicle.truckPlate}
                          </p>
                        </div>
                      )}
                      {vehicle.trailerPlate && (
                        <div>
                          <p className="text-xs text-muted-foreground">Placa da Carreta</p>
                          <p className="font-medium font-mono truncate" data-testid={`text-vehicle-trailer-plate-${vehicle.id}`}>
                            {vehicle.trailerPlate}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

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
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {vehicle.maxWeight && (
                        <div>
                          <p className="text-muted-foreground">Peso máx.</p>
                          <p className="font-medium">{vehicle.maxWeight} kg</p>
                        </div>
                      )}
                      {vehicle.maxVolume && (
                        <div>
                          <p className="text-muted-foreground">Volume máx.</p>
                          <p className="font-medium">{vehicle.maxVolume} m³</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

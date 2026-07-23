import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCrudMutations } from "@/hooks/use-crud-mutations";
import { Plus, Edit, MapPin } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  type: z.enum(["warehouse", "special_area", "external", "event"]),
  parentLocationId: z.string().optional().nullable(),
  maxCapacity: z.number().optional().nullable(),
  active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

type Location = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: "warehouse" | "special_area" | "external" | "event";
  parentLocationId: string | null;
  maxCapacity: number | null;
  responsibleUserId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const typeLabels = {
  warehouse: "Galpão/Armazém",
  special_area: "Área Especial",
  external: "Externa",
  event: "Em Evento",
};

export default function LocationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      type: "warehouse",
      parentLocationId: null,
      maxCapacity: null,
      active: true,
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingLocation(null);
    form.reset();
  };

  const { create, update } = useCrudMutations<FormData>(
    "/api/locations",
    { entity: "Localização", created: "Localização criada com sucesso", updated: "Localização atualizada" },
    { onCreated: closeDialog, onUpdated: closeDialog }
  );
  const isSaving = create.isPending || update.isPending;

  const onSubmit = (data: FormData) => {
    if (editingLocation) {
      update.mutate({ id: editingLocation.id, data });
    } else {
      create.mutate(data);
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    form.reset({
      code: location.code,
      name: location.name,
      description: location.description || "",
      type: location.type,
      parentLocationId: location.parentLocationId,
      maxCapacity: location.maxCapacity,
      active: location.active,
    });
    setDialogOpen(true);
  };

  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const parentLocationName = (parentId: string | null) => {
    if (!parentId) return "-";
    const parent = locations.find(l => l.id === parentId);
    return parent ? parent.name : "-";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Localizações"
        description="Cadastro de localizações físicas para controle de produtos"
      >
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingLocation(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-location">
              <Plus className="h-4 w-4 mr-2" />
              Nova Localização
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl border-border/60">
                <DialogHeader>
                  <DialogTitle>{editingLocation ? "Editar Localização" : "Nova Localização"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código *</FormLabel>
                            <FormControl>
                              <Input placeholder="GALPAO_A" {...field} data-testid="input-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome *</FormLabel>
                            <FormControl>
                              <Input placeholder="Galpão A" {...field} data-testid="input-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Input placeholder="Descrição da localização" {...field} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="warehouse">Galpão/Armazém</SelectItem>
                                <SelectItem value="special_area">Área Especial</SelectItem>
                                <SelectItem value="external">Externa</SelectItem>
                                <SelectItem value="event">Em Evento</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maxCapacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Capacidade Máxima</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="5000"
                                {...field}
                                value={field.value || ""}
                                onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                data-testid="input-capacity"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Deixe vazio se não houver limite
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="parentLocationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Localização Pai</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-parent">
                                <SelectValue placeholder="Nenhuma (raiz)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma (raiz)</SelectItem>
                              {locations
                                .filter(l => l.id !== editingLocation?.id)
                                .map(location => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            Para criar hierarquia de localizações
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="active"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <FormLabel>Ativo</FormLabel>
                            <FormDescription className="text-xs">
                              Localização disponível para uso
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-active"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          setEditingLocation(null);
                          form.reset();
                        }}
                        data-testid="button-cancel"
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isSaving} data-testid="button-submit">
                        {isSaving ? "Salvando..." : editingLocation ? "Salvar Localização" : "Criar Localização"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
      </PageHeader>

      <div className="space-y-4">
        <FilterBar badgeCount={searchQuery ? 1 : 0} onClear={searchQuery ? () => setSearchQuery("") : undefined} defaultOpen>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Busca</label>
            <Input
              placeholder="Buscar por código ou nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 bg-card border-border/60 text-sm"
              data-testid="input-search"
            />
          </div>
        </FilterBar>

            {isLoading ? (
              <PageLoading message="Carregando localizações..." />
            ) : filteredLocations.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title={searchQuery ? "Nenhuma localização encontrada" : "Nenhuma localização cadastrada"}
                description={searchQuery ? "Tente ajustar a busca" : "Adicione a primeira localização clicando no botão acima"}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLocations.map((location) => (
                  <Card key={location.id} className="border-border/60 hover-elevate" data-testid={`card-location-${location.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <MapPin className="h-5 w-5 text-primary/70 flex-shrink-0" />
                          <h3 className="font-semibold text-base truncate">{location.name}</h3>
                        </div>
                        <Badge variant="outline" className="flex-shrink-0">{typeLabels[location.type]}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40 text-sm text-muted-foreground">
                        <span className="font-mono text-foreground">{location.code}</span>
                        {location.maxCapacity ? (
                          <span>{location.maxCapacity.toLocaleString()} itens</span>
                        ) : (
                          <span>Capacidade ilimitada</span>
                        )}
                        {location.parentLocationId && (
                          <span>Pai: {parentLocationName(location.parentLocationId)}</span>
                        )}
                        {location.active ? (
                          <Badge variant="default">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/40">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleEdit(location)}
                          data-testid={`button-edit-${location.id}`}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
    </div>
  );
}

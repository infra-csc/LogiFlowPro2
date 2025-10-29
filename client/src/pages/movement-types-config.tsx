import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMovementTypeConfigSchema, type MovementGroup, type MovementTypeConfig, type InsertMovementTypeConfig } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formSchema = insertMovementTypeConfigSchema.extend({
  id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function MovementTypesConfigPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<MovementTypeConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedNature, setSelectedNature] = useState<string>("all");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      groupId: "",
      nature: "transfer",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      requiresApproval: false,
      requiresDocument: false,
      allowsMixedBatch: true,
      active: true,
    },
  });

  const { data: groups = [] } = useQuery<MovementGroup[]>({
    queryKey: ["/api/movement-groups"],
  });

  const { data: types = [], isLoading } = useQuery<MovementTypeConfig[]>({
    queryKey: ["/api/movement-types-config"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertMovementTypeConfig) => {
      const res = await apiRequest("POST", "/api/movement-types-config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement-types-config"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Tipo criado",
        description: "Tipo de movimentação criado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar tipo de movimentação.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertMovementTypeConfig> }) => {
      const res = await apiRequest("PATCH", `/api/movement-types-config/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement-types-config"] });
      setIsDialogOpen(false);
      setEditingType(null);
      form.reset();
      toast({
        title: "Tipo atualizado",
        description: "Tipo de movimentação atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar tipo de movimentação.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/movement-types-config/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement-types-config"] });
      toast({
        title: "Tipo excluído",
        description: "Tipo de movimentação excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir tipo de movimentação.",
        variant: "destructive",
      });
    },
  });

  function handleCreate() {
    setEditingType(null);
    form.reset({
      code: "",
      name: "",
      groupId: "",
      nature: "transfer",
      affectsPhysicalInventory: true,
      affectsOperationalInventory: true,
      requiresApproval: false,
      requiresDocument: false,
      allowsMixedBatch: true,
      active: true,
    });
    setIsDialogOpen(true);
  }

  function handleEdit(type: MovementTypeConfig) {
    setEditingType(type);
    form.reset({
      code: type.code,
      name: type.name,
      groupId: type.groupId,
      nature: type.nature,
      affectsPhysicalInventory: type.affectsPhysicalInventory,
      affectsOperationalInventory: type.affectsOperationalInventory,
      requiresApproval: type.requiresApproval,
      requiresDocument: type.requiresDocument,
      allowsMixedBatch: type.allowsMixedBatch,
      active: type.active,
    });
    setIsDialogOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm("Tem certeza que deseja excluir este tipo?")) {
      deleteMutation.mutate(id);
    }
  }

  function onSubmit(values: FormValues) {
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  }

  const groupMap = new Map(groups.map(g => [g.id, g]));

  const filteredTypes = types.filter(type => {
    const matchesSearch = 
      type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = selectedGroupId === "all" || type.groupId === selectedGroupId;
    const matchesNature = selectedNature === "all" || type.nature === selectedNature;
    return matchesSearch && matchesGroup && matchesNature;
  });

  const getNatureBadge = (nature: string) => {
    const colors: Record<string, string> = {
      inbound: "bg-green-500/15 text-green-700 dark:text-green-400",
      outbound: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
      transfer: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
      adjustment: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    };
    const labels: Record<string, string> = {
      inbound: "Entrada",
      outbound: "Saída",
      transfer: "Transferência",
      adjustment: "Ajuste",
    };
    return (
      <Badge variant="outline" className={colors[nature] || ""}>
        {labels[nature] || nature}
      </Badge>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tipos de Movimentação</h1>
          <p className="text-muted-foreground">
            Configure os tipos de movimentação disponíveis no sistema
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-type">
          <Plus className="mr-2 h-4 w-4" />
          Novo Tipo
        </Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-filter-group">
              <SelectValue placeholder="Filtrar por grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              {groups.map(group => (
                <SelectItem key={group.id} value={group.id}>
                  {group.icon} {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedNature} onValueChange={setSelectedNature}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-filter-nature">
              <SelectValue placeholder="Filtrar por natureza" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as naturezas</SelectItem>
              <SelectItem value="inbound">Entrada</SelectItem>
              <SelectItem value="outbound">Saída</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
              <SelectItem value="adjustment">Ajuste</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Natureza</TableHead>
              <TableHead className="text-center">Estoque Físico</TableHead>
              <TableHead className="text-center">Estoque Operacional</TableHead>
              <TableHead className="text-center">Aprovação</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhum tipo encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredTypes.map((type) => {
                const group = groupMap.get(type.groupId);
                return (
                  <TableRow key={type.id} data-testid={`row-type-${type.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-code-${type.id}`}>
                      {type.code}
                    </TableCell>
                    <TableCell data-testid={`text-name-${type.id}`}>{type.name}</TableCell>
                    <TableCell>
                      {group && (
                        <div className="flex items-center gap-2">
                          <span>{group.icon}</span>
                          <span className="text-sm">{group.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getNatureBadge(type.nature)}</TableCell>
                    <TableCell className="text-center">
                      {type.affectsPhysicalInventory ? "✓" : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {type.affectsOperationalInventory ? "✓" : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {type.requiresApproval ? "✓" : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {type.active ? (
                        <Badge variant="outline" className="bg-green-500/15 text-green-700 dark:text-green-400">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEdit(type)}
                          data-testid={`button-edit-${type.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleDelete(type.id)}
                          data-testid={`button-delete-${type.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-type-form">
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Editar Tipo" : "Novo Tipo"}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? "Atualize as configurações do tipo de movimentação"
                : "Configure um novo tipo de movimentação"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código*</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="EVENT_LOADING" data-testid="input-code" />
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
                      <FormLabel>Nome*</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Carga para Evento" data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grupo*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-group">
                            <SelectValue placeholder="Selecione o grupo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groups.map(group => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.icon} {group.name}
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
                  name="nature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Natureza*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-nature">
                            <SelectValue placeholder="Selecione a natureza" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="inbound">Entrada</SelectItem>
                          <SelectItem value="outbound">Saída</SelectItem>
                          <SelectItem value="transfer">Transferência</SelectItem>
                          <SelectItem value="adjustment">Ajuste</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h4 className="font-medium">Configurações de Estoque</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="affectsPhysicalInventory"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Afeta Estoque Físico</FormLabel>
                          <FormDescription className="text-xs">
                            Altera a quantidade física
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-physical"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="affectsOperationalInventory"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Afeta Estoque Operacional</FormLabel>
                          <FormDescription className="text-xs">
                            Altera disponibilidade
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-operational"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h4 className="font-medium">Requisitos e Validações</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="requiresApproval"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Requer Aprovação</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-approval"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="requiresDocument"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Requer Documento</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-document"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="allowsMixedBatch"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Permite Lote Misto</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-mixed-batch"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Ativo</FormLabel>
                      <FormDescription>
                        Tipos inativos não estarão disponíveis para uso
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingType(null);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

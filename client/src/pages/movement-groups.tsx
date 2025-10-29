import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMovementGroupSchema, type MovementGroup, type InsertMovementGroup } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = insertMovementGroupSchema.extend({
  id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function MovementGroupsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MovementGroup | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      color: "#3b82f6",
      icon: "📦",
      purpose: "operational",
      displayOrder: 0,
      active: true,
    },
  });

  const { data: groups = [], isLoading } = useQuery<MovementGroup[]>({
    queryKey: ["/api/movement-groups"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertMovementGroup) => {
      const res = await apiRequest("POST", "/api/movement-groups", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement-groups"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Grupo criado",
        description: "Grupo de movimentação criado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar grupo de movimentação.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertMovementGroup> }) => {
      const res = await apiRequest("PATCH", `/api/movement-groups/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement-groups"] });
      setIsDialogOpen(false);
      setEditingGroup(null);
      form.reset();
      toast({
        title: "Grupo atualizado",
        description: "Grupo de movimentação atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar grupo de movimentação.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/movement-groups/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement-groups"] });
      toast({
        title: "Grupo excluído",
        description: "Grupo de movimentação excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir grupo de movimentação.",
        variant: "destructive",
      });
    },
  });

  function handleCreate() {
    setEditingGroup(null);
    form.reset({
      code: "",
      name: "",
      description: "",
      color: "#3b82f6",
      icon: "📦",
      purpose: "operational",
      displayOrder: groups.length,
      active: true,
    });
    setIsDialogOpen(true);
  }

  function handleEdit(group: MovementGroup) {
    setEditingGroup(group);
    form.reset({
      code: group.code,
      name: group.name,
      description: group.description || "",
      color: group.color,
      icon: group.icon,
      purpose: group.purpose,
      displayOrder: group.displayOrder,
      active: group.active,
    });
    setIsDialogOpen(true);
  }

  function handleDelete(id: string) {
    if (confirm("Tem certeza que deseja excluir este grupo?")) {
      deleteMutation.mutate(id);
    }
  }

  function onSubmit(values: FormValues) {
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  }

  const sortedGroups = [...groups].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Grupos de Movimentação</h1>
          <p className="text-muted-foreground">
            Organize os tipos de movimentação em grupos lógicos
          </p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-group">
          <Plus className="mr-2 h-4 w-4" />
          Novo Grupo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
                <div className="h-4 w-48 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedGroups.map((group) => (
            <Card
              key={group.id}
              className="hover-elevate relative overflow-hidden"
              style={{
                borderLeft: `4px solid ${group.color}`,
              }}
              data-testid={`card-group-${group.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" data-testid={`icon-${group.id}`}>
                      {group.icon}
                    </span>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-name-${group.id}`}>
                        {group.name}
                      </CardTitle>
                      <CardDescription className="text-xs" data-testid={`text-code-${group.id}`}>
                        {group.code}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleEdit(group)}
                      data-testid={`button-edit-${group.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleDelete(group.id)}
                      data-testid={`button-delete-${group.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid={`text-description-${group.id}`}>
                  {group.description || "Sem descrição"}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="rounded px-2 py-1"
                    style={{
                      backgroundColor: `${group.color}15`,
                      color: group.color,
                    }}
                    data-testid={`badge-purpose-${group.id}`}
                  >
                    {group.purpose}
                  </span>
                  {!group.active && (
                    <span className="rounded bg-destructive/15 px-2 py-1 text-destructive" data-testid={`badge-inactive-${group.id}`}>
                      Inativo
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-group-form">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Editar Grupo" : "Novo Grupo"}
            </DialogTitle>
            <DialogDescription>
              {editingGroup
                ? "Atualize as informações do grupo de movimentação"
                : "Crie um novo grupo de movimentação"}
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
                        <Input {...field} placeholder="OPERATIONAL" data-testid="input-code" />
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
                        <Input {...field} placeholder="Operações Logísticas" data-testid="input-name" />
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
                      <Textarea {...field} value={field.value || ""} placeholder="Descrição do grupo..." data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor*</FormLabel>
                      <FormControl>
                        <Input type="color" {...field} data-testid="input-color" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ícone*</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="📦" data-testid="input-icon" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ordem*</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-order"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Propósito*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-purpose">
                          <SelectValue placeholder="Selecione o propósito" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="operational">Operacional</SelectItem>
                        <SelectItem value="quality_control">Controle de Qualidade</SelectItem>
                        <SelectItem value="third_party">Terceiros</SelectItem>
                        <SelectItem value="adjustments">Ajustes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingGroup(null);
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

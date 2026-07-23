import { useQuery } from "@tanstack/react-query";
import { useCrudMutations } from "@/hooks/use-crud-mutations";
import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMovementGroupSchema, type MovementGroup, type InsertMovementGroup, type MovementTypeConfig } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Layers } from "lucide-react";

const formSchema = insertMovementGroupSchema.extend({
  id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function MovementGroupsPage() {
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

  const { data: allTypes = [] } = useQuery<MovementTypeConfig[]>({
    queryKey: ["/api/movement-types-config"],
  });

  const typeCountByGroup = new Map<string, number>(
    groups.map((g) => [g.id, allTypes.filter((t) => t.groupId === g.id).length])
  );

  const { create: createMutation, update: updateMutation, remove: deleteMutation } =
    useCrudMutations<InsertMovementGroup>(
      "/api/movement-groups",
      { entity: "Grupo", created: "Grupo criado", updated: "Grupo atualizado", deleted: "Grupo excluído" },
      {
        onCreated: () => { setIsDialogOpen(false); form.reset(); },
        onUpdated: () => { setIsDialogOpen(false); setEditingGroup(null); form.reset(); },
      }
    );

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
    <div className="space-y-6">
      <PageHeader
        title="Grupos de Movimentação"
        description="Organize os tipos de movimentação em grupos lógicos"
      >
        <Button onClick={handleCreate} data-testid="button-create-group">
          <Plus className="mr-2 h-4 w-4" />
          Criar Grupo
        </Button>
      </PageHeader>

      {isLoading ? (
        <PageLoading message="Carregando grupos..." />
      ) : sortedGroups.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhum grupo encontrado"
          description="Crie um grupo para organizar os tipos de movimentação."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedGroups.map((group) => (
            <Card
              key={group.id}
              className="hover-elevate border-border/60 relative"
              data-testid={`card-group-${group.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" data-testid={`icon-${group.id}`}>
                      {group.icon}
                    </span>
                    <div>
                      <h3 className="font-semibold text-base text-foreground" data-testid={`text-name-${group.id}`}>
                        {group.name}
                      </h3>
                      <p className="text-xs text-muted-foreground" data-testid={`text-code-${group.id}`}>
                        {group.code}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(group)}
                      data-testid={`button-edit-${group.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(group.id)}
                      data-testid={`button-delete-${group.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground" data-testid={`text-description-${group.id}`}>
                  {group.description || "Sem descrição"}
                </p>
                <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-border/40 pt-3">
                  <Badge variant="outline" className="text-xs" data-testid={`badge-types-count-${group.id}`}>
                    {typeCountByGroup.get(group.id) ?? 0} tipo{(typeCountByGroup.get(group.id) ?? 0) !== 1 ? "s" : ""}
                  </Badge>
                  <span
                    className="rounded px-2 py-1 text-xs"
                    style={{
                      backgroundColor: `${group.color}15`,
                      color: group.color,
                    }}
                    data-testid={`badge-purpose-${group.id}`}
                  >
                    {group.purpose}
                  </span>
                  {!group.active && (
                    <span className="rounded bg-destructive/15 px-2 py-1 text-xs text-destructive" data-testid={`badge-inactive-${group.id}`}>
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
        <DialogContent className="max-w-2xl border-border/60" data-testid="dialog-group-form">
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

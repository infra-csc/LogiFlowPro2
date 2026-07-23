import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Warehouse, AlertCircle, Package, Pencil, Trash2 } from "lucide-react";
import type { Dock } from "@shared/schema";
import { insertDockSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { useCrudMutations } from "@/hooks/use-crud-mutations";
import type { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

type InsertDock = z.infer<typeof insertDockSchema>;

const emptyDock: InsertDock = { name: "", capacity: 2, restrictions: "" };

export default function Docks() {
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);

  // A single form serves both create and edit; `editing` distinguishes them.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Dock | null>(null);
  const [deleteDock, setDeleteDock] = useState<Dock | null>(null);

  const { data: docks, isLoading } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  const form = useForm<InsertDock>({
    resolver: zodResolver(insertDockSchema),
    defaultValues: emptyDock,
  });

  const { create, update, remove } = useCrudMutations<InsertDock>(
    "/api/docks",
    { entity: "Doca", created: "Doca criada", updated: "Doca atualizada", deleted: "Doca excluída" },
    {
      onCreated: () => { setFormOpen(false); form.reset(emptyDock); },
      onUpdated: () => { setFormOpen(false); setEditing(null); },
      onDeleted: () => setDeleteDock(null),
    }
  );

  function openCreate() {
    setEditing(null);
    form.reset(emptyDock);
    setFormOpen(true);
  }

  function openEdit(dock: Dock) {
    setEditing(dock);
    form.reset({
      name: dock.name,
      capacity: dock.capacity ?? 2,
      restrictions: dock.restrictions ?? "",
    });
    setFormOpen(true);
  }

  function onSubmit(data: InsertDock) {
    if (editing) {
      update.mutate({ id: editing.id, data });
    } else {
      create.mutate(data);
    }
  }

  const isSaving = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Docas"
        description="Gerencie as docas de carregamento e descarregamento"
      >
        {canWrite && (
          <Button onClick={openCreate} data-testid="button-create-dock">
            <Plus className="h-4 w-4 mr-2" />
            Nova Doca
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <PageLoading message="Carregando docas..." />
      ) : docks && docks.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {docks.map((dock) => (
            <Card key={dock.id} className="border-border/60 hover-elevate" data-testid={`dock-card-${dock.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Warehouse className="h-4 w-4 text-primary/70" />
                    </div>
                    <h3 className="font-semibold text-base text-foreground truncate">{dock.name}</h3>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(dock)}
                        data-testid={`button-edit-dock-${dock.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteDock(dock)}
                        data-testid={`button-delete-dock-${dock.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-border/40 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Capacidade:</span>
                    <span className="font-medium">{dock.capacity}</span>
                  </div>
                  {dock.restrictions && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-chart-5 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{dock.restrictions}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhuma doca cadastrada"
          description="Crie a primeira doca clicando no botão acima."
          icon={Warehouse}
          action={canWrite ? { label: "Nova Doca", onClick: openCreate } : undefined}
        />
      )}

      {/* Create/edit dialog (shared form) */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Doca" : "Criar Nova Doca"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Altere os dados da doca e salve as mudanças"
                : "Adicione uma nova doca de carregamento ao sistema"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Doca</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Doca 1" data-testid="input-dock-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="capacity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade</FormLabel>
                  <FormControl>
                    <Input
                      type="number" min="1" placeholder="2"
                      data-testid="input-dock-capacity"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="restrictions" render={({ field }) => (
                <FormItem>
                  <FormLabel>Restrições (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Apenas veículos até 10m de comprimento"
                      data-testid="input-dock-restrictions"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)} data-testid="button-cancel-dock">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} data-testid="button-submit-dock">
                  {isSaving ? "Salvando..." : editing ? "Salvar" : "Criar Doca"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteDock} onOpenChange={(open) => { if (!open) setDeleteDock(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Doca</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteDock?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-dock">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteDock) remove.mutate(deleteDock.id); }}
              disabled={remove.isPending}
              data-testid="button-confirm-delete-dock"
            >
              {remove.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

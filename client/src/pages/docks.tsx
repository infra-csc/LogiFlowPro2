import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Dock } from "@shared/schema";
import { insertDockSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import type { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";

type InsertDock = z.infer<typeof insertDockSchema>;

export default function Docks() {
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editDock, setEditDock] = useState<Dock | null>(null);
  const [deleteDock, setDeleteDock] = useState<Dock | null>(null);

  const { toast } = useToast();
  const { data: docks, isLoading } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  const createForm = useForm<InsertDock>({
    resolver: zodResolver(insertDockSchema),
    defaultValues: { name: "", capacity: 2, restrictions: "" },
  });

  const editForm = useForm<InsertDock>({
    resolver: zodResolver(insertDockSchema),
    defaultValues: { name: "", capacity: 2, restrictions: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertDock) => apiRequest("POST", "/api/docks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      toast({ title: "Doca criada", description: "A doca foi criada com sucesso." });
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar doca", description: error.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: InsertDock) =>
      apiRequest("PATCH", `/api/docks/${editDock!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      toast({ title: "Doca atualizada", description: "As alterações foram salvas." });
      setEditDock(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar doca", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (dockId: string) => apiRequest("DELETE", `/api/docks/${dockId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      toast({ title: "Doca excluída", description: "A doca foi removida do sistema." });
      setDeleteDock(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir doca", description: error.message, variant: "destructive" });
    },
  });

  function openEdit(dock: Dock) {
    editForm.reset({
      name: dock.name,
      capacity: dock.capacity ?? 2,
      restrictions: dock.restrictions ?? "",
    });
    setEditDock(dock);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Docas"
        description="Gerencie as docas de carregamento e descarregamento"
      >
        {canWrite && (
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-dock">
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
          action={canWrite ? { label: "Nova Doca", onClick: () => setIsCreateOpen(true) } : undefined}
        />
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Doca</DialogTitle>
            <DialogDescription>Adicione uma nova doca de carregamento ao sistema</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <FormField control={createForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Doca</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Doca 1" data-testid="input-dock-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="capacity" render={({ field }) => (
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
              <FormField control={createForm.control} name="restrictions" render={({ field }) => (
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
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-dock">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-dock">
                  {createMutation.isPending ? "Criando..." : "Criar Doca"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editDock} onOpenChange={(open) => { if (!open) setEditDock(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Doca</DialogTitle>
            <DialogDescription>Altere os dados da doca e salve as mudanças</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Doca</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Doca 1" data-testid="input-edit-dock-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="capacity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade</FormLabel>
                  <FormControl>
                    <Input
                      type="number" min="1" placeholder="2"
                      data-testid="input-edit-dock-capacity"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="restrictions" render={({ field }) => (
                <FormItem>
                  <FormLabel>Restrições (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Apenas veículos até 10m de comprimento"
                      data-testid="input-edit-dock-restrictions"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDock(null)} data-testid="button-cancel-edit-dock">
                  Cancelar
                </Button>
                <Button type="submit" disabled={editMutation.isPending} data-testid="button-submit-edit-dock">
                  {editMutation.isPending ? "Salvando..." : "Salvar"}
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
              onClick={() => { if (deleteDock) deleteMutation.mutate(deleteDock.id); }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-dock"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Warehouse, AlertCircle, Package } from "lucide-react";
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
  const { toast } = useToast();
  const { data: docks, isLoading } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  const form = useForm<InsertDock>({
    resolver: zodResolver(insertDockSchema),
    defaultValues: {
      name: "",
      capacity: 1,
      restrictions: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertDock) => {
      return await apiRequest("POST", "/api/docks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      toast({
        title: "Doca criada",
        description: "A doca foi criada com sucesso.",
      });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar doca",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertDock) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Docas"
        description="Gerencie as docas de carregamento e descarregamento"
      >
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          {canWrite && (
            <DialogTrigger asChild>
              <Button data-testid="button-create-dock">
                <Plus className="h-4 w-4 mr-2" />
                Nova Doca
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Doca</DialogTitle>
              <DialogDescription>
                Adicione uma nova doca de carregamento ao sistema
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Doca</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Doca 1"
                          data-testid="input-dock-name"
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
                      <FormLabel>Capacidade</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="1"
                          data-testid="input-dock-capacity"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="restrictions"
                  render={({ field }) => (
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
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    data-testid="button-cancel-dock"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-dock"
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Doca"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <PageLoading message="Carregando docas..." />
      ) : docks && docks.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {docks.map((dock) => (
            <Card key={dock.id} data-testid={`dock-card-${dock.id}`}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Warehouse className="h-5 w-5" />
                  {dock.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Capacidade:</span>
                  <span className="font-medium">{dock.capacity}</span>
                </div>
                {dock.restrictions && (
                  <div className="flex items-start gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{dock.restrictions}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhuma doca cadastrada"
          description="Crie a primeira doca clicando no botão acima."
          icon={Warehouse}
          action={canWrite ? {
            label: "Nova Doca",
            onClick: () => setIsCreateOpen(true),
          } : undefined}
        />
      )}
    </div>
  );
}

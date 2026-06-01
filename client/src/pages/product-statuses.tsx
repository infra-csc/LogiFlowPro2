import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Circle, CheckCircle, Clock, Calendar, Truck, Wrench, AlertTriangle, Lock, Trash2, Search } from "lucide-react";
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
  type: z.enum(["operational", "physical", "blocking"]),
  color: z.string().default("#64748b"),
  icon: z.string().default("circle"),
  allowsMovement: z.boolean().default(true),
  displayOrder: z.number().default(0),
  active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

type ProductStatus = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: "operational" | "physical" | "blocking";
  color: string;
  icon: string | null;
  allowsMovement: boolean;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const iconMap: Record<string, any> = {
  circle: Circle,
  "check-circle": CheckCircle,
  clock: Clock,
  calendar: Calendar,
  truck: Truck,
  wrench: Wrench,
  "alert-triangle": AlertTriangle,
  lock: Lock,
  "trash-2": Trash2,
};

const typeLabels = {
  operational: "Operacional",
  physical: "Físico",
  blocking: "Bloqueio",
};

export default function ProductStatusesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<ProductStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: statuses = [], isLoading } = useQuery<ProductStatus[]>({
    queryKey: ["/api/product-statuses"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      type: "operational",
      color: "#64748b",
      icon: "circle",
      allowsMovement: true,
      displayOrder: 0,
      active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = editingStatus ? `/api/product-statuses/${editingStatus.id}` : "/api/product-statuses";
      const method = editingStatus ? "PATCH" : "POST";
      const res = await apiRequest(method, url, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao salvar status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-statuses"] });
      toast({ title: editingStatus ? "Status atualizado" : "Status criado com sucesso" });
      setDialogOpen(false);
      setEditingStatus(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (status: ProductStatus) => {
    setEditingStatus(status);
    form.reset({
      code: status.code,
      name: status.name,
      description: status.description || "",
      type: status.type,
      color: status.color,
      icon: status.icon || "circle",
      allowsMovement: status.allowsMovement,
      displayOrder: status.displayOrder,
      active: status.active,
    });
    setDialogOpen(true);
  };

  const filteredStatuses = statuses.filter(status =>
    status.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    status.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const IconComponent = (iconName: string | null) => {
    const Icon = iconMap[iconName || "circle"] || Circle;
    return Icon;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Status de Produtos"
        description="Cadastro de status para controle de estado dos produtos"
      >
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingStatus(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-status">
              <Plus className="h-4 w-4 mr-2" />
              Novo Status
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl border-border/60">
            <DialogHeader>
                  <DialogTitle>{editingStatus ? "Editar Status" : "Novo Status"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código *</FormLabel>
                            <FormControl>
                              <Input placeholder="DISPONIVEL" {...field} data-testid="input-code" />
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
                              <Input placeholder="Disponível" {...field} data-testid="input-name" />
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
                            <Input placeholder="Descrição do status" {...field} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
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
                                <SelectItem value="operational">Operacional</SelectItem>
                                <SelectItem value="physical">Físico</SelectItem>
                                <SelectItem value="blocking">Bloqueio</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cor</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} data-testid="input-color" />
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
                            <FormLabel>Ordem</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} data-testid="input-order" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="allowsMovement"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 border border-border/60 rounded-lg">
                            <div>
                              <FormLabel>Permite Movimentação</FormLabel>
                              <FormDescription className="text-xs">
                                Produtos neste status podem ser movimentados
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-allows-movement"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="active"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 border border-border/60 rounded-lg">
                            <div>
                              <FormLabel>Ativo</FormLabel>
                              <FormDescription className="text-xs">
                                Status disponível para uso
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
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          setEditingStatus(null);
                          form.reset();
                        }}
                        data-testid="button-cancel"
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                        {createMutation.isPending ? "Salvando..." : editingStatus ? "Atualizar" : "Criar"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
      </PageHeader>

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>

            {isLoading ? (
              <PageLoading message="Carregando status..." />
            ) : filteredStatuses.length === 0 ? (
              <EmptyState
                icon={Circle}
                title="Nenhum status encontrado"
                description={searchQuery ? "Tente ajustar sua busca" : "Crie o primeiro status de produto"}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Movimentação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStatuses.map((status) => {
                    const Icon = IconComponent(status.icon);
                    return (
                      <TableRow key={status.id}>
                        <TableCell className="font-mono">{status.code}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" style={{ color: status.color }} />
                            {status.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{typeLabels[status.type]}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded border"
                              style={{ backgroundColor: status.color }}
                            />
                            <span className="text-xs text-muted-foreground">{status.color}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {status.allowsMovement ? (
                            <Badge variant="secondary">Sim</Badge>
                          ) : (
                            <Badge variant="secondary">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {status.active ? (
                            <Badge variant="default">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(status)}
                            data-testid={`button-edit-${status.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

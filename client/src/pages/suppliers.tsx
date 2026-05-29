import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertSupplierSchema, type Supplier } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, UserCircle, Phone, Mail } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin } from "@/lib/authz";

const formSchema = insertSupplierSchema;

export default function SuppliersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = userIsAdmin(user);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  if (isLoading) {
    return (
      <PageLoading message="Carregando fornecedores..." />
    );
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
      active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/suppliers", data);
      if (!res.ok) throw new Error("Failed to create supplier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Fornecedor criado com sucesso" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar fornecedor", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<z.infer<typeof formSchema>> }) => {
      const res = await apiRequest("PATCH", `/api/suppliers/${data.id}`, data.updates);
      if (!res.ok) throw new Error("Failed to update supplier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Fornecedor atualizado com sucesso" });
      setDialogOpen(false);
      setEditingSupplier(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar fornecedor", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/suppliers/${id}`, {});
      if (!res.ok) throw new Error("Failed to delete supplier");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Fornecedor excluído com sucesso" });
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir fornecedor", variant: "destructive" });
    },
  });

  const handleSubmit = (data: z.infer<typeof formSchema>) => {
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, updates: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    form.reset({
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      active: supplier.active,
    });
    setDialogOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        description="Gerencie os fornecedores do sistema"
      >
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingSupplier(null);
            form.reset();
          }
        }}>
          {canWrite && (
            <DialogTrigger asChild>
              <Button data-testid="button-add-supplier">
                <Plus className="h-4 w-4 mr-2" />
                Novo Fornecedor
              </Button>
            </DialogTrigger>
          )}
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Nome *</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do fornecedor" {...field} data-testid="input-supplier-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="contactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pessoa de Contato</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome da pessoa" {...field} value={field.value || ""} data-testid="input-contact-person" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input placeholder="(00) 00000-0000" {...field} value={field.value || ""} data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="contato@fornecedor.com" {...field} value={field.value || ""} data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                              <Input placeholder="Endereço completo" {...field} value={field.value || ""} data-testid="input-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Observações</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Informações adicionais" {...field} value={field.value || ""} data-testid="input-notes" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="active"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between col-span-2 p-4 border rounded-lg">
                            <div>
                              <FormLabel>Fornecedor Ativo</FormLabel>
                              <p className="text-sm text-muted-foreground">Fornecedores inativos não aparecem em sugestões</p>
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
                          setEditingSupplier(null);
                          form.reset();
                        }}
                        data-testid="button-cancel"
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" data-testid="button-submit">
                        {editingSupplier ? "Atualizar" : "Criar"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Fornecedores</CardTitle>
          <CardDescription>
            Todos os fornecedores cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Buscar fornecedor por nome, contato ou e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />

            {filteredSuppliers.length === 0 ? (
              <EmptyState
                icon={UserCircle}
                title="Nenhum fornecedor"
                description="Cadastre fornecedores para usá-los em movimentações"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum fornecedor encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>
                          {supplier.contactPerson && (
                            <div className="flex items-center gap-2">
                              <UserCircle className="h-4 w-4 text-muted-foreground" />
                              {supplier.contactPerson}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {supplier.phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {supplier.email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.active ? (
                            <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500">
                              Inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canWrite && (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEdit(supplier)}
                                  data-testid={`button-edit-${supplier.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDelete(supplier)}
                                  data-testid={`button-delete-${supplier.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o fornecedor <strong>{supplierToDelete?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => supplierToDelete && deleteMutation.mutate(supplierToDelete.id)}
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Role, Permission, RolePermission } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Shield, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const roleSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

export default function RolesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const { toast } = useToast();

  const populatePermissionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/permissions/populate");
      return await res.json();
    },
    onSuccess: (data: { success: boolean; created: number; updated: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      toast({
        title: "Permissões atualizadas",
        description: `${data.created} criadas, ${data.updated} atualizadas. Total: ${data.total} permissões.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar permissões",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
  });

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      const res = await apiRequest("POST", "/api/roles", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Papel criado",
        description: "O papel foi criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar papel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Papel excluído",
        description: "O papel foi excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir papel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: RoleFormData) => {
    createMutation.mutate(data);
  };

  const handleDelete = (role: Role) => {
    if (confirm(`Tem certeza que deseja excluir o papel "${role.name}"?`)) {
      deleteMutation.mutate(role.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Papéis e Permissões"
        description="Gerencie papéis e permissões do sistema"
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => populatePermissionsMutation.mutate()}
            disabled={populatePermissionsMutation.isPending}
            data-testid="button-populate-permissions"
          >
            <Plus className="mr-2 h-4 w-4" />
            {populatePermissionsMutation.isPending ? "Atualizando..." : "Atualizar Permissões"}
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-role">
            <Shield className="mr-2 h-4 w-4" />
            Novo Papel
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="font-semibold text-base mb-1">Lista de Papéis</div>
          <p className="text-sm text-muted-foreground mb-4">
            Todos os papéis cadastrados no sistema
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    <PageLoading message="Carregando papéis..." />
                  </TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhum papel encontrado
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRole(role);
                            setIsPermissionsDialogOpen(true);
                          }}
                          data-testid={`button-manage-permissions-${role.id}`}
                        >
                          <Settings className="mr-2 h-3 w-3" />
                          Permissões
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(role)}
                          data-testid={`button-delete-role-${role.id}`}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Role Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Papel</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo papel
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Administrador" data-testid="input-role-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Descrição do papel..."
                        data-testid="input-role-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-role"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-role"
                >
                  {createMutation.isPending ? "Criando..." : "Criar Papel"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Manage Permissions Dialog */}
      {selectedRole && (
        <RolePermissionsDialog
          role={selectedRole}
          permissions={permissions}
          isOpen={isPermissionsDialogOpen}
          onClose={() => {
            setIsPermissionsDialogOpen(false);
            setSelectedRole(null);
          }}
        />
      )}
    </div>
  );
}

// Role Permissions Dialog Component
function RolePermissionsDialog({
  role,
  permissions,
  isOpen,
  onClose,
}: {
  role: Role;
  permissions: Permission[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: rolePermissions = [] } = useQuery<RolePermission[]>({
    queryKey: ["/api/roles", role.id, "permissions"],
    enabled: isOpen,
  });

  // Local state to track changes before saving
  const [localChanges, setLocalChanges] = useState<Record<string, {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>>({});

  // Reset local changes when modal opens or rolePermissions change
  useEffect(() => {
    if (isOpen && rolePermissions.length > 0) {
      const initial: typeof localChanges = {};
      rolePermissions.forEach(rp => {
        initial[rp.permissionId] = {
          canView: rp.canView,
          canCreate: rp.canCreate,
          canEdit: rp.canEdit,
          canDelete: rp.canDelete,
        };
      });
      setLocalChanges(initial);
    }
  }, [isOpen, rolePermissions]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Batch all updates together
      const updates = await Promise.all(
        permissions.map(async (permission) => {
          const localValue = localChanges[permission.id];
          if (!localValue) return null;

          const existing = rolePermissions.find((rp: RolePermission) => rp.permissionId === permission.id);

          if (existing) {
            // Update existing
            const res = await apiRequest("PATCH", `/api/role-permissions/${existing.id}`, localValue);
            return await res.json();
          } else {
            // Create new
            const res = await apiRequest("POST", `/api/roles/${role.id}/permissions`, {
              permissionId: permission.id,
              ...localValue,
            });
            return await res.json();
          }
        })
      );
      return updates.filter(u => u !== null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles", role.id, "permissions"] });
      toast({
        title: "Permissões atualizadas",
        description: "As permissões foram salvas com sucesso.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar permissões",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePermissionChange = (
    permissionId: string,
    field: "canView" | "canCreate" | "canEdit" | "canDelete",
    value: boolean
  ) => {
    setLocalChanges(prev => ({
      ...prev,
      [permissionId]: {
        ...(prev[permissionId] || {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        }),
        [field]: value,
      },
    }));
  };

  const getPermissionValue = (
    permissionId: string,
    field: "canView" | "canCreate" | "canEdit" | "canDelete"
  ): boolean => {
    // Check local changes first, then fall back to server data
    const local = localChanges[permissionId];
    if (local) return local[field];
    
    const existing = rolePermissions.find((rp: RolePermission) => rp.permissionId === permissionId);
    return existing ? existing[field] : false;
  };

  // Check if all permissions have a specific field enabled
  const areAllChecked = (field: "canView" | "canCreate" | "canEdit" | "canDelete"): boolean => {
    if (permissions.length === 0) return false;
    return permissions.every((permission) => getPermissionValue(permission.id, field));
  };

  // Toggle all permissions for a specific field
  const handleToggleAll = (field: "canView" | "canCreate" | "canEdit" | "canDelete") => {
    const newValue = !areAllChecked(field);
    const updates: typeof localChanges = {};
    
    permissions.forEach((permission) => {
      const current = localChanges[permission.id] || {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      };

      updates[permission.id] = {
        ...current,
        [field]: newValue,
      };
    });

    setLocalChanges(prev => ({ ...prev, ...updates }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Permissões - {role.name}</DialogTitle>
          <DialogDescription>
            Configure as permissões para cada página do sistema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Página</TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>Visualizar</span>
                    <Checkbox
                      checked={areAllChecked("canView")}
                      onCheckedChange={() => handleToggleAll("canView")}
                      data-testid="checkbox-select-all-view"
                    />
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>Criar</span>
                    <Checkbox
                      checked={areAllChecked("canCreate")}
                      onCheckedChange={() => handleToggleAll("canCreate")}
                      data-testid="checkbox-select-all-create"
                    />
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>Editar</span>
                    <Checkbox
                      checked={areAllChecked("canEdit")}
                      onCheckedChange={() => handleToggleAll("canEdit")}
                      data-testid="checkbox-select-all-edit"
                    />
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>Excluir</span>
                    <Checkbox
                      checked={areAllChecked("canDelete")}
                      onCheckedChange={() => handleToggleAll("canDelete")}
                      data-testid="checkbox-select-all-delete"
                    />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">
                    {permission.displayName}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getPermissionValue(permission.id, "canView")}
                      onCheckedChange={(value) =>
                        handlePermissionChange(permission.id, "canView", value as boolean)
                      }
                      data-testid={`checkbox-view-${permission.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getPermissionValue(permission.id, "canCreate")}
                      onCheckedChange={(value) =>
                        handlePermissionChange(permission.id, "canCreate", value as boolean)
                      }
                      data-testid={`checkbox-create-${permission.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getPermissionValue(permission.id, "canEdit")}
                      onCheckedChange={(value) =>
                        handlePermissionChange(permission.id, "canEdit", value as boolean)
                      }
                      data-testid={`checkbox-edit-${permission.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getPermissionValue(permission.id, "canDelete")}
                      onCheckedChange={(value) =>
                        handlePermissionChange(permission.id, "canDelete", value as boolean)
                      }
                      data-testid={`checkbox-delete-${permission.id}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saveMutation.isPending}
            data-testid="button-cancel-permissions"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-permissions"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Permissões"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

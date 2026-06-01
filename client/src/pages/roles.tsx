import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { Role, Permission, RolePermission, User } from "@shared/schema";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Shield, Settings, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";

const roleSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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

  const { data: allUsers = [] } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/users"],
  });

  // Parallel fetch of all user-role assignments to compute role→users mapping
  const userRoleResults = useQueries({
    queries: allUsers.map((user) => ({
      queryKey: ["/api/users", user.id, "roles"],
      enabled: allUsers.length > 0,
    })),
  });

  const roleUserMap = useMemo(() => {
    const map = new Map<string, Omit<User, "password">[]>();
    allUsers.forEach((user, idx) => {
      const result = userRoleResults[idx];
      if (result.data && Array.isArray(result.data)) {
        (result.data as { roleId: string }[]).forEach((ur) => {
          if (!map.has(ur.roleId)) map.set(ur.roleId, []);
          const existing = map.get(ur.roleId)!;
          if (!existing.find((u) => u.id === user.id)) {
            existing.push(user);
          }
        });
      }
    });
    return map;
  }, [allUsers, userRoleResults]);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: "", description: "" },
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
      toast({ title: "Papel criado", description: "O papel foi criado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar papel", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: "Papel excluído", description: "O papel foi excluído com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir papel", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: RoleFormData) => createMutation.mutate(data);

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

      {isLoading ? (
        <PageLoading message="Carregando papéis..." />
      ) : roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Nenhum papel encontrado"
          description="Crie um papel para começar a gerenciar permissões do sistema."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const roleUsers = roleUserMap.get(role.id) || [];
            const displayUsers = roleUsers.slice(0, 4);
            const overflow = roleUsers.length - displayUsers.length;
            return (
              <Card
                key={role.id}
                className="hover-elevate border-border/60"
                data-testid={`row-role-${role.id}`}
              >
                <CardContent className="p-4 flex flex-col gap-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-semibold text-base leading-tight"
                        data-testid={`text-name-${role.id}`}
                      >
                        {role.name}
                      </p>
                      {role.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {role.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {roleUsers.length}
                    </Badge>
                  </div>

                  {/* Users with this role */}
                  {roleUsers.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap border-t border-border/40 pt-3">
                      {displayUsers.map((user) => (
                        <Avatar
                          key={user.id}
                          className="h-6 w-6"
                          title={user.name}
                        >
                          <AvatarFallback className="text-[10px] font-semibold">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {overflow > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          +{overflow}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 border-t border-border/40 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedRole(role);
                        setIsPermissionsDialogOpen(true);
                      }}
                      data-testid={`button-manage-permissions-${role.id}`}
                    >
                      <Settings className="mr-1 h-3 w-3" />
                      Permissões
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(role)}
                      data-testid={`button-delete-role-${role.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Role Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="border-border/60">
          <DialogHeader>
            <DialogTitle>Novo Papel</DialogTitle>
            <DialogDescription>Preencha os dados para criar um novo papel</DialogDescription>
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
                      <Textarea {...field} placeholder="Descrição do papel..." data-testid="input-role-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-role">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-role">
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

  const [localChanges, setLocalChanges] = useState<Record<string, {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>>({});

  useEffect(() => {
    if (isOpen && rolePermissions.length > 0) {
      const initial: typeof localChanges = {};
      rolePermissions.forEach((rp) => {
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
      const updates = await Promise.all(
        permissions.map(async (permission) => {
          const localValue = localChanges[permission.id];
          if (!localValue) return null;
          const existing = rolePermissions.find((rp: RolePermission) => rp.permissionId === permission.id);
          if (existing) {
            const res = await apiRequest("PATCH", `/api/role-permissions/${existing.id}`, localValue);
            return await res.json();
          } else {
            const res = await apiRequest("POST", `/api/roles/${role.id}/permissions`, {
              permissionId: permission.id,
              ...localValue,
            });
            return await res.json();
          }
        })
      );
      return updates.filter((u) => u !== null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles", role.id, "permissions"] });
      toast({ title: "Permissões atualizadas", description: "As permissões foram salvas com sucesso." });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar permissões", description: error.message, variant: "destructive" });
    },
  });

  const handlePermissionChange = (
    permissionId: string,
    field: "canView" | "canCreate" | "canEdit" | "canDelete",
    value: boolean
  ) => {
    setLocalChanges((prev) => ({
      ...prev,
      [permissionId]: {
        ...(prev[permissionId] || { canView: false, canCreate: false, canEdit: false, canDelete: false }),
        [field]: value,
      },
    }));
  };

  const getPermissionValue = (permissionId: string, field: "canView" | "canCreate" | "canEdit" | "canDelete"): boolean => {
    const local = localChanges[permissionId];
    if (local) return local[field];
    const existing = rolePermissions.find((rp: RolePermission) => rp.permissionId === permissionId);
    return existing ? existing[field] : false;
  };

  const areAllChecked = (field: "canView" | "canCreate" | "canEdit" | "canDelete"): boolean => {
    if (permissions.length === 0) return false;
    return permissions.every((p) => getPermissionValue(p.id, field));
  };

  const handleToggleAll = (field: "canView" | "canCreate" | "canEdit" | "canDelete") => {
    const newValue = !areAllChecked(field);
    const updates: typeof localChanges = {};
    permissions.forEach((p) => {
      const current = localChanges[p.id] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
      updates[p.id] = { ...current, [field]: newValue };
    });
    setLocalChanges((prev) => ({ ...prev, ...updates }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl border-border/60">
        <DialogHeader>
          <DialogTitle>Gerenciar Permissões — {role.name}</DialogTitle>
          <DialogDescription>Configure as permissões para cada página do sistema</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Página</TableHead>
                {(["canView", "canCreate", "canEdit", "canDelete"] as const).map((field) => (
                  <TableHead key={field} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{field === "canView" ? "Ver" : field === "canCreate" ? "Criar" : field === "canEdit" ? "Editar" : "Excluir"}</span>
                      <Checkbox
                        checked={areAllChecked(field)}
                        onCheckedChange={() => handleToggleAll(field)}
                        data-testid={`checkbox-select-all-${field.replace("can", "").toLowerCase()}`}
                      />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">{permission.displayName}</TableCell>
                  {(["canView", "canCreate", "canEdit", "canDelete"] as const).map((field) => (
                    <TableCell key={field} className="text-center">
                      <Checkbox
                        checked={getPermissionValue(permission.id, field)}
                        onCheckedChange={(value) => handlePermissionChange(permission.id, field, value as boolean)}
                        data-testid={`checkbox-${field.replace("can", "").toLowerCase()}-${permission.id}`}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending} data-testid="button-cancel-permissions">
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-permissions">
            {saveMutation.isPending ? "Salvando..." : "Salvar Permissões"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

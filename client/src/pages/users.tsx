import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { User, Role } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Shield, CheckCircle, XCircle, Clock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const userSchema = z.object({
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  active: z.boolean().default(true),
});

type UserFormData = z.infer<typeof userSchema>;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Omit<User, "password"> | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/users"],
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  // Parallel fetch of all user-role assignments
  const userRoleResults = useQueries({
    queries: users.map((user) => ({
      queryKey: ["/api/users", user.id, "roles"],
      enabled: users.length > 0,
    })),
  });

  // Build userId → roleIds[] mapping
  const userRoleMap = useMemo(() => {
    const map = new Map<string, string[]>();
    users.forEach((user, idx) => {
      const result = userRoleResults[idx];
      if (result.data && Array.isArray(result.data)) {
        map.set(user.id, (result.data as { roleId: string }[]).map((ur) => ur.roleId));
      } else {
        map.set(user.id, []);
      }
    });
    return map;
  }, [users, userRoleResults]);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { username: "", password: "", name: "", email: "", active: true },
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const res = await apiRequest("POST", "/api/users", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Usuário criado", description: "O usuário foi criado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário atualizado", description: "O usuário foi atualizado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar usuário", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário aprovado", description: "O usuário pode acessar o sistema agora." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao aprovar usuário.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedUser(null);
      toast({ title: "Usuário rejeitado", description: "O usuário foi notificado." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao rejeitar usuário.", variant: "destructive" });
    },
  });

  // Stats
  const totalCount = users.length;
  const pendingCount = users.filter((u) => (u.approvalStatus || "approved") === "pending").length;
  const approvedCount = users.filter((u) => (u.approvalStatus || "approved") === "approved").length;
  const rejectedCount = users.filter((u) => (u.approvalStatus || "approved") === "rejected").length;

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesApproval =
      approvalFilter === "all" || (user.approvalStatus || "approved") === approvalFilter;
    const userRoleIds = userRoleMap.get(user.id) || [];
    const matchesRole = roleFilter === "all" || userRoleIds.includes(roleFilter);
    return matchesSearch && matchesApproval && matchesRole;
  });

  const handleSubmit = (data: UserFormData) => createMutation.mutate(data);

  const toggleUserActive = (user: Omit<User, "password">) => {
    updateMutation.mutate({ id: user.id, data: { active: !user.active } });
  };

  const handleApprove = (user: Omit<User, "password">) => {
    if (confirm(`Aprovar usuário ${user.name}?`)) approveMutation.mutate(user.id);
  };

  const handleReject = (user: Omit<User, "password">) => {
    setSelectedUser(user);
    setIsRejectDialogOpen(true);
  };

  const submitRejection = () => {
    if (!selectedUser) return;
    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      toast({ title: "Erro", description: "O motivo da rejeição é obrigatório.", variant: "destructive" });
      return;
    }
    rejectMutation.mutate({ userId: selectedUser.id, reason: trimmedReason });
  };

  const getApprovalBadge = (user: Omit<User, "password">) => {
    const status = user.approvalStatus || "approved";
    if (status === "pending")
      return (
        <Badge variant="outline" className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" data-testid={`badge-approval-pending-${user.id}`}>
          <Clock className="mr-1 h-3 w-3" />
          Pendente
        </Badge>
      );
    if (status === "approved")
      return (
        <Badge variant="outline" className="bg-green-500/15 text-green-700 dark:text-green-400" data-testid={`badge-approval-approved-${user.id}`}>
          <CheckCircle className="mr-1 h-3 w-3" />
          Aprovado
        </Badge>
      );
    if (status === "rejected")
      return (
        <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400" data-testid={`badge-approval-rejected-${user.id}`}>
          <XCircle className="mr-1 h-3 w-3" />
          Rejeitado
        </Badge>
      );
    return null;
  };

  const statsItems = [
    { label: "Total", count: totalCount, filter: "all", testId: "stat-total" },
    { label: "Pendentes", count: pendingCount, filter: "pending", testId: "stat-pending", badgeTestId: "badge-pending-count", className: "text-yellow-700 dark:text-yellow-400" },
    { label: "Aprovados", count: approvedCount, filter: "approved", testId: "stat-approved", className: "text-green-700 dark:text-green-400" },
    { label: "Rejeitados", count: rejectedCount, filter: "rejected", testId: "stat-rejected", className: "text-red-700 dark:text-red-400" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" description="Gerencie os usuários do sistema">
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-user">
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar
        </Button>
      </PageHeader>

      {/* StatsBar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsItems.map((item) => (
          <button
            key={item.filter}
            onClick={() => setApprovalFilter(item.filter)}
            data-testid={item.testId}
            className="text-left"
          >
            <Card className={`border-border/60 hover-elevate cursor-pointer transition-colors ${approvalFilter === item.filter ? "border-primary/60" : ""}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p
                  className={`text-2xl font-bold mt-0.5 ${item.className || ""}`}
                  data-testid={(item as any).badgeTestId}
                >
                  {item.count}
                </p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, usuário ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter} data-testid="select-filter-role">
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "all", label: "Todos", testId: "filter-approval-all" },
              { value: "pending", label: "Pendentes", icon: Clock, testId: "filter-approval-pending" },
              { value: "approved", label: "Aprovados", icon: CheckCircle, testId: "filter-approval-approved" },
              { value: "rejected", label: "Rejeitados", icon: XCircle, testId: "filter-approval-rejected" },
            ].map(({ value, label, icon: Icon, testId }) => (
              <Button
                key={value}
                variant={approvalFilter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setApprovalFilter(value)}
                data-testid={testId}
              >
                {Icon && <Icon className="mr-1 h-3 w-3" />}
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User list */}
      {isLoading ? (
        <PageLoading message="Carregando usuários..." />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum usuário encontrado"
          description={searchTerm || approvalFilter !== "all" || roleFilter !== "all"
            ? "Tente ajustar os filtros de busca."
            : "Crie o primeiro usuário para começar."}
        />
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => {
            const approvalStatus = user.approvalStatus || "approved";
            const userRoleIds = userRoleMap.get(user.id) || [];
            const userRoleNames = userRoleIds
              .map((rid) => roles.find((r) => r.id === rid)?.name)
              .filter(Boolean) as string[];

            return (
              <Card
                key={user.id}
                className="border-border/60 hover-elevate"
                data-testid={`row-user-${user.id}`}
              >
                <CardContent className="p-3 flex flex-wrap items-center gap-3">
                  {/* Avatar */}
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarFallback className="text-xs font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-none" data-testid={`text-name-${user.id}`}>
                      {user.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      @{user.username} · {user.email}
                    </p>
                    {userRoleNames.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {userRoleNames.map((rn) => (
                          <Badge key={rn} variant="outline" className="text-[10px] px-1.5 py-0">
                            {rn}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {getApprovalBadge(user)}
                    <Badge variant={user.active ? "default" : "secondary"} data-testid={`badge-status-${user.id}`}>
                      {user.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {approvalStatus === "pending" && (
                      <>
                        <Button variant="outline" size="sm" className="text-green-600" onClick={() => handleApprove(user)} data-testid={`button-approve-${user.id}`}>
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Aprovar
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleReject(user)} data-testid={`button-reject-${user.id}`}>
                          <XCircle className="mr-1 h-3 w-3" />
                          Rejeitar
                        </Button>
                      </>
                    )}
                    {approvalStatus === "approved" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedUser(user); setIsRolesDialogOpen(true); }} data-testid={`button-manage-roles-${user.id}`}>
                          <Shield className="mr-1 h-3 w-3" />
                          Papéis
                        </Button>
                        <Button variant={user.active ? "outline" : "default"} size="sm" onClick={() => toggleUserActive(user)} data-testid={`button-toggle-active-${user.id}`}>
                          {user.active ? "Desativar" : "Ativar"}
                        </Button>
                      </>
                    )}
                    {approvalStatus === "rejected" && user.rejectionReason && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        Motivo: {user.rejectionReason}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="border-border/60">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Preencha os dados para criar um novo usuário</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl><Input {...field} data-testid="input-user-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input {...field} type="email" data-testid="input-user-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário</FormLabel>
                  <FormControl><Input {...field} data-testid="input-user-username" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl><Input {...field} type="password" data-testid="input-user-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-user-active" />
                  </FormControl>
                  <FormLabel className="!mt-0">Usuário ativo</FormLabel>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-user">Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-user">
                  {createMutation.isPending ? "Criando..." : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Manage Roles Dialog */}
      {selectedUser && (
        <UserRolesDialog
          user={selectedUser}
          roles={roles}
          isOpen={isRolesDialogOpen}
          onClose={() => { setIsRolesDialogOpen(false); setSelectedUser(null); }}
        />
      )}

      {/* Reject User Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="border-border/60" data-testid="dialog-reject-user">
          <DialogHeader>
            <DialogTitle>Rejeitar Usuário</DialogTitle>
            <DialogDescription>Informe o motivo da rejeição de {selectedUser?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="rejection-reason" className="text-sm font-medium">Motivo da Rejeição</label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Documentação incompleta, dados inválidos..."
                className="mt-2"
                data-testid="textarea-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsRejectDialogOpen(false); setRejectionReason(""); setSelectedUser(null); }} data-testid="button-cancel-reject">
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={submitRejection} disabled={rejectMutation.isPending} data-testid="button-confirm-reject">
              <XCircle className="mr-2 h-4 w-4" />
              {rejectMutation.isPending ? "Rejeitando..." : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// User Roles Dialog Component
function UserRolesDialog({
  user,
  roles,
  isOpen,
  onClose,
}: {
  user: Omit<User, "password">;
  roles: Role[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: userRoles = [] } = useQuery<any[]>({
    queryKey: ["/api/users", user.id, "roles"],
    enabled: isOpen,
  });

  const assignRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await apiRequest("POST", `/api/users/${user.id}/roles`, { roleId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "roles"] });
      toast({ title: "Papel atribuído", description: "O papel foi atribuído ao usuário com sucesso." });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await apiRequest("DELETE", `/api/users/${user.id}/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "roles"] });
      toast({ title: "Papel removido", description: "O papel foi removido do usuário com sucesso." });
    },
  });

  const userRoleIds = new Set(userRoles.map((ur) => ur.roleId));

  const handleRoleToggle = (roleId: string, isAssigned: boolean) => {
    if (isAssigned) removeRoleMutation.mutate(roleId);
    else assignRoleMutation.mutate(roleId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-border/60">
        <DialogHeader>
          <DialogTitle>Gerenciar Papéis — {user.name}</DialogTitle>
          <DialogDescription>Selecione os papéis que deseja atribuir ao usuário</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {roles.map((role) => {
            const isAssigned = userRoleIds.has(role.id);
            return (
              <div key={role.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="font-medium text-sm">{role.name}</p>
                  {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                </div>
                <Checkbox checked={isAssigned} onCheckedChange={() => handleRoleToggle(role.id, isAssigned)} data-testid={`checkbox-role-${role.id}`} />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={onClose} data-testid="button-close-roles">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

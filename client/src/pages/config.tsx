import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Truck, User, Warehouse as WarehouseIcon, Save, Bell, Clock, Calendar, Lock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";
import type { Vehicle, Driver, Dock } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Config() {
  const { toast } = useToast();
  const { data: vehicles } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: docks } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  // Local state for system settings form
  const [cutoffDays, setCutoffDays] = useState("3");
  const [cutoffTime, setCutoffTime] = useState("17:00");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [autoApproveSmall, setAutoApproveSmall] = useState(false);
  const [maxItemsPerRequest, setMaxItemsPerRequest] = useState("50");
  const [sessionTimeout, setSessionTimeout] = useState("480");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsSaving(false);
    toast({
      title: "Configurações salvas",
      description: "As preferências do sistema foram atualizadas com sucesso.",
    });
  };

  const sections = [
    {
      title: "Veículos",
      icon: Truck,
      count: vehicles?.length || 0,
      description: "Gerencie a frota de veículos",
      testId: "vehicles-section",
    },
    {
      title: "Motoristas",
      icon: User,
      count: drivers?.length || 0,
      description: "Gerencie o cadastro de motoristas",
      testId: "drivers-section",
    },
    {
      title: "Docas",
      icon: WarehouseIcon,
      count: docks?.length || 0,
      description: "Configure docas de carregamento",
      testId: "docks-section",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações do Sistema"
        description="Gerencie configurações e recursos do sistema"
      />

      {/* Resource summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.title} className="hover-elevate border-border/60 overflow-hidden" data-testid={section.testId}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-base text-foreground flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <section.icon className="h-4 w-4 text-primary/70" />
                  </div>
                  {section.title}
                </div>
                <Button variant="ghost" size="icon" data-testid={`button-add-${section.title.toLowerCase()}`}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-2xl font-bold tracking-tight mb-1">{section.count}</div>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Requisition settings */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-primary/70" />
            </div>
            <div>
              <p className="font-semibold text-base">Configurações de Requisição</p>
              <p className="text-xs text-muted-foreground">Prazos e limites para criação de requisições</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cutoff-days">Prazo de corte padrão (dias antes do evento)</Label>
              <Input
                id="cutoff-days"
                type="number"
                min="1"
                max="30"
                value={cutoffDays}
                onChange={(e) => setCutoffDays(e.target.value)}
                data-testid="input-cutoff-days"
              />
              <p className="text-xs text-muted-foreground">Número de dias antes do evento em que as requisições são bloqueadas</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cutoff-time">Horário de corte</Label>
              <Input
                id="cutoff-time"
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                data-testid="input-cutoff-time"
              />
              <p className="text-xs text-muted-foreground">Horário limite para envio de requisições no dia do prazo</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-items">Máximo de itens por requisição</Label>
              <Input
                id="max-items"
                type="number"
                min="1"
                max="500"
                value={maxItemsPerRequest}
                onChange={(e) => setMaxItemsPerRequest(e.target.value)}
                data-testid="input-max-items"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Aprovação automática (pequenas quantidades)</p>
                <p className="text-xs text-muted-foreground">Aprovar automaticamente requisições com quantidade total abaixo de 10</p>
              </div>
              <Switch
                checked={autoApproveSmall}
                onCheckedChange={setAutoApproveSmall}
                data-testid="switch-auto-approve"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification settings */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="h-4 w-4 text-primary/70" />
            </div>
            <div>
              <p className="font-semibold text-base">Configurações de Notificação</p>
              <p className="text-xs text-muted-foreground">Canais e preferências de envio de notificações</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Notificações por e-mail</p>
                <p className="text-xs text-muted-foreground">Enviar e-mail para eventos importantes (aprovações, rejeições, mentions)</p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
                data-testid="switch-email-notifications"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Notificações no sistema</p>
                <p className="text-xs text-muted-foreground">Exibir notificações em tempo real no painel</p>
              </div>
              <Switch
                checked={inAppNotifications}
                onCheckedChange={setInAppNotifications}
                data-testid="switch-inapp-notifications"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security settings */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="h-4 w-4 text-primary/70" />
            </div>
            <div>
              <p className="font-semibold text-base">Segurança e Sessão</p>
              <p className="text-xs text-muted-foreground">Tempo de expiração de sessão e configurações de segurança</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session-timeout">Tempo limite de sessão (minutos)</Label>
              <Input
                id="session-timeout"
                type="number"
                min="30"
                max="1440"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                data-testid="input-session-timeout"
              />
              <p className="text-xs text-muted-foreground">Sessões inativas serão encerradas após este período</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change own password — available to every logged-in user */}
      <ChangePasswordCard />

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-config">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}

// Self-service password change. Unlike the surrounding mock settings, this one
// really persists — it calls POST /api/change-password, which verifies the
// current password before updating.
function ChangePasswordCard() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/change-password", { currentPassword, newPassword }),
    onSuccess: () => {
      toast({ title: "Senha alterada", description: "Sua senha foi atualizada com sucesso." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Não foi possível alterar a senha", description: error.message, variant: "destructive" });
    },
  });

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 6;
  const canSubmit =
    !!currentPassword && newPassword.length >= 6 && newPassword === confirmPassword && !mutation.isPending;

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-4 w-4 text-primary/70" />
          </div>
          <div>
            <p className="font-semibold text-base">Minha Senha</p>
            <p className="text-xs text-muted-foreground">Altere a senha da sua própria conta</p>
          </div>
        </div>

        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); if (canSubmit) mutation.mutate(); }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              data-testid="input-current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              data-testid="input-config-new-password"
            />
            {tooShort && <p className="text-xs text-destructive">A senha deve ter no mínimo 6 caracteres.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              data-testid="input-config-confirm-password"
            />
            {mismatch && <p className="text-xs text-destructive">As senhas não coincidem.</p>}
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={!canSubmit} data-testid="button-change-password">
              <KeyRound className="mr-2 h-4 w-4" />
              {mutation.isPending ? "Salvando..." : "Alterar Senha"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

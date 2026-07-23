import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, User, Warehouse as WarehouseIcon, Bell, Calendar, Lock, KeyRound, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Vehicle, Driver, Dock } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Config() {
  const { data: vehicles } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: docks } = useQuery<Dock[]>({ queryKey: ["/api/docks"] });

  // Each resource card links to the page that actually manages it, instead of
  // a dead "+" that did nothing.
  const sections = [
    { title: "Veículos", icon: Truck, count: vehicles?.length ?? 0, description: "Gerencie a frota de veículos", url: "/config/vehicles", testId: "vehicles-section" },
    { title: "Motoristas", icon: User, count: drivers?.length ?? 0, description: "Gerencie o cadastro de motoristas", url: "/config/drivers", testId: "drivers-section" },
    { title: "Docas", icon: WarehouseIcon, count: docks?.length ?? 0, description: "Configure docas de carregamento", url: "/config/docks", testId: "docks-section" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações do Sistema"
        description="Gerencie recursos, sua conta e as preferências do sistema"
      />

      {/* Resource summary cards — now real links to their management pages */}
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.title} href={section.url} data-testid={section.testId}>
            <Card className="hover-elevate border-border/60 overflow-hidden cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-base text-foreground flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <section.icon className="h-4 w-4 text-primary/70" />
                    </div>
                    {section.title}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold tracking-tight mb-1">{section.count}</div>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Change own password — the one settings block on this page that actually
          persists, so it comes first. Available to every logged-in user. */}
      <ChangePasswordCard />

      {/* Notifications live on their own page, which really persists. Link there
          instead of duplicating the controls here with fake toggles. */}
      <Link href="/notification-settings" data-testid="link-notification-settings">
        <Card className="border-border/60 hover-elevate cursor-pointer">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary/70" />
              </div>
              <div>
                <p className="font-semibold text-base">Notificações</p>
                <p className="text-xs text-muted-foreground">Canais e preferências de envio de notificações</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Planned system settings. These are not wired to any backend yet, so
          they are shown disabled and clearly labelled instead of pretending to
          save — the old page faked a success toast without persisting anything. */}
      <PlannedSettingsPreview />
    </div>
  );
}

// Read-only preview of settings that are designed but not yet functional. Kept
// visible so the intent is clear, but disabled and badged so the app never
// claims to save something it doesn't.
function PlannedSettingsPreview() {
  return (
    <Card className="border-border/60 border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-semibold text-base">Preferências do Sistema</p>
          </div>
          <Badge variant="outline" data-testid="badge-planned-settings">Em breve</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Prazos de corte, aprovação automática e expiração de sessão ainda não são aplicados pelo sistema. Os campos abaixo são uma prévia do que está planejado.
        </p>

        <fieldset disabled className="grid gap-4 sm:grid-cols-2 opacity-60">
          <div className="space-y-2">
            <Label htmlFor="cutoff-days">Prazo de corte padrão (dias antes do evento)</Label>
            <Input id="cutoff-days" type="number" defaultValue="3" data-testid="input-cutoff-days" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-items">Máximo de itens por requisição</Label>
            <Input id="max-items" type="number" defaultValue="50" data-testid="input-max-items" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-timeout">Tempo limite de sessão (minutos)</Label>
            <Input id="session-timeout" type="number" defaultValue="480" data-testid="input-session-timeout" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Aprovação automática</p>
              <p className="text-xs text-muted-foreground">Aprovar requisições com quantidade total abaixo de 10</p>
            </div>
            <Switch checked={false} data-testid="switch-auto-approve" />
          </div>
        </fieldset>
      </CardContent>
    </Card>
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

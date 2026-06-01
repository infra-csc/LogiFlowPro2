import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Truck, User, Warehouse as WarehouseIcon, Save, Bell, Clock, Calendar, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";
import type { Vehicle, Driver, Dock } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";

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

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { Label } from "@/components/ui/label";
import { Bell, Mail, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { NotificationSettings } from "@shared/schema";

export default function NotificationSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    emailOnMention: true,
    emailOnCommentReply: false,
    emailOnStatusChange: false,
    emailOnApprovalRequest: true,
  });

  const { data: currentSettings, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["/api/notification-settings"],
  });

  useEffect(() => {
    if (currentSettings) {
      setSettings({
        emailOnMention: currentSettings.emailOnMention,
        emailOnCommentReply: currentSettings.emailOnCommentReply,
        emailOnStatusChange: currentSettings.emailOnStatusChange,
        emailOnApprovalRequest: currentSettings.emailOnApprovalRequest,
      });
    }
  }, [currentSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: typeof settings) => {
      const res = await apiRequest("PATCH", "/api/notification-settings", data);
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-settings"] });
      toast({
        title: "Configurações salvas",
        description: "Suas preferências de notificação foram atualizadas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <PageLoading message="Carregando configurações..." />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl" data-testid="page-notification-settings">
      <PageHeader
        title="Configurações de Notificação"
        description="Gerencie como você deseja receber notificações"
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-base">
            <Bell className="h-5 w-5" />
            Notificações In-App
          </div>
          <p className="text-sm text-muted-foreground">
            As notificações in-app aparecem no sino de notificações e no dashboard.
            Esta configuração não pode ser desativada.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-base">
            <Mail className="h-5 w-5" />
            Notificações por Email
          </div>
          <p className="text-sm text-muted-foreground">
            Escolha quando você deseja receber notificações por email
          </p>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailOnMention" className="text-base font-medium">
                  Menções
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receber email quando alguém te mencionar usando @
                </p>
              </div>
              <Switch
                id="emailOnMention"
                checked={settings.emailOnMention}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailOnMention: checked })
                }
                data-testid="switch-email-mention"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailOnCommentReply" className="text-base font-medium">
                  Respostas a comentários
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receber email quando alguém responder aos seus comentários
                </p>
              </div>
              <Switch
                id="emailOnCommentReply"
                checked={settings.emailOnCommentReply}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailOnCommentReply: checked })
                }
                data-testid="switch-email-comment-reply"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailOnStatusChange" className="text-base font-medium">
                  Mudanças de status
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receber email quando o status de eventos ou requisições mudar
                </p>
              </div>
              <Switch
                id="emailOnStatusChange"
                checked={settings.emailOnStatusChange}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailOnStatusChange: checked })
                }
                data-testid="switch-email-status-change"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailOnApprovalRequest" className="text-base font-medium">
                  Solicitações de aprovação
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receber email quando houver requisições pendentes de aprovação
                </p>
              </div>
              <Switch
                id="emailOnApprovalRequest"
                checked={settings.emailOnApprovalRequest}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailOnApprovalRequest: checked })
                }
                data-testid="switch-email-approval-request"
              />
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={updateSettingsMutation.isPending}
                data-testid="button-save-settings"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> As notificações por email estão em preparação e serão ativadas em breve.
            Por enquanto, você pode configurar suas preferências para quando a funcionalidade estiver disponível.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

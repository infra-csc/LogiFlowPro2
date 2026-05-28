import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  // Event statuses
  planning: { color: "bg-chart-2 text-white", label: "Planejamento" },
  approved: { color: "bg-chart-4 text-white", label: "Aprovado" },
  in_progress: { color: "bg-primary text-primary-foreground", label: "Em Andamento" },
  completed: { color: "bg-chart-4 text-white", label: "Concluído" },
  cancelled: { color: "bg-destructive text-destructive-foreground", label: "Cancelado" },
  
  // Request statuses
  draft: { color: "bg-muted text-muted-foreground", label: "Rascunho" },
  ready: { color: "bg-chart-4 text-white", label: "Pronta" },
  pending_approval: { color: "bg-chart-5 text-white", label: "Pendente Aprovação" },
  pending: { color: "bg-chart-5 text-white", label: "Pendente" },
  rejected: { color: "bg-destructive text-destructive-foreground", label: "Rejeitado" },
  cutoff_locked: { color: "bg-chart-3 text-white", label: "Bloqueado" },
  in_picking: { color: "bg-chart-2 text-white", label: "Em Separação" },
  partially_loaded: { color: "bg-chart-5 text-white", label: "Parcialmente Carregado" },
  loaded: { color: "bg-chart-4 text-white", label: "Carregado" },
  in_transit: { color: "bg-primary text-primary-foreground", label: "Em Trânsito" },
  in_use: { color: "bg-chart-2 text-white", label: "Em Uso" },
  return_pending: { color: "bg-chart-5 text-white", label: "Retorno Pendente" },
  
  // Trip statuses
  planned: { color: "bg-chart-2 text-white", label: "Planejado" },
  loading: { color: "bg-chart-5 text-white", label: "Carregando" },
  at_destination: { color: "bg-chart-2 text-white", label: "No Destino" },
  unloading: { color: "bg-chart-5 text-white", label: "Descarregando" },
  
  // Product statuses
  available: { color: "bg-chart-4 text-white", label: "Disponível" },
  reserved: { color: "bg-chart-2 text-white", label: "Reservado" },
  damaged: { color: "bg-destructive text-destructive-foreground", label: "Danificado" },
  in_repair: { color: "bg-chart-5 text-white", label: "Em Reparo" },
  unusable: { color: "bg-muted text-muted-foreground", label: "Inutilizável" },
  lost: { color: "bg-destructive text-destructive-foreground", label: "Perdido" },

  // Movement statuses
  created: { color: "bg-muted text-muted-foreground", label: "Criado" },
  paused: { color: "bg-chart-5 text-white", label: "Pausado" },
  disapproved: { color: "bg-destructive text-destructive-foreground", label: "Desaprovado" },

  // User approval statuses
  active: { color: "bg-chart-4 text-white", label: "Ativo" },
  inactive: { color: "bg-muted text-muted-foreground", label: "Inativo" },

  // Return statuses (passive module)
  return_ok: { color: "bg-chart-4 text-white", label: "OK" },
  return_damaged: { color: "bg-chart-5 text-white", label: "Com Avaria" },
  return_lost: { color: "bg-destructive text-destructive-foreground", label: "Com Perda" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { color: "bg-muted text-muted-foreground", label: status };
  
  return (
    <Badge 
      className={cn(config.color, "text-xs font-medium", className)}
      data-testid={`status-${status}`}
    >
      {config.label}
    </Badge>
  );
}

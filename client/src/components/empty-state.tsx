import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Inbox, LucideIcon } from "lucide-react";
import React from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  title = "Nenhum registro encontrado",
  description = "Ainda não há dados para exibir nesta área.",
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16", className)}>
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <Icon className="h-7 w-7 text-primary/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-6" data-testid="empty-state-action">
          {action.label}
        </Button>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LucideIcon } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function ErrorState({
  title = "Erro ao carregar dados",
  description = "Não foi possível carregar as informações. Tente novamente.",
  icon: Icon = AlertTriangle,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8", className)}>
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="outline" className="mt-4" data-testid="error-state-retry">
          {action.label}
        </Button>
      )}
    </div>
  );
}

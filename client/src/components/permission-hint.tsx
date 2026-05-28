import { cn } from "@/lib/utils";
import { ShieldAlert, LucideIcon } from "lucide-react";

interface PermissionHintProps {
  message?: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}

export function PermissionHint({
  message = "Ação não disponível",
  description = "Você não tem permissão para executar esta ação.",
  icon: Icon = ShieldAlert,
  className,
}: PermissionHintProps) {
  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{message}</span>
    </div>
  );
}

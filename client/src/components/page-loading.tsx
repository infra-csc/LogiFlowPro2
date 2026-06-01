import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PageLoadingProps {
  message?: string;
  className?: string;
  compact?: boolean;
}

export function PageLoading({ message = "Carregando...", className, compact }: PageLoadingProps) {
  if (compact) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[30vh] p-8", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

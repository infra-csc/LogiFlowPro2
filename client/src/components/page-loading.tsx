import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PageLoadingProps {
  message?: string;
  className?: string;
}

export function PageLoading({ message = "Carregando...", className }: PageLoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[40vh] p-8", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

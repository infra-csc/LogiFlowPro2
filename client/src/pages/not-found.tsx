import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
      <Card className="w-full max-w-md mx-4 shadow-lg border border-border/60">
        <div className="flex flex-col items-center text-center p-8">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
            A página que você está procurando não existe ou foi movida.
          </p>
          <Button asChild className="mt-6 w-full" data-testid="button-back-home">
            <Link href="/">Voltar ao início</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

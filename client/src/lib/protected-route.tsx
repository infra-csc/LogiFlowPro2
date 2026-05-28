import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin } from "@/lib/authz";
import { Loader2, ShieldAlert } from "lucide-react";
import { Link, Redirect, Route } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full" data-testid="card-access-denied">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle data-testid="text-access-denied-title">Acesso negado</CardTitle>
          </div>
          <CardDescription data-testid="text-access-denied-description">
            Você não tem permissão para acessar esta área. Se precisar de acesso,
            entre em contato com um administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" data-testid="button-back-to-dashboard">
            <Link href="/">Voltar ao Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProtectedRoute({
  path,
  component: Component,
  requireAdmin = false,
}: {
  path: string;
  component: () => React.JSX.Element;
  requireAdmin?: boolean;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  if (requireAdmin && !userIsAdmin(user)) {
    return (
      <Route path={path}>
        <AccessDenied />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

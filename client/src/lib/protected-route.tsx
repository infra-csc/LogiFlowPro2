import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin } from "@/lib/authz";
import { Link, Redirect, Route } from "wouter";
import { PageLoading } from "@/components/page-loading";
import { ErrorState } from "@/components/error-state";

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
        <PageLoading message="Carregando..." />
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
        <ErrorState
          title="Acesso negado"
          description="Você não tem permissão para acessar esta área. Se precisar de acesso, entre em contato com um administrador."
          action={{
            label: "Voltar ao início",
            onClick: () => window.location.href = "/",
          }}
        />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

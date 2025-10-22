import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Events from "@/pages/events";
import Requests from "@/pages/requests";
import RequestDetails from "@/pages/request-details";
import Inventory from "@/pages/inventory";
import Trips from "@/pages/trips";
import LoadingOrders from "@/pages/loading-orders";
import LoadingOrderDetails from "@/pages/loading-order-details";
import Movements from "@/pages/movements";
import MovementDetails from "@/pages/movement-details";
import Returns from "@/pages/returns";
import Products from "@/pages/products";
import ProductUpload from "@/pages/product-upload";
import Kits from "@/pages/kits";
import Config from "@/pages/config";
import AuthPage from "@/pages/auth-page";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import UsersPage from "@/pages/users";
import RolesPage from "@/pages/roles";
import Approvals from "@/pages/approvals";
import ApprovalDetail from "@/pages/approval-detail";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/events" component={Events} />
      <ProtectedRoute path="/approvals/:id" component={ApprovalDetail} />
      <ProtectedRoute path="/approvals" component={Approvals} />
      <ProtectedRoute path="/requests/:id" component={RequestDetails} />
      <ProtectedRoute path="/requests" component={Requests} />
      <ProtectedRoute path="/inventory" component={Inventory} />
      <ProtectedRoute path="/trips" component={Trips} />
      <ProtectedRoute path="/loading-orders/:id" component={LoadingOrderDetails} />
      <ProtectedRoute path="/loading-orders" component={LoadingOrders} />
      <ProtectedRoute path="/movements/:id" component={MovementDetails} />
      <ProtectedRoute path="/movements" component={Movements} />
      <ProtectedRoute path="/returns" component={Returns} />
      <ProtectedRoute path="/products/upload" component={ProductUpload} />
      <ProtectedRoute path="/products" component={Products} />
      <ProtectedRoute path="/kits" component={Kits} />
      <ProtectedRoute path="/config" component={Config} />
      <ProtectedRoute path="/config/users" component={UsersPage} />
      <ProtectedRoute path="/config/roles" component={RolesPage} />
      <ProtectedRoute path="/config/vehicles" component={Config} />
      <ProtectedRoute path="/config/drivers" component={Config} />
      <ProtectedRoute path="/config/docks" component={Config} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <header className="flex items-center justify-between p-4 border-b border-border bg-card">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="text-sm text-muted-foreground">
                      Gestão de Logística de Eventos
                    </div>
                  </header>
                  <main className="flex-1 overflow-y-auto bg-background">
                    <Router />
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

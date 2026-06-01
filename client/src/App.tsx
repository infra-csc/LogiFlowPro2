import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { NotificationBell } from "@/components/notification-bell";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Events from "@/pages/events";
import EventDetails from "@/pages/event-details";
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
import ProductVariants from "@/pages/product-variants";
import ProductStatuses from "@/pages/product-statuses";
import Locations from "@/pages/locations";
import Suppliers from "@/pages/suppliers";
import EventUpload from "@/pages/event-upload";
import TripUpload from "@/pages/trip-upload";
import Kits from "@/pages/kits";
import Config from "@/pages/config";
import AuthPage from "@/pages/auth-page";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import UsersPage from "@/pages/users";
import RolesPage from "@/pages/roles";
import Approvals from "@/pages/approvals";
import ApprovalDetail from "@/pages/approval-detail";
import Docks from "@/pages/docks";
import Drivers from "@/pages/drivers";
import Vehicles from "@/pages/vehicles";
import VehicleTypes from "@/pages/vehicle-types";
import NotificationSettingsPage from "@/pages/notification-settings";
import StockSimulation from "@/pages/stock-simulation";
import StockPositionSimulation from "@/pages/stock-position-simulation";
import MovementGroups from "@/pages/movement-groups";
import MovementTypesConfig from "@/pages/movement-types-config";
import MovementApprovals from "@/pages/movement-approvals";
import InventoryViews from "@/pages/inventory-views";
import OperationalCalendar from "@/pages/calendar";

const PUBLIC_ROUTES = ["/auth", "/forgot-password", "/reset-password"];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
}

function DashboardRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/dashboard" component={DashboardRedirect} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/events/upload" component={EventUpload} />
      <ProtectedRoute path="/events/:id" component={EventDetails} />
      <ProtectedRoute path="/events" component={Events} />
      <ProtectedRoute path="/approvals/:id" component={ApprovalDetail} />
      <ProtectedRoute path="/approvals" component={Approvals} />
      <ProtectedRoute path="/requests/:id" component={RequestDetails} />
      <ProtectedRoute path="/requests" component={Requests} />
      <ProtectedRoute path="/inventory/views" component={InventoryViews} />
      <ProtectedRoute path="/inventory" component={Inventory} />
      <ProtectedRoute path="/trips/upload" component={TripUpload} />
      <ProtectedRoute path="/trips" component={Trips} />
      <ProtectedRoute path="/loading-orders/:id" component={LoadingOrderDetails} />
      <ProtectedRoute path="/loading-orders" component={LoadingOrders} />
      <ProtectedRoute path="/movements/:id" component={MovementDetails} />
      <ProtectedRoute path="/movements" component={Movements} />
      <ProtectedRoute path="/movement-approvals" component={MovementApprovals} />
      <ProtectedRoute path="/returns" component={Returns} />
      <ProtectedRoute path="/suppliers" component={Suppliers} />
      <ProtectedRoute path="/products/variants" component={ProductVariants} />
      <ProtectedRoute path="/products/upload" component={ProductUpload} />
      <ProtectedRoute path="/products" component={Products} />
      <ProtectedRoute path="/kits" component={Kits} />
      <ProtectedRoute path="/config" component={Config} />
      <ProtectedRoute path="/config/users" component={UsersPage} requireAdmin />
      <ProtectedRoute path="/config/roles" component={RolesPage} requireAdmin />
      <ProtectedRoute path="/config/vehicle-types" component={VehicleTypes} requireAdmin />
      <ProtectedRoute path="/config/vehicles" component={Vehicles} />
      <ProtectedRoute path="/config/drivers" component={Drivers} />
      <ProtectedRoute path="/config/docks" component={Docks} />
      <ProtectedRoute path="/notification-settings" component={NotificationSettingsPage} />
      <ProtectedRoute path="/reports/stock-simulation" component={StockSimulation} />
      <ProtectedRoute path="/reports/stock-position-simulation" component={StockPositionSimulation} />
      <ProtectedRoute path="/config/movement-groups" component={MovementGroups} requireAdmin />
      <ProtectedRoute path="/config/movement-types" component={MovementTypesConfig} requireAdmin />
      <ProtectedRoute path="/config/product-statuses" component={ProductStatuses} requireAdmin />
      <ProtectedRoute path="/config/locations" component={Locations} requireAdmin />
      <ProtectedRoute path="/calendar" component={OperationalCalendar} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const publicRoute = isPublicRoute(location);
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        {!publicRoute && <AppSidebar />}
        <div className={`flex flex-col flex-1 overflow-hidden ${publicRoute ? "" : ""}`}>
          {!publicRoute && (
            <header className="h-16 w-full flex items-center justify-between px-4 border-b border-border/40 bg-card/80 backdrop-blur-sm sticky top-0 z-40 shrink-0">
              {/* Left: toggle + brand */}
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="hidden sm:flex items-center gap-2 border-l border-border/40 pl-3">
                  <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-primary-foreground rounded-[1px]" />
                  </div>
                  <span className="text-foreground font-semibold text-sm tracking-tight">EventFlow</span>
                </div>
              </div>

              {/* Center: page title */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <h1 className="text-sm md:text-base font-medium tracking-wide uppercase text-muted-foreground">
                  Gestão de Logística de Eventos
                </h1>
              </div>

              {/* Right: actions + profile */}
              <div className="flex items-center gap-1 md:gap-2 relative z-10">
                <ThemeToggle />
                <NotificationBell />
              </div>
            </header>
          )}
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="p-8">
              <Router />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <AppLayout />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

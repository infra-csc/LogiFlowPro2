import { useEffect, lazy, Suspense } from "react";
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
import { PageLoading } from "@/components/page-loading";

// Pages are lazy-loaded so each route is its own chunk. Previously all 44
// pages (and heavy libs they pull in — xlsx, recharts, uppy, framer-motion)
// were bundled into a single ~2MB file that had to download before anything
// rendered. Now the browser only fetches the page being visited.
const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Events = lazy(() => import("@/pages/events"));
const EventDetails = lazy(() => import("@/pages/event-details"));
const EventMaterials = lazy(() => import("@/pages/event-materials"));
const EventMovements = lazy(() => import("@/pages/event-movements"));
const Requests = lazy(() => import("@/pages/requests"));
const RequestDetails = lazy(() => import("@/pages/request-details"));
const Inventory = lazy(() => import("@/pages/inventory"));
const Trips = lazy(() => import("@/pages/trips"));
const LoadingOrders = lazy(() => import("@/pages/loading-orders"));
const LoadingOrderDetails = lazy(() => import("@/pages/loading-order-details"));
const Movements = lazy(() => import("@/pages/movements"));
const MovementDetails = lazy(() => import("@/pages/movement-details"));
const Returns = lazy(() => import("@/pages/returns"));
const Products = lazy(() => import("@/pages/products"));
const ProductUpload = lazy(() => import("@/pages/product-upload"));
const ProductVariants = lazy(() => import("@/pages/product-variants"));
const ProductStatuses = lazy(() => import("@/pages/product-statuses"));
const Locations = lazy(() => import("@/pages/locations"));
const Suppliers = lazy(() => import("@/pages/suppliers"));
const EventUpload = lazy(() => import("@/pages/event-upload"));
const TripUpload = lazy(() => import("@/pages/trip-upload"));
const Kits = lazy(() => import("@/pages/kits"));
const Config = lazy(() => import("@/pages/config"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const UsersPage = lazy(() => import("@/pages/users"));
const RolesPage = lazy(() => import("@/pages/roles"));
const Approvals = lazy(() => import("@/pages/approvals"));
const ApprovalDetail = lazy(() => import("@/pages/approval-detail"));
const Docks = lazy(() => import("@/pages/docks"));
const Drivers = lazy(() => import("@/pages/drivers"));
const Vehicles = lazy(() => import("@/pages/vehicles"));
const VehicleTypes = lazy(() => import("@/pages/vehicle-types"));
const NotificationSettingsPage = lazy(() => import("@/pages/notification-settings"));
const StockProjection = lazy(() => import("@/pages/stock-projection"));
const MovementGroups = lazy(() => import("@/pages/movement-groups"));
const MovementTypesConfig = lazy(() => import("@/pages/movement-types-config"));
const MovementApprovals = lazy(() => import("@/pages/movement-approvals"));
const InventoryViews = lazy(() => import("@/pages/inventory-views"));
const OperationalCalendar = lazy(() => import("@/pages/calendar"));
const RequestTemplates = lazy(() => import("@/pages/request-templates"));

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

function StockProjectionRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/reports/stock-projection");
  }, [setLocation]);
  return <></>;
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
      <ProtectedRoute path="/events/:id/materials" component={EventMaterials} />
      <ProtectedRoute path="/events/:id/movements" component={EventMovements} />
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
      <ProtectedRoute path="/reports/stock-projection" component={StockProjection} />
      <ProtectedRoute path="/reports/stock-simulation" component={StockProjectionRedirect} />
      <ProtectedRoute path="/reports/stock-position-simulation" component={StockProjectionRedirect} />
      <ProtectedRoute path="/config/movement-groups" component={MovementGroups} requireAdmin />
      <ProtectedRoute path="/config/movement-types" component={MovementTypesConfig} requireAdmin />
      <ProtectedRoute path="/config/product-statuses" component={ProductStatuses} requireAdmin />
      <ProtectedRoute path="/config/locations" component={Locations} requireAdmin />
      <ProtectedRoute path="/config/request-templates" component={RequestTemplates} requireAdmin />
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
            <div className="p-4 sm:p-6 md:p-8">
              <Suspense fallback={<PageLoading message="Carregando..." />}>
                <Router />
              </Suspense>
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

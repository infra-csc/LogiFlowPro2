import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Events from "@/pages/events";
import Requests from "@/pages/requests";
import Inventory from "@/pages/inventory";
import Trips from "@/pages/trips";
import Returns from "@/pages/returns";
import Products from "@/pages/products";
import Kits from "@/pages/kits";
import Config from "@/pages/config";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/events" component={Events} />
      <Route path="/requests" component={Requests} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/trips" component={Trips} />
      <Route path="/returns" component={Returns} />
      <Route path="/products" component={Products} />
      <Route path="/kits" component={Kits} />
      <Route path="/config" component={Config} />
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}

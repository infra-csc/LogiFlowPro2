import { 
  LayoutDashboard, 
  Calendar, 
  Package, 
  Boxes, 
  ClipboardList, 
  Truck, 
  FileStack,
  RotateCcw,
  Settings,
  Warehouse,
  Users,
  Shield,
  CarFront,
  UserCog,
  Dock as DockIcon,
  ChevronDown,
  LogOut,
  CheckSquare
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Aprovações",
    url: "/approvals",
    icon: CheckSquare,
  },
  {
    title: "Requisição de Materiais",
    url: "/requests",
    icon: ClipboardList,
  },
  {
    title: "Estoque",
    url: "/inventory",
    icon: Warehouse,
  },
  {
    title: "Planejamento de Viagens",
    url: "/trips",
    icon: Truck,
  },
  {
    title: "Ordens de Carregamento",
    url: "/loading-orders",
    icon: FileStack,
  },
  {
    title: "Carga e Descarga",
    url: "/movements",
    icon: FileStack,
  },
  {
    title: "Devoluções",
    url: "/returns",
    icon: RotateCcw,
  },
];

const catalogItems = [
  {
    title: "Eventos",
    url: "/events",
    icon: Calendar,
  },
  {
    title: "Produtos",
    url: "/products",
    icon: Package,
  },
  {
    title: "Kits & BOM",
    url: "/kits",
    icon: Boxes,
  },
];

const configItems = [
  {
    title: "Usuários",
    url: "/config/users",
    icon: Users,
  },
  {
    title: "Papéis e Permissões",
    url: "/config/roles",
    icon: Shield,
  },
  {
    title: "Veículos",
    url: "/config/vehicles",
    icon: CarFront,
  },
  {
    title: "Motoristas",
    url: "/config/drivers",
    icon: UserCog,
  },
  {
    title: "Docas",
    url: "/config/docks",
    icon: DockIcon,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <Sidebar>
      <SidebarContent>
        <div className="p-4 border-b border-sidebar-border">
          <h1 className="text-lg font-semibold text-sidebar-foreground">EventFlow</h1>
          <p className="text-xs text-muted-foreground">Logistics Manager</p>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>Operações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Catálogo</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {catalogItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton data-testid="button-config-menu">
                      <Settings className="h-4 w-4" />
                      <span>Configuração</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {configItems.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton 
                            asChild 
                            isActive={location === item.url}
                            data-testid={`link-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                          >
                            <Link href={item.url}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <div className="p-4 border-t border-sidebar-border space-y-2">
            <div className="text-sm">
              <p className="font-medium text-sidebar-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

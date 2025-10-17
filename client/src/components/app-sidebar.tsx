import { 
  LayoutDashboard, 
  Calendar, 
  Package, 
  Boxes, 
  ClipboardList, 
  Truck, 
  RotateCcw,
  Settings,
  Warehouse
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
} from "@/components/ui/sidebar";

const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Eventos",
    url: "/events",
    icon: Calendar,
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
    title: "Devoluções",
    url: "/returns",
    icon: RotateCcw,
  },
];

const catalogItems = [
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
  {
    title: "Configuração",
    url: "/config",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

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
      </SidebarContent>
    </Sidebar>
  );
}

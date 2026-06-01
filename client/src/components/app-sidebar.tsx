import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
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
  CheckSquare,
  Upload,
  Bell,
  BarChart3,
  Link2 as LinkIcon,
  User,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
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
import { userIsAdmin, userCanViewMovementApprovalQueue } from "@/lib/authz";

const approvalItems = [
  { title: "Requisições", url: "/approvals", icon: ClipboardList },
  { title: "Movimentações", url: "/movement-approvals", icon: FileStack },
];

const mainMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Calendário Operacional", url: "/calendar", icon: CalendarDays },
  { title: "Requisição de Materiais", url: "/requests", icon: ClipboardList },
  { title: "Ordens de Carregamento", url: "/loading-orders", icon: FileStack },
  { title: "Movimentações", url: "/movements", icon: FileStack },
  { title: "Devoluções", url: "/returns", icon: RotateCcw },
];

const inventoryItems = [
  { title: "Posição de Estoque", url: "/inventory", icon: Warehouse },
  { title: "Visões de Estoque", url: "/inventory/views", icon: BarChart3 },
];

const eventItems = [
  { title: "Listagem", url: "/events", icon: Calendar },
  { title: "Upload em Lote", url: "/events/upload", icon: Upload },
];

const tripItems = [
  { title: "Listagem", url: "/trips", icon: Truck },
  { title: "Upload em Lote", url: "/trips/upload", icon: Upload },
];

const catalogItems = [
  { title: "Kits & BOM", url: "/kits", icon: Boxes },
];

type ProductItem = {
  title: string;
  url: string;
  icon: typeof Package;
  adminOnly?: boolean;
};

const productItems: ProductItem[] = [
  { title: "Listagem", url: "/products", icon: Package },
  { title: "Variantes", url: "/products/variants", icon: LinkIcon },
  { title: "Fornecedores", url: "/suppliers", icon: Users },
  { title: "Upload em Lote", url: "/products/upload", icon: Upload, adminOnly: true },
];

const reportItems = [
  { title: "Simulação de Estoque", url: "/reports/stock-simulation", icon: BarChart3 },
  { title: "Posição de Estoque por Período", url: "/reports/stock-position-simulation", icon: BarChart3 },
];

const movementTypeItems = [
  { title: "Grupos de Movimentação", url: "/config/movement-groups", icon: Boxes },
  { title: "Tipos de Movimentação", url: "/config/movement-types", icon: FileStack },
];

type ConfigItem = {
  title: string;
  url: string;
  icon: typeof Bell;
  adminOnly?: boolean;
};

const configItems: ConfigItem[] = [
  { title: "Notificações", url: "/notification-settings", icon: Bell },
  { title: "Usuários", url: "/config/users", icon: Users, adminOnly: true },
  { title: "Papéis e Permissões", url: "/config/roles", icon: Shield, adminOnly: true },
  { title: "Tipos de Veículos", url: "/config/vehicle-types", icon: Truck, adminOnly: true },
  { title: "Veículos", url: "/config/vehicles", icon: CarFront },
  { title: "Motoristas", url: "/config/drivers", icon: UserCog },
  { title: "Docas", url: "/config/docks", icon: DockIcon },
  { title: "Status de Produtos", url: "/config/product-statuses", icon: CheckSquare, adminOnly: true },
  { title: "Localizações", url: "/config/locations", icon: Warehouse, adminOnly: true },
];

function MenuItem({
  item,
  location,
  dataTestId,
}: {
  item: { title: string; url: string; icon: typeof Package };
  location: string;
  dataTestId?: string;
}) {
  const isActive = location === item.url;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        data-testid={dataTestId}
        className={
          isActive
            ? "relative bg-sidebar-accent/60 text-sidebar-accent-foreground font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-full before:bg-primary"
            : ""
        }
      >
        <Link href={item.url}>
          <item.icon className={isActive ? "h-4 w-4 text-primary" : "h-4 w-4"} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function CollapsibleMenu({
  title,
  icon: Icon,
  items,
  location,
  dataTestId,
  filterFn,
}: {
  title: string;
  icon: typeof Package;
  items: { title: string; url: string; icon: typeof Package }[];
  location: string;
  dataTestId?: string;
  filterFn?: (item: { title: string }) => boolean;
}) {
  const filteredItems = filterFn ? items.filter(filterFn) : items;
  const hasActive = filteredItems.some((i) => location === i.url);

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            data-testid={dataTestId}
            className={
              hasActive
                ? "relative bg-sidebar-accent/40 text-sidebar-accent-foreground font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-full before:bg-primary"
                : ""
            }
          >
            <Icon className={hasActive ? "h-4 w-4 text-primary" : "h-4 w-4"} />
            <span>{title}</span>
            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="border-l border-sidebar-border/60 ml-3 pl-3 pr-0 mr-0">
            {filteredItems.map((item) => {
              const subActive = location === item.url;
              return (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={subActive}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                    className={
                      subActive
                        ? "bg-sidebar-accent/40 text-sidebar-accent-foreground font-medium"
                        : ""
                    }
                  >
                    <Link href={item.url}>
                      <item.icon className={subActive ? "h-4 w-4 text-primary" : "h-4 w-4"} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isAdmin = userIsAdmin(user);
  const visibleConfigItems = configItems.filter((item) => !item.adminOnly || isAdmin);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar h-screen flex flex-col">
      {/* Header — fixed */}
      <div className="px-6 pt-5 pb-4 flex items-center gap-3 shrink-0">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Package className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="overflow-hidden whitespace-nowrap">
          <h1 className="text-[20px] font-semibold text-sidebar-primary-foreground leading-none">
            EventFlow
          </h1>
          <p className="text-[12px] font-medium text-sidebar-foreground/60 mt-1">
            Logistics Manager
          </p>
        </div>
      </div>

      {/* Navigation — scrollable */}
      <SidebarContent className="sidebar-scroll flex-1 overflow-y-auto min-h-0 px-4 pb-4">
        <div className="space-y-6">
          {/* Operações */}
          <div className="space-y-1">
            <p className="px-2 pb-1.5 text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-[0.06em]">
              Operações
            </p>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <MenuItem
                  key={item.title}
                  item={item}
                  location={location}
                  dataTestId={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                />
              ))}
              <CollapsibleMenu
                title="Estoque"
                icon={Warehouse}
                items={inventoryItems}
                location={location}
                dataTestId="button-inventory-menu"
              />
              <CollapsibleMenu
                title="Aprovações"
                icon={CheckSquare}
                items={approvalItems}
                location={location}
                dataTestId="button-approvals-menu"
                filterFn={(item) =>
                  item.title !== "Movimentações" || userCanViewMovementApprovalQueue(user)
                }
              />
              <CollapsibleMenu
                title="Viagens"
                icon={Truck}
                items={tripItems}
                location={location}
                dataTestId="button-trips-menu"
              />
            </SidebarMenu>
          </div>

          {/* Catálogo */}
          <div className="space-y-1">
            <p className="px-2 pb-1.5 text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-[0.06em]">
              Catálogo
            </p>
            <SidebarMenu>
              <CollapsibleMenu
                title="Eventos"
                icon={Calendar}
                items={eventItems}
                location={location}
                dataTestId="button-events-menu"
              />
              {catalogItems.map((item) => (
                <MenuItem
                  key={item.title}
                  item={item}
                  location={location}
                  dataTestId={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                />
              ))}
              <CollapsibleMenu
                title="Produtos"
                icon={Package}
                items={productItems.filter((item) => !item.adminOnly || isAdmin)}
                location={location}
                dataTestId="button-products-menu"
              />
            </SidebarMenu>
          </div>

          {/* Relatórios */}
          <div className="space-y-1">
            <p className="px-2 pb-1.5 text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-[0.06em]">
              Relatórios
            </p>
            <SidebarMenu>
              {reportItems.map((item) => (
                <MenuItem
                  key={item.title}
                  item={item}
                  location={location}
                  dataTestId={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                />
              ))}
            </SidebarMenu>
          </div>

          {/* Configuração */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 pb-1.5">
              <p className="text-[11px] font-semibold text-sidebar-foreground/50 uppercase tracking-[0.06em]">
                Configuração
              </p>
              {isAdmin && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
                  ADMIN
                </span>
              )}
            </div>
            <SidebarMenu>
              <CollapsibleMenu
                title="Configuração"
                icon={Settings}
                items={visibleConfigItems}
                location={location}
                dataTestId="button-config-menu"
              />
              {isAdmin && (
                <CollapsibleMenu
                  title="Tipos de Movimentação"
                  icon={FileStack}
                  items={movementTypeItems}
                  location={location}
                  dataTestId="button-movement-types-menu"
                />
              )}
            </SidebarMenu>
          </div>
        </div>
      </SidebarContent>

      {/* Footer — fixed */}
      <SidebarFooter>
        {user && (
          <div className="p-3 border-t border-sidebar-border bg-sidebar/50 shrink-0">
            <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-sidebar-accent/40 transition-colors group cursor-pointer">
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <div className="h-9 w-9 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-sidebar-foreground/50" />
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-[13px] font-semibold text-sidebar-foreground truncate">
                    {user.name}
                  </p>
                  <p className="text-[11px] font-medium text-sidebar-foreground/50 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-sidebar-foreground/40 hover:text-destructive transition-colors shrink-0"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

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
import { userIsAdmin, userCanViewMovementApprovalQueue } from "@/lib/authz";

const approvalItems = [
  {
    title: "Requisições",
    url: "/approvals",
    icon: ClipboardList,
  },
  {
    title: "Movimentações",
    url: "/movement-approvals",
    icon: FileStack,
  },
];

const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Requisição de Materiais",
    url: "/requests",
    icon: ClipboardList,
  },
  {
    title: "Ordens de Carregamento",
    url: "/loading-orders",
    icon: FileStack,
  },
  {
    title: "Movimentações",
    url: "/movements",
    icon: FileStack,
  },
  {
    title: "Devoluções",
    url: "/returns",
    icon: RotateCcw,
  },
];

const inventoryItems = [
  {
    title: "Posição de Estoque",
    url: "/inventory",
    icon: Warehouse,
  },
  {
    title: "Visões de Estoque",
    url: "/inventory/views",
    icon: BarChart3,
  },
];

const eventItems = [
  {
    title: "Listagem",
    url: "/events",
    icon: Calendar,
  },
  {
    title: "Upload em Lote",
    url: "/events/upload",
    icon: Upload,
  },
];

const tripItems = [
  {
    title: "Listagem",
    url: "/trips",
    icon: Truck,
  },
  {
    title: "Upload em Lote",
    url: "/trips/upload",
    icon: Upload,
  },
];

const catalogItems = [
  {
    title: "Kits & BOM",
    url: "/kits",
    icon: Boxes,
  },
];

type ProductItem = {
  title: string;
  url: string;
  icon: typeof Package;
  adminOnly?: boolean;
};

const productItems: ProductItem[] = [
  {
    title: "Listagem",
    url: "/products",
    icon: Package,
  },
  {
    title: "Variantes",
    url: "/products/variants",
    icon: LinkIcon,
  },
  {
    title: "Fornecedores",
    url: "/suppliers",
    icon: Users,
  },
  {
    title: "Upload em Lote",
    url: "/products/upload",
    icon: Upload,
    adminOnly: true,
  },
];

const reportItems = [
  {
    title: "Simulação de Estoque",
    url: "/reports/stock-simulation",
    icon: BarChart3,
  },
  {
    title: "Posição de Estoque por Período",
    url: "/reports/stock-position-simulation",
    icon: BarChart3,
  },
];

const movementTypeItems = [
  {
    title: "Grupos de Movimentação",
    url: "/config/movement-groups",
    icon: Boxes,
  },
  {
    title: "Tipos de Movimentação",
    url: "/config/movement-types",
    icon: FileStack,
  },
];

type ConfigItem = {
  title: string;
  url: string;
  icon: typeof Bell;
  adminOnly?: boolean;
};

const configItems: ConfigItem[] = [
  {
    title: "Notificações",
    url: "/notification-settings",
    icon: Bell,
  },
  {
    title: "Usuários",
    url: "/config/users",
    icon: Users,
    adminOnly: true,
  },
  {
    title: "Papéis e Permissões",
    url: "/config/roles",
    icon: Shield,
    adminOnly: true,
  },
  {
    title: "Tipos de Veículos",
    url: "/config/vehicle-types",
    icon: Truck,
    adminOnly: true,
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
  {
    title: "Status de Produtos",
    url: "/config/product-statuses",
    icon: CheckSquare,
    adminOnly: true,
  },
  {
    title: "Localizações",
    url: "/config/locations",
    icon: Warehouse,
    adminOnly: true,
  },
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
      <SidebarMenuButton asChild isActive={isActive} data-testid={dataTestId}>
        <Link href={item.url}>
          <item.icon className="h-4 w-4" />
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

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton data-testid={dataTestId}>
            <Icon className="h-4 w-4" />
            <span>{title}</span>
            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {filteredItems.map((item) => (
              <SidebarMenuSubItem key={item.title}>
                <SidebarMenuSubButton
                  asChild
                  isActive={location === item.url}
                  data-testid={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}
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
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isAdmin = userIsAdmin(user);
  const visibleConfigItems = configItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <Sidebar className="border-r border-[#1e293b] bg-[#0e1c2d]">
      <SidebarContent className="sidebar-scroll">
        {/* Header */}
        <div className="px-6 py-6 flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-lg bg-[#00a3ff] flex items-center justify-center shadow-lg shadow-[#00a3ff]/20">
            <Package className="h-5 w-5 text-[#00375a]" />
          </div>
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="text-[20px] font-semibold text-[#98cbff] leading-none">
              EventFlow
            </h1>
            <p className="text-[12px] font-medium text-[#bec7d4] mt-1">
              Logistics Manager
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-6 pb-6">
          {/* Operações */}
          <div className="space-y-1">
            <p className="px-2 pb-2 text-[12px] font-medium text-[#88919d] uppercase tracking-[0.05em]">
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
                  item.title !== "Movimentações" ||
                  userCanViewMovementApprovalQueue(user)
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
            <p className="px-2 pb-2 text-[12px] font-medium text-[#88919d] uppercase tracking-[0.05em]">
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
                items={productItems.filter(
                  (item) => !item.adminOnly || isAdmin,
                )}
                location={location}
                dataTestId="button-products-menu"
              />
            </SidebarMenu>
          </div>

          {/* Relatórios */}
          <div className="space-y-1">
            <p className="px-2 pb-2 text-[12px] font-medium text-[#88919d] uppercase tracking-[0.05em]">
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
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-[12px] font-medium text-[#88919d] uppercase tracking-[0.05em]">
                Configuração
              </p>
              {isAdmin && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00a3ff]/10 text-[#00a3ff] border border-[#00a3ff]/20">
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
        </nav>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        {user && (
          <div className="p-4 border-t border-[#1e293b] bg-[#010f1f]/50 shrink-0">
            <div className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-[#283647]/30 transition-colors group cursor-pointer">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-9 w-9 rounded-lg bg-[#1d2b3c] flex items-center justify-center ring-2 ring-[#1e293b]">
                  <User className="h-4 w-4 text-[#88919d]" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[14px] font-semibold text-[#d5e4fa] truncate">
                    {user.name}
                  </p>
                  <p className="text-[12px] font-medium text-[#88919d] truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-[#88919d] hover:text-[#ef4444] transition-colors"
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

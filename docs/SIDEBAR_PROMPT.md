# Prompt Detalhado — Layout do Sidebar (AppSidebar)

## Visão Geral

O sidebar é um painel lateral de navegação fixo à esquerda, implementado com os componentes Shadcn/ui `Sidebar` (via `@/components/ui/sidebar`). Ele é **colapsível** (rail/hamburger) e organiza o menu em **grupos colapsáveis** com hierarquia de itens e subitens.

---

## Estrutura de Grupos

O sidebar possui 4 grupos principais (de cima para baixo), cada um com `SidebarGroupLabel` como título:

### 1. Operações
- **Dashboard** → `/` (LayoutDashboard)
- **Requisição de Materiais** → `/requests` (ClipboardList)
- **Ordens de Carregamento** → `/loading-orders` (FileStack)
- **Movimentações** → `/movements` (FileStack)
- **Devoluções** → `/returns` (RotateCcw)
- **Estoque** (submenu colapsável)
  - Posição de Estoque → `/inventory` (Warehouse)
  - Visões de Estoque → `/inventory/views` (BarChart3)
- **Aprovações** (submenu colapsável)
  - Requisições → `/approvals` (ClipboardList)
  - Movimentações → `/movement-approvals` (FileStack) — *oculto para não-Admin/Supervisor*
- **Viagens** (submenu colapsável)
  - Listagem → `/trips` (Truck)
  - Upload em Lote → `/trips/upload` (Upload)

### 2. Catálogo
- **Eventos** (submenu colapsável)
  - Listagem → `/events` (Calendar)
  - Upload em Lote → `/events/upload` (Upload)
- **Kits & BOM** → `/kits` (Boxes)
- **Produtos** (submenu colapsável)
  - Listagem → `/products` (Package)
  - Variantes → `/products/variants` (Link2)
  - Fornecedores → `/suppliers` (Users)
  - Upload em Lote → `/products/upload` (Upload) — *admin-only*

### 3. Relatórios
- Simulação de Estoque → `/reports/stock-simulation` (BarChart3)
- Posição de Estoque por Período → `/reports/stock-position-simulation` (BarChart3)

### 4. Configuração
- **Configuração** (submenu colapsável)
  - Notificações → `/notification-settings` (Bell)
  - Usuários → `/config/users` (Users) — *admin-only*
  - Papéis e Permissões → `/config/roles` (Shield) — *admin-only*
  - Tipos de Veículos → `/config/vehicle-types` (Truck) — *admin-only*
  - Veículos → `/config/vehicles` (CarFront)
  - Motoristas → `/config/drivers` (UserCog)
  - Docas → `/config/docks` (Dock)
  - Status de Produtos → `/config/product-statuses` (CheckSquare) — *admin-only*
  - Localizações → `/config/locations` (Warehouse) — *admin-only*
- **Tipos de Movimentação** (submenu colapsável) — *admin-only*
  - Grupos de Movimentação → `/config/movement-groups` (Boxes)
  - Tipos de Movimentação → `/config/movement-types` (FileStack)

---

## Header do Sidebar

- **Logo/brand**: ícone de Package (caixa) em `h-9 w-9` com fundo `bg-sidebar-primary/20` (Azure com 20% opacidade)
- **Título**: "EventFlow" em `text-sm font-semibold`
- **Subtítulo**: "Logistics Manager" em `text-[11px] text-sidebar-foreground/60`
- Separador visual: `border-b border-sidebar-border` abaixo do header

---

## Footer do Sidebar

- **Usuário logado**: nome (`font-medium`) + email (`text-xs text-muted-foreground`)
- **Botão Sair**: `Button variant="outline" size="sm"` com ícone LogOut
- Separador: `border-t border-sidebar-border` acima do footer

---

## Comportamentos

### 1. Estado Ativo
- Item ativo recebe `isActive={location === item.url}` → destaque visual do Shadcn (geralmente fundo ligeiramente mais claro e texto primário)
- Subitens também recebem `isActive` individualmente

### 2. Submenus Colapsáveis
- Usam `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent`
- Ícone `ChevronDown` rotaciona 180° quando aberto (`group-data-[state=open]/collapsible:rotate-180`)
- Padrão: `defaultOpen={true}` (todos abertos por padrão)
- Trigger: clique no botão pai (não no item inteiro, apenas no ícone de seta)

### 3. Gating por Permissões (RBAC)
- Itens `adminOnly` são filtrados via `visibleConfigItems = configItems.filter(item => !item.adminOnly || isAdmin)`
- "Movimentações" em Aprovações é oculto para não-Admin/Supervisor via `userCanViewMovementApprovalQueue(user)`
- "Tipos de Movimentação" (grupo inteiro) é condicional em `isAdmin`

### 4. Responsividade
- No breakpoint padrão do Shadcn Sidebar, o sidebar colapsa para um **rail** (apenas ícones) em telas pequenas
- Trigger de abertura via `SidebarTrigger` no header da página principal

---

## Estilo Visual (Precision Logistics)

- **Fundo**: `--sidebar: 210 71% 5%` (quase preto, navy muito escuro)
- **Texto**: `--sidebar-foreground: 213 67% 91%` (branco claro)
- **Bordas**: `--sidebar-border: 210 20% 18%` (Slate #1E293B)
- **Primário**: `--sidebar-primary: 206 100% 50%` (Azure #00A3FF)
- **Acento**: `--sidebar-accent: 210 30% 18%` (navy médio)
- **Ring**: `--sidebar-ring: 206 100% 50%` (Azure)
- **Hover**: elevação sutil via `hover-elevate` do sistema (não aplicar manualmente)
- **Item ativo**: fundo `sidebar-accent` com texto claro

---

## Padrão de Código

### Item simples (não-colapsável)
```tsx
<SidebarMenuItem>
  <SidebarMenuButton asChild isActive={location === item.url}>
    <Link href={item.url}>
      <item.icon className="h-4 w-4" />
      <span>{item.title}</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

### Submenu colapsável
```tsx
<Collapsible defaultOpen className="group/collapsible">
  <SidebarMenuItem>
    <CollapsibleTrigger asChild>
      <SidebarMenuButton>
        <Icon className="h-4 w-4" />
        <span>Título</span>
        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
      </SidebarMenuButton>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <SidebarMenuSubButton asChild isActive={location === url}>
            <Link href={url}>
              <Icon className="h-4 w-4" />
              <span>Título</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    </CollapsibleContent>
  </SidebarMenuItem>
</Collapsible>
```

---

## Regras de Implementação

1. **NUNCA** adicione `hover:bg-*` ou `hover-elevate` em `SidebarMenuButton` (já têm internamente)
2. **SEMPRE** use `asChild` + `Link` do wouter para navegação (nunca `<a href>`)
3. **SEMPRE** forneça `data-testid` em links e botões de menu
4. **SEMPRE** filtre itens admin-only antes de renderizar
5. **NUNCA** modifique o `width` do `<Sidebar>` diretamente — use `style` no `SidebarProvider` com `--sidebar-width` e `--sidebar-width-icon`
6. **NUNCA** use `display: table` ou `table` utilities
7. **SEMPRE** mantenha ícones `h-4 w-4` em menu items e `h-3.5 w-3.5` em subitems

---

## Integração com App.tsx

```tsx
<SidebarProvider style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties}>
  <div className="flex h-screen w-full">
    <AppSidebar />
    <div className="flex flex-col flex-1">
      <header>
        <SidebarTrigger />
        {/* resto do header */}
      </header>
      <main className="flex-1 overflow-hidden">
        {/* conteúdo */}
      </main>
    </div>
  </div>
</SidebarProvider>
```

---

## Ícones por Categoria (Lucide)

| Categoria | Ícones |
|-----------|--------|
| Operações | LayoutDashboard, ClipboardList, FileStack, Truck, RotateCcw, Warehouse, CheckSquare |
| Catálogo | Calendar, Package, Boxes, Users, Link2, Upload |
| Relatórios | BarChart3 |
| Configuração | Settings, Bell, Shield, CarFront, UserCog, Dock |
| Gerais | ChevronDown, LogOut |

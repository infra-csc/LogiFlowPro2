# Prompt — Layout do Sidebar (AppSidebar)

## Instrução Principal

Criar um sidebar de navegação lateral esquerda para um sistema de gestão logística chamado **EventFlow Logistics**. O sidebar deve ser **colapsível** (abre/fecha via trigger), ter **grupos de menu com submenus**, e seguir o **design system Precision Logistics** (dark-mode-first, navy profundo, azul Azure como primário). Implementar com **React + TypeScript + Tailwind CSS** usando os componentes **Shadcn/ui Sidebar**.

---

## 1. Design Visual

### Filosofia
- **Dark Mode First** — o sistema opera predominantemente em modo escuro
- **Corporate / Modern** — visual técnico, preciso, sem brincadeiras
- **Alta densidade** — informação compacta para operações de logística
- **Contraste controlado** — fundo escuro, texto claro, primário Azure brilhante

### Cores do Sidebar
| Token | Valor | Uso |
|-------|-------|-----|
| Fundo | `#050f1f` (hsl 210 71% 5%) | Cor de fundo do painel lateral |
| Texto | `#d5e4fa` (hsl 213 67% 91%) | Texto de itens de menu |
| Borda | `#1e293b` (hsl 210 20% 18%) | Divisores entre grupos e header/footer |
| Primário | `#00a3ff` (hsl 206 100% 50%) | Ícone ativo, logo, hover ring |
| Acento | `#1d2b3c` (hsl 210 30% 18%) | Fundo de item selecionado/ativo |
| Texto secundário | `#88919d` (hsl 210 10% 55%) | Labels de grupo, footer muted |
| Primário 20% | `#00a3ff` com 20% opacidade | Fundo do ícone da logo |

### Tipografia
- **Fonte**: Inter, sans-serif
- **Logo título**: 14px, font-weight 600 (semibold)
- **Logo subtítulo**: 11px, font-weight 400, opacidade 60%
- **Label de grupo**: 11px, font-weight 500, uppercase, letter-spacing 0.05em, opacidade 60%
- **Item de menu**: 14px, font-weight 400
- **Item ativo**: 14px, font-weight 500
- **Footer nome**: 14px, font-weight 500
- **Footer email**: 12px, font-weight 400, opacidade 60%

### Dimensões
- **Largura expandido**: 256px (16rem)
- **Largura colapsado (rail)**: 48px (3rem)
- **Padding lateral**: 16px (1rem)
- **Padding vertical entre grupos**: 16px
- **Gap entre itens**: 2px (mínimo, itens quase encostados)
- **Altura do header**: ~72px (com logo, título, subtítulo)
- **Altura do item de menu**: 36px (h-9)
- **Altura do subitem**: 32px (h-8)
- **Raio de borda dos itens**: 8px (rounded-lg)
- **Raio de borda da logo**: 8px (rounded-lg)

---

## 2. Estrutura de Layout

### Top → Bottom

```
[ HEADER ]
  Logo (ícone) + "EventFlow" + "Logistics Manager"
  ────────────────────────────────────

[ GRUPO: OPERAÇÕES ]
  Dashboard
  Requisição de Materiais
  Ordens de Carregamento
  Movimentações
  Devoluções
  ▼ Estoque
      ├── Posição de Estoque
      └── Visões de Estoque
  ▼ Aprovações
      ├── Requisições
      └── Movimentações*  ← oculto para não-admin
  ▼ Viagens
      ├── Listagem
      └── Upload em Lote

[ GRUPO: CATÁLOGO ]
  ▼ Eventos
      ├── Listagem
      └── Upload em Lote
  Kits & BOM
  ▼ Produtos
      ├── Listagem
      ├── Variantes
      ├── Fornecedores
      └── Upload em Lote*  ← admin-only

[ GRUPO: RELATÓRIOS ]
  Simulação de Estoque
  Posição de Estoque por Período

[ GRUPO: CONFIGURAÇÃO ]
  ▼ Configuração
      ├── Notificações
      ├── Usuários*         ← admin-only
      ├── Papéis e Permissões* ← admin-only
      ├── Tipos de Veículos* ← admin-only
      ├── Veículos
      ├── Motoristas
      ├── Docas
      ├── Status de Produtos* ← admin-only
      └── Localizações*     ← admin-only
  ▼ Tipos de Movimentação*  ← admin-only (grupo inteiro)
      ├── Grupos de Movimentação
      └── Tipos de Movimentação

  ────────────────────────────────────

[ FOOTER ]
  Nome do Usuário
  email@usuario.com
  [ ◀ Sair ]
```

---

## 3. Componentes de UI

### 3.1 Header
```
<Container com px-4 py-5 border-b border-sidebar-border>
  <Flex row gap-3>
    <div h-9 w-9 rounded-lg bg-sidebar-primary/20 
         flex items-center justify-center>
      <Package h-5 w-5 text-sidebar-primary />
    </div>
    <div>
      <h1 text-sm font-semibold text-sidebar-foreground leading-tight>
        EventFlow
      </h1>
      <p text-[11px] text-sidebar-foreground/60 leading-tight>
        Logistics Manager
      </p>
    </div>
  </Flex>
</Container>
```

### 3.2 Grupo de Menu
```
<SidebarGroup>
  <SidebarGroupLabel>
    "OPERAÇÕES"  ← uppercase, 11px, font-medium, opacity 60%
  </SidebarGroupLabel>
  <SidebarGroupContent>
    <SidebarMenu>
      {/* itens aqui */}
    </SidebarMenu>
  </SidebarGroupContent>
</SidebarGroup>
```

### 3.3 Item Simples (não-colapsável)
```
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    isActive={rotaAtual === url}
    data-testid="link-{slug}"
  >
    <Link href={url}>
      <Icon h-4 w-4 />
      <span>{título}</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

**Visual quando ativo**: fundo `sidebar-accent` (#1d2b3c), texto `sidebar-foreground` claro, sem ícone de bolinha — o destaque é sutil.

**Visual quando inativo**: fundo transparente, texto `sidebar-foreground`.

**Hover**: elevação sutil de brilho (não mudar cor de fundo explicitamente — o componente já lida com isso).

### 3.4 Submenu Colapsável
```
<Collapsible defaultOpen className="group/collapsible">
  <SidebarMenuItem>
    <CollapsibleTrigger asChild>
      <SidebarMenuButton data-testid="button-{slug}-menu">
        <Icon h-4 w-4 />
        <span>{título}</span>
        <ChevronDown
          ml-auto
          h-4 w-4
          transition-transform
          group-data-[state=open]/collapsible:rotate-180
        />
      </SidebarMenuButton>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            asChild
            isActive={rotaAtual === url}
            data-testid="link-{slug}"
          >
            <Link href={url}>
              <Icon h-4 w-4 />
              <span>{título}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    </CollapsibleContent>
  </SidebarMenuItem>
</Collapsible>
```

**Comportamento**: 
- Clique no botão pai (com ícone + título + seta) expande/colapsa
- Seta gira 180° ao abrir
- Padrão: aberto (`defaultOpen={true}`)
- Subitens têm indentação visual (padding-left maior, ícone menor)

### 3.5 Footer
```
<SidebarFooter>
  <Container p-4 border-t border-sidebar-border space-y-2>
    <div text-sm>
      <p font-medium text-sidebar-foreground>
        {user.name}
      </p>
      <p text-xs text-muted-foreground>
        {user.email}
      </p>
    </div>
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start"
      onClick={logout}
      data-testid="button-logout"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sair
    </Button>
  </Container>
</SidebarFooter>
```

---

## 4. Ícones (Lucide React)

Cada item/subitem tem um ícone à esquerda. Não usar emojis. Ícones devem ser `h-4 w-4` (16px) para itens principais e `h-4 w-4` para subitens.

| Item | Ícone |
|------|-------|
| Dashboard | `LayoutDashboard` |
| Requisição de Materiais | `ClipboardList` |
| Ordens de Carregamento | `FileStack` |
| Movimentações | `FileStack` |
| Devoluções | `RotateCcw` |
| Estoque (pai) | `Warehouse` |
| Posição de Estoque | `Warehouse` |
| Visões de Estoque | `BarChart3` |
| Aprovações (pai) | `CheckSquare` |
| Requisições (sub) | `ClipboardList` |
| Movimentações (sub) | `FileStack` |
| Viagens (pai) | `Truck` |
| Listagem (viagens) | `Truck` |
| Upload em Lote (viagens) | `Upload` |
| Eventos (pai) | `Calendar` |
| Listagem (eventos) | `Calendar` |
| Upload em Lote (eventos) | `Upload` |
| Kits & BOM | `Boxes` |
| Produtos (pai) | `Package` |
| Listagem (produtos) | `Package` |
| Variantes | `Link2` (chamado de LinkIcon) |
| Fornecedores | `Users` |
| Upload em Lote (produtos) | `Upload` |
| Simulação de Estoque | `BarChart3` |
| Posição de Estoque por Período | `BarChart3` |
| Configuração (pai) | `Settings` |
| Notificações | `Bell` |
| Usuários | `Users` |
| Papéis e Permissões | `Shield` |
| Tipos de Veículos | `Truck` |
| Veículos | `CarFront` |
| Motoristas | `UserCog` |
| Docas | `Dock` (chamado de DockIcon) |
| Status de Produtos | `CheckSquare` |
| Localizações | `Warehouse` |
| Tipos de Movimentação (pai) | `FileStack` |
| Grupos de Movimentação | `Boxes` |
| Tipos de Movimentação (sub) | `FileStack` |
| Logo | `Package` |
| Seta de submenu | `ChevronDown` |
| Botão Sair | `LogOut` |

---

## 5. Permissões (RBAC Gating)

O sidebar deve filtrar itens com base na role do usuário logado. Não renderizar itens que o usuário não pode ver (não desabilitar — ocultar).

### Regras de visibilidade
1. **Itens `adminOnly`**: visíveis apenas para `ADMIN` (isAdmin === true)
2. **"Movimentações" em Aprovações**: visível apenas para `ADMIN` ou `SUPERVISOR`
3. **"Tipos de Movimentação" (grupo inteiro)**: visível apenas para `ADMIN`
4. **Todos os outros itens**: visíveis para qualquer usuário logado

### Implementação
```tsx
const isAdmin = userIsAdmin(user); // case-insensitive, reconhece "Adm"/"admin"
const visibleConfigItems = configItems.filter(
  item => !item.adminOnly || isAdmin
);
```

---

## 6. Comportamentos

### 6.1 Navegação
- Usar `Link` do **wouter** (não `<a href>`) para navegação SPA
- Cada item/subitem deve ter `data-testid` único para testes

### 6.2 Estado Ativo
- Item ativo: `isActive={location === item.url}`
- Destaque visual: fundo `sidebar-accent` (#1d2b3c), texto claro
- Subitens também marcam `isActive` individualmente
- Se um subitem estiver ativo, o pai não precisa estar ativo (apenas o subitem)

### 6.3 Colapso/Expansão
- **Submenus**: colapsáveis individualmente via clique no botão pai
- **Sidebar inteiro**: colapsa para **rail** (apenas ícones) em telas pequenas
- **Trigger**: `SidebarTrigger` no header da página principal (botão hamburguer)
- **Padrão**: todos os submenus começam **abertos** (`defaultOpen={true}`)

### 6.4 Scroll
- Sidebar deve scrollar verticalmente se o conteúdo exceder a altura da viewport
- Header fica fixo no topo
- Footer fica fixo no bottom
- Conteúdo do meio scrolla entre header e footer

### 6.5 Hover
- Itens de menu têm hover sutil (elevação de brilho) via sistema interno do Shadcn
- **NÃO** aplicar `hover:bg-*` ou `hover-elevate` manualmente em `SidebarMenuButton`

---

## 7. Responsividade

| Breakpoint | Comportamento |
|------------|---------------|
| Desktop (>1024px) | Sidebar expandido (256px), ícones + texto visíveis |
| Tablet (<1024px) | Sidebar colapsa para **rail** (48px), apenas ícones visíveis |
| Mobile (<768px) | Sidebar oculto, abre via `SidebarTrigger` (overlay/sheet) |

### Configuração de largura
```tsx
<SidebarProvider
  style={{
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties}
>
```

---

## 8. Código de Referência Completo

### Estrutura do componente React
```tsx
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { userIsAdmin, userCanViewMovementApprovalQueue } from "@/lib/authz";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isAdmin = userIsAdmin(user);

  // Arrays de items (mainMenuItems, inventoryItems, approvalItems, etc.)
  // Cada item: { title, url, icon, adminOnly? }

  const visibleConfigItems = configItems.filter(
    item => !item.adminOnly || isAdmin
  );

  return (
    <Sidebar>
      <SidebarContent>
        {/* Header */}
        <div className="px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
              <Package className="h-5 w-5 text-sidebar-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-sidebar-foreground leading-tight">
                EventFlow
              </h1>
              <p className="text-[11px] text-sidebar-foreground/60 leading-tight">
                Logistics Manager
              </p>
            </div>
          </div>
        </div>

        {/* Grupos */}
        <SidebarGroup>
          <SidebarGroupLabel>Operações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Itens simples + submenus colapsáveis */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ...mais grupos... */}
      </SidebarContent>

      <SidebarFooter>
        {/* Footer com usuário e botão Sair */}
      </SidebarFooter>
    </Sidebar>
  );
}
```

### Integração com App.tsx
```tsx
<SidebarProvider
  style={{
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties}
>
  <div className="flex h-screen w-full">
    <AppSidebar />
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between p-2 border-b">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <NotificationBell />
      </header>
      <main className="flex-1 overflow-hidden">
        <Router />
      </main>
    </div>
  </div>
</SidebarProvider>
```

---

## 9. Restrições e Regras

1. **NUNCA** modifique `width` do `<Sidebar>` diretamente — use `SidebarProvider` com CSS vars
2. **NUNCA** use `hover:bg-*` ou `hover-elevate` em `SidebarMenuButton` (já têm internamente)
3. **SEMPRE** use `asChild` + `Link` do wouter para navegação
4. **SEMPRE** forneça `data-testid` em links e botões de menu
5. **SEMPRE** filtre itens admin-only ANTES de renderizar (não desabilite)
6. **NUNCA** use `display: table` ou `table` utilities
7. **SEMPRE** mantenha ícones `h-4 w-4` (16px) para consistência
8. **NUNCA** aninhe um `<Button>` dentro de outro `<Button>`
9. **SEMPRE** use `w-full` no filho imediato de `SidebarProvider`
10. **NUNCA** use `text-primary` para texto (apenas para branding especial)

---

## 10. Checklist de Implementação

- [ ] 4 grupos com labels corretos (Operações, Catálogo, Relatórios, Configuração)
- [ ] Header com logo (Package) + "EventFlow" + "Logistics Manager"
- [ ] Footer com nome + email + botão Sair
- [ ] 5 submenus colapsáveis (Estoque, Aprovações, Viagens, Eventos, Produtos, Configuração, Tipos de Movimentação)
- [ ] Seta ChevronDown gira 180° ao abrir
- [ ] Itens admin-only filtrados
- [ ] "Movimentações" em Aprovações oculto para não-Admin/Supervisor
- [ ] "Tipos de Movimentação" visível apenas para Admin
- [ ] Item ativo com destaque visual (fundo sidebar-accent)
- [ ] data-testid em todos os links interativos
- [ ] npm run check passando
- [ ] npm run build passando

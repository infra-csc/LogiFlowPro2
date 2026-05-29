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

### Cores do Sidebar (Tokens Material Design)
| Token | Valor | Uso |
|-------|-------|-----|
| Fundo | `#0e1c2d` (surface-container-low) | Cor de fundo do painel lateral |
| Texto | `#d5e4fa` (on-surface) | Texto de itens de menu |
| Texto secundário | `#bec7d4` (on-surface-variant) | Labels de grupo, itens inativos |
| Borda | `#1e293b` (surface-border) | Divisores entre grupos e header/footer |
| Primário | `#00a3ff` (primary-container) | Fundo do ícone da logo, hover ring |
| On Primário | `#00375a` (on-primary-container) | Cor do ícone dentro do logo |
| Container Secundário | `#314863` (secondary-container) | Fundo de item ativo/selecionado |
| On Container Secundário | `#9fb7d6` (on-secondary-container) | Texto de item ativo |
| Surface Variant | `#283647` (surface-variant) | Hover de itens inativos |
| Outline | `#88919d` (outline) | Labels de grupo, footer muted |
| Fundo Footer | `#010f1f` (surface-container-lowest) com 50% opacidade | Fundo do footer |
| Erro | `#ef4444` (status-error) | Hover do botão logout |

### Tipografia
- **Fonte**: Inter, sans-serif
- **Logo título**: 20px, font-weight 600 (semibold), cor `#98cbff` (primary)
- **Logo subtítulo**: 12px, font-weight 500, cor `#bec7d4` (on-surface-variant)
- **Label de grupo**: 12px, font-weight 500, uppercase, letter-spacing 0.05em, cor `#88919d` (outline)
- **Item de menu**: 14px, font-weight 400, cor `#d5e4fa` (on-surface)
- **Item inativo**: 14px, font-weight 400, cor `#bec7d4` (on-surface-variant)
- **Item ativo**: 14px, font-weight 600 (semibold), cor `#9fb7d6` (on-secondary-container)
- **Footer nome**: 14px, font-weight 600, cor `#d5e4fa` (on-surface)
- **Footer email**: 12px, font-weight 500, cor `#88919d` (outline)

### Dimensões
- **Largura expandido**: 288px (18rem / w-72)
- **Largura colapsado (rail)**: 48px (3rem)
- **Padding lateral**: 16px (1rem)
- **Padding vertical do header**: 24px (py-6)
- **Padding vertical do footer**: 16px (p-4)
- **Gap entre grupos**: 24px (space-y-6)
- **Gap entre itens**: 4px (space-y-1)
- **Altura do item de menu**: ~40px (py-2.5)
- **Padding interno do item**: px-3 py-2.5
- **Gap entre ícone e texto**: 12px (gap-3)
- **Raio de borda dos itens**: 8px (rounded-lg)
- **Raio de borda da logo**: 8px (rounded-lg)
- **Raio de borda do avatar**: 8px (rounded-lg)
- **Indentação de submenu**: 36px (pl-9)

### Sombras
- **Logo**: `shadow-lg shadow-primary-container/20` (glow sutil Azure)
- **Footer**: `bg-surface-container-lowest/50` (transparência para sobreposição)

---

## 2. Estrutura de Layout

### Top → Bottom

```
[ HEADER ]
  Logo (ícone) + "EventFlow" + "Logistics Manager"
  ────────────────────────────────────

[ NAV - área scrollável ]

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

[ FOOTER ]
  ────────────────────────────────────
  [ Avatar + Nome + Email + Ícone Logout ]
```

---

## 3. Componentes de UI

### 3.1 Header
```
<Container com px-6 py-6 flex items-center gap-3 shrink-0>
  <div 
    h-10 w-10 
    rounded-lg 
    bg-primary-container 
    flex items-center justify-center
    shadow-lg shadow-primary-container/20
  >
    <Package h-5 w-5 text-on-primary-container />
  </div>
  <div overflow-hidden whitespace-nowrap>
    <h1 
      font-headline-md 
      text-headline-md 
      text-primary 
      leading-none
    >
      EventFlow
    </h1>
    <p 
      font-label-sm 
      text-label-sm 
      text-on-surface-variant 
      mt-1
    >
      Logistics Manager
    </p>
  </div>
</Container>
```

### 3.2 Grupo de Menu
```
<Container com space-y-1>
  <Label 
    px-2 pb-2 
    font-label-sm 
    text-label-sm 
    text-outline 
    uppercase 
    tracking-wider
  >
    "OPERAÇÕES"
  </Label>
  {/* itens aqui */}
</Container>
```

### 3.3 Item Simples (não-colapsável)

**Inativo**:
```
<Link href={url}>
  <div 
    flex items-center gap-3 
    px-3 py-2.5 
    rounded-lg 
    text-on-surface-variant 
    hover:bg-surface-variant/30 
    transition-all
  >
    <Icon className="h-4 w-4" />
    <span className="font-body-sm text-body-sm">{título}</span>
  </div>
</Link>
```

**Ativo**:
```
<Link href={url}>
  <div 
    flex items-center gap-3 
    px-3 py-2.5 
    rounded-lg 
    bg-secondary-container 
    text-on-secondary-container 
    font-semibold 
    scale-[0.98]
    transition-all
  >
    <Icon className="h-4 w-4" />
    <span className="font-body-sm text-body-sm">{título}</span>
  </div>
</Link>
```

### 3.4 Submenu Colapsável

**Botão Pai**:
```
<button 
  w-full 
  flex items-center justify-between gap-3 
  px-3 py-2.5 
  rounded-lg 
  text-on-surface-variant 
  hover:bg-surface-variant/30 
  transition-all
  onclick={toggleSubmenu}
>
  <div flex items-center gap-3>
    <Icon className="h-4 w-4" />
    <span className="font-body-sm text-body-sm">{título}</span>
  </div>
  <ChevronDown 
    className="h-4 w-4 transition-transform duration-200"
    data-state={isOpen ? "open" : "closed"}
    style={isOpen ? { transform: "rotate(180deg)" } : {}}
  />
</button>
```

**Subitems**:
```
<div 
  className={isOpen ? "max-h-[500px]" : "max-h-0"}
  style={{ 
    overflow: "hidden", 
    transition: "max-height 0.3s ease-out" 
  }}
>
  <div className="pl-9 space-y-1">
    <Link href={url}>
      <div className="block py-2 text-on-surface-variant hover:text-primary transition-colors font-body-sm text-body-sm">
        {título}
      </div>
    </Link>
  </div>
</div>
```

### 3.5 Footer
```
<Container 
  p-4 
  border-t border-surface-border 
  bg-surface-container-lowest/50 
  shrink-0
>
  <div 
    flex items-center justify-between gap-3 
    p-2 
    rounded-xl 
    hover:bg-surface-variant/30 
    transition-colors 
    cursor-pointer
  >
    <div flex items-center gap-3 overflow-hidden>
      <Avatar 
        h-9 w-9 
        rounded-lg 
        object-cover 
        ring-2 ring-surface-border 
      />
      <div overflow-hidden>
        <p className="font-label-md text-label-md text-on-surface truncate">
          {user.name}
        </p>
        <p className="font-label-sm text-label-sm text-outline truncate">
          {user.email}
        </p>
      </div>
    </div>
    <LogOut 
      className="text-outline hover:text-status-error transition-colors"
      onClick={logout}
    />
  </div>
</Container>
```

---

## 4. Ícones (Lucide React)

Não usar emojis. Ícones devem ser `h-4 w-4` (16px) para itens principais e subitens.

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
- Destaque visual: fundo `bg-secondary-container` (#314863), texto `text-on-secondary-container` (#9fb7d6), font-semibold, scale-[0.98]
- Subitens também marcam `isActive` individualmente
- Se um subitem estiver ativo, o pai não precisa estar ativo (apenas o subitem)
- Item inativo: texto `text-on-surface-variant` (#bec7d4), hover `hover:bg-surface-variant/30`

### 6.3 Colapso/Expansão
- **Submenus**: colapsáveis individualmente via clique no botão pai
- **Seta**: gira 180° ao abrir (transition-transform duration-200)
- **Padrão**: todos os submenus começam **abertos** (`defaultOpen={true}`)
- **Animação**: max-height 0 → 500px com transition 0.3s ease-out

### 6.4 Scroll
- Sidebar deve scrollar verticalmente se o conteúdo exceder a altura da viewport
- Header fica fixo no topo
- Footer fica fixo no bottom
- Conteúdo do meio scrolla entre header e footer
- **Scrollbar customizada**:
  - Largura: 4px
  - Track: transparente
  - Thumb: `#1e293b` (surface-border) com border-radius 10px

### 6.5 Hover
- Itens inativos: `hover:bg-surface-variant/30` (sutil)
- Footer: `hover:bg-surface-variant/30` no container do usuário
- Botão logout: `hover:text-status-error` (vermelho)
- **NÃO** aplicar `hover:bg-*` ou `hover-elevate` manualmente em `SidebarMenuButton`

---

## 7. Responsividade

| Breakpoint | Comportamento |
|------------|---------------|
| Desktop (>1024px) | Sidebar expandido (288px), ícones + texto visíveis |
| Tablet (<1024px) | Sidebar colapsa para **rail** (48px), apenas ícones visíveis |
| Mobile (<768px) | Sidebar oculto, abre via `SidebarTrigger` (overlay/sheet) |

### Configuração de largura
```tsx
<SidebarProvider
  style={{
    "--sidebar-width": "18rem",     // 288px
    "--sidebar-width-icon": "3rem",   // 48px
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
    <aside 
      className="bg-surface-container-low border-r border-surface-border w-72 flex flex-col shrink-0 transition-all duration-300 z-50"
    >
      {/* Header */}
      <div className="px-6 py-6 flex items-center gap-3 shrink-0">
        <div className="h-10 w-10 bg-primary-container rounded-lg flex items-center justify-center shadow-lg shadow-primary-container/20">
          <Package className="h-5 w-5 text-on-primary-container" />
        </div>
        <div className="overflow-hidden whitespace-nowrap">
          <h1 className="font-headline-md text-headline-md text-primary leading-none">
            EventFlow
          </h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
            Logistics Manager
          </p>
        </div>
      </div>

      {/* Navigation - scrollable */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll px-4 space-y-6 pb-6">
        {/* Grupos */}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-surface-border bg-surface-container-lowest/50 shrink-0">
        {/* Usuário + logout */}
      </div>
    </aside>
  );
}
```

### CSS da Scrollbar
```css
.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}
.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-scroll::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 10px;
}
```

### Integração com App.tsx
```tsx
<SidebarProvider
  style={{
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties}
>
  <div className="flex h-screen w-full">
    <AppSidebar />
    <div className="flex flex-col flex-1">
      <header className="h-16 flex items-center justify-between px-8 border-b border-surface-border bg-surface-container shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <SidebarTrigger 
            className="p-2 -ml-2 rounded-lg hover:bg-surface-variant/50 transition-colors text-on-surface-variant active:scale-95"
          />
          <h2 className="font-headline-md text-headline-md text-primary">
            Dashboard Overview
          </h2>
        </div>
        {/* resto do header */}
      </header>
      <main className="flex-1 overflow-y-auto p-8 space-y-8 bg-background">
        {/* conteúdo */}
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
11. **SEMPRE** use `shrink-0` no header e footer para evitar compressão
12. **SEMPRE** use `overflow-hidden` no container de texto do logo para ellipsis

---

## 10. Checklist de Implementação

- [ ] 4 grupos com labels corretos (Operações, Catálogo, Relatórios, Configuração)
- [ ] Header com logo (Package) + "EventFlow" + "Logistics Manager"
- [ ] Fundo do header: transparente (mesmo que sidebar)
- [ ] Footer com avatar + nome + email + ícone Logout
- [ ] Fundo do footer: `bg-surface-container-lowest/50`
- [ ] 7 submenus colapsáveis (Estoque, Aprovações, Viagens, Eventos, Produtos, Configuração, Tipos de Movimentação)
- [ ] Seta ChevronDown gira 180° ao abrir com transition 200ms
- [ ] Animação de submenu: max-height 0 → 500px, 0.3s ease-out
- [ ] Itens admin-only filtrados
- [ ] "Movimentações" em Aprovações oculto para não-Admin/Supervisor
- [ ] "Tipos de Movimentação" visível apenas para Admin
- [ ] Item ativo com destaque visual (bg-secondary-container, text-on-secondary-container, font-semibold, scale-[0.98])
- [ ] Item inativo com hover (hover:bg-surface-variant/30)
- [ ] Scrollbar customizada (4px, thumb #1e293b)
- [ ] data-testid em todos os links interativos
- [ ] npm run check passando
- [ ] npm run build passando

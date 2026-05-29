# Design System do EventFlow Logistics — Precision Logistics

Documento de referência para todos os padrões visuais, componentes e tokens de design usados no projeto. Este design system segue a filosofia **Dark Mode First** inspirada em sistemas de missão crítica de logística, com cores profundas de navy, azul Azure como primário, e tipografia Inter otimizada para legibilidade em telas de monitoramento.

---

## 1. Tokens de Design

### 1.1 Cores (CSS Variables)

As cores são definidas em `client/src/index.css` usando HSL (sem wrapper `hsl()`):

```css
/* LIGHT MODE */
--background: 210 20% 96%;            /* Cinza claro, fundo principal */
--foreground: 210 40% 12%;          /* Texto principal, quase preto */
--border: 210 15% 82%;               /* Bordas padrão */
--card: 0 0% 100%;                   /* Branco puro */
--card-foreground: 210 40% 12%;      /* Texto em cards */
--card-border: 210 15% 85%;          /* Borda de cards */
--popover: 0 0% 100%;                /* Branco */
--popover-foreground: 210 40% 12%;
--popover-border: 210 15% 85%;
--primary: 206 100% 50%;             /* Azure (#00A3FF) */
--primary-foreground: 0 0% 100%;     /* Branco sobre Azure */
--secondary: 210 20% 90%;            /* Cinza claro */
--secondary-foreground: 210 40% 12%;
--muted: 210 15% 92%;                /* Cinza claro */
--muted-foreground: 210 10% 45%;      /* Texto secundário */
--accent: 197 100% 68%;             /* Cyan claro (#89CEFF) */
--accent-foreground: 210 40% 12%;
--destructive: 0 72% 51%;           /* Ruby Red (#EF4444) */
--destructive-foreground: 0 0% 98%;
--input: 210 15% 78%;                /* Input borders */
--ring: 206 100% 50%;                /* Focus ring */

/* Sidebar */
--sidebar: 210 40% 12%;                /* Dark navy */
--sidebar-foreground: 210 20% 96%;     /* Branco claro */
--sidebar-border: 210 20% 22%;
--sidebar-primary: 206 100% 50%;     /* Azure */
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 210 30% 22%;
--sidebar-accent-foreground: 210 20% 96%;
--sidebar-ring: 206 100% 50%;

/* Charts */
--chart-1: 206 100% 50%;   /* Azure */
--chart-2: 197 100% 68%;   /* Cyan */
--chart-3: 330 81% 60%;    /* Rosa */
--chart-4: 160 84% 39%;    /* Emerald */
--chart-5: 38 92% 50%;     /* Amber */
```

### 1.2 Dark Mode (Precision Logistics)

```css
.dark {
  --background: 210 71% 7%;              /* Deep Navy (#0A1929) */
  --foreground: 213 67% 91%;             /* Texto claro (#D5E4FA) */
  --border: 210 20% 18%;                 /* Slate (#1E293B) */
  --card: 210 36% 12%;                   /* Slate Blue (#102A43) */
  --card-foreground: 213 67% 91%;
  --card-border: 210 20% 18%;            /* Slate */
  --popover: 210 36% 12%;
  --popover-foreground: 213 67% 91%;
  --popover-border: 210 20% 18%;
  --primary: 206 100% 50%;               /* Azure (#00A3FF) */
  --primary-foreground: 210 100% 17%;      /* Dark navy sobre Azure */
  --secondary: 210 30% 18%;              /* Navy médio */
  --secondary-foreground: 213 67% 91%;
  --muted: 210 30% 15%;                  /* Deep navy */
  --muted-foreground: 210 15% 55%;        /* Texto cinza */
  --accent: 197 100% 68%;                /* Cyan (#89CEFF) */
  --accent-foreground: 210 100% 17%;
  --destructive: 0 72% 51%;              /* Ruby Red (#EF4444) */
  --destructive-foreground: 0 0% 98%;
  --input: 210 20% 22%;                  /* Input border */
  --ring: 206 100% 50%;                  /* Azure ring */
}
```

### 1.3 Tipografia

```css
--font-sans: Inter, system-ui, sans-serif;
--font-serif: Georgia, serif;
--font-mono: Menlo, monospace;
```

**Hierarquia de títulos:**
- H1 (PageHeader): `text-xl font-semibold tracking-tight`
- H2 (PageSection): `text-lg font-semibold`
- H3 (Card title): `text-base font-semibold`
- Body: `text-sm` (padrão)
- Caption/Label: `text-xs font-medium` (Medium 500 para labels)
- Muted: `text-xs text-muted-foreground`
- Data labels: uppercase quando apropriado para diferenciar metadados

### 1.4 Bordas

```css
--radius: .5rem;  /* 8px - padrão */
lg: 1rem;         /* 16px - large containers */
md: 0.75rem;      /* 12px - medium */
sm: 0.5rem;       /* 8px - small */
xl: 1.5rem;       /* 24px - pill badges */
```

### 1.5 Espaçamento

- Container principal: `mx-auto px-6 py-6 max-w-7xl` (no App.tsx)
- Espaçamento vertical entre seções: `space-y-6`
- Padding interno de cards: `p-4` (nunca `p-6`)
- Gap entre metadados: `gap-x-4 gap-y-1`
- Gap entre botões: `gap-2`
- Gap em filtros: `gap-3`
- Base unit: 8px (4px sub-grid para ícones e labels)

### 1.6 Sombras

```css
/* Dark mode - shadows com fundo navy */
--shadow-2xs: 0px 2px 0px 0px hsl(210 71% 5% / 0.30);
--shadow-xs: 0px 1px 2px 0px hsl(210 71% 5% / 0.40);
--shadow-sm: 0px 1px 3px 0px hsl(210 71% 5% / 0.50), 0px 1px 2px -1px hsl(210 71% 5% / 0.50);
--shadow: 0px 1px 3px 0px hsl(210 71% 5% / 0.50), 0px 1px 2px -1px hsl(210 71% 5% / 0.50);
--shadow-md: 0px 4px 6px -1px hsl(210 71% 5% / 0.50), 0px 2px 4px -2px hsl(210 71% 5% / 0.50);
--shadow-lg: 0px 10px 15px -3px hsl(210 71% 5% / 0.50), 0px 4px 6px -4px hsl(210 71% 5% / 0.50);
--shadow-xl: 0px 20px 25px -5px hsl(210 71% 5% / 0.50), 0px 8px 10px -6px hsl(210 71% 5% / 0.50);
--shadow-2xl: 0px 25px 50px -12px hsl(210 71% 5% / 0.60);
```

### 1.7 Cores Semânticas

| Status | Cor | Hex | Uso |
|--------|-----|-----|-----|
| Success | Emerald | #10B981 | Envios ativos, entregas no prazo |
| Warning | Amber | #F59E0B | Atrasos, aprovações pendentes |
| Error | Ruby | #EF4444 | Falhas críticas, obstruções |
| Primary | Azure | #00A3FF | Ações principais, caminho crítico |
| Info | Cyan | #89CEFF | Destaques, acentos |

---

## 2. Brand & Style

O design system é projetado para **logística de alta performance** e **gestão de cadeia de suprimentos**. Evoca confiabilidade, velocidade e precisão data-driven. A estética é **Corporate / Modern**, com filosofia **Dark Mode First** para reduzir fadiga ocular de operadores que monitoram dashboards em turnos longos.

**Visual Language:** Prioriza utilidade e densidade sem sacrificar clareza. Dados complexos — desde rastreamento de frota em tempo real até métricas de inventário — são instantaneamente digeríveis. O ambiente profissional transmite robustez, segurança e avanço tecnológico.

---

## 2. Componentes Base

### 2.1 PageHeader

```tsx
import { PageHeader } from "@/components";

<PageHeader title="Título" description="Descrição opcional">
  {/* Ações alinhadas à direita */}
  <Button>...</Button>
</PageHeader>
```

**Implementação:**
```tsx
<div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-border/40">
  <div className="flex-1 min-w-0">
    <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
  </div>
  <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
</div>
```

### 2.2 PageSection

```tsx
import { PageSection } from "@/components";

<PageSection title="Título" description="Descrição">
  {/* Conteúdo */}
</PageSection>
```

**Implementação:**
```tsx
<div className="space-y-4">
  <div>
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
  <div>{children}</div>
</div>
```

### 2.3 FilterBar

```tsx
import { FilterBar } from "@/components";

// Conta filtros ativos
const activeFiltersCount = useMemo(() => {
  let count = 0;
  if (statusFilter !== "all") count++;
  if (eventFilter !== "all") count++;
  return count;
}, [statusFilter, eventFilter]);

const clearFilters = () => {
  setStatusFilter("all");
  setEventFilter("all");
};

<FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearFilters : undefined}>
  <div className="space-y-1.5">
    <label className="text-xs text-muted-foreground">Label</label>
    <Select>...</Select>
  </div>
</FilterBar>
```

**Implementação:**
```tsx
<Collapsible className="w-full">
  <div className="flex items-center justify-between gap-2 mb-2">
    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
      <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
        <Filter className="h-3.5 w-3.5 text-primary/70" />
      </div>
      <span>Filtros</span>
      {badgeCount > 0 && <Badge variant="secondary" className="text-xs">{badgeCount} ativo(s)</Badge>}
    </div>
    <div className="flex items-center gap-1">
      {onClear && badgeCount > 0 && (
        <Button variant="ghost" size="sm">
          <X className="h-4 w-4 mr-1" /> Limpar
        </Button>
      )}
      <CollapsibleTrigger>
        <ChevronDown className="h-4 w-4" />
      </CollapsibleTrigger>
    </div>
  </div>
  <CollapsibleContent>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4 bg-muted/40 rounded-lg border border-border/60">
      {children}
    </div>
  </CollapsibleContent>
</Collapsible>
```

### 2.4 EmptyState

```tsx
import { EmptyState } from "@/components";
import { Truck } from "lucide-react";

<EmptyState
  icon={Truck}
  title="Nenhuma movimentação"
  description="Crie uma nova movimentação para começar"
  action={{ label: "Nova Movimentação", onClick: () => {} }}
/>
```

**Implementação:**
```tsx
<div className="flex flex-col items-center justify-center text-center py-16">
  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
    <Icon className="h-7 w-7 text-primary/60" />
  </div>
  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
  <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">{description}</p>
  {action && <Button className="mt-6">{action.label}</Button>}
</div>
```

### 2.5 PageLoading

```tsx
import { PageLoading } from "@/components";

<PageLoading message="Carregando dados..." />
```

**Implementação:**
```tsx
<div className="flex flex-col items-center justify-center min-h-[30vh] p-8">
  <Loader2 className="h-8 w-8 animate-spin text-primary" />
  <p className="mt-4 text-sm text-muted-foreground">{message}</p>
</div>
```

### 2.6 StatusBadge

```tsx
import { StatusBadge } from "@/components";

<StatusBadge status="in_progress" />
```

**Implementação:**
```tsx
<Badge className="text-xs font-medium">
  {/* Label mapeado por status: draft, pending, approved, in_progress, completed, etc. */}
</Badge>
```

**Status mapeados:**
- `draft` → cinza "Rascunho"
- `pending_approval` → laranja "Pendente Aprovação"
- `approved` → verde "Aprovado"
- `in_progress` → ciano "Em Andamento"
- `completed` → verde "Concluído"
- `cancelled` → vermelho "Cancelado"
- `rejected` → vermelho "Rejeitado"
- `created` → cinza "Criado"
- `paused` → laranja "Pausado"
- `ready` → verde "Pronta"
- `active` → verde "Ativo"
- `inactive` → cinza "Inativo"
- `return_ok` → verde "OK"
- `return_damaged` → laranja "Com Avaria"
- `return_lost` → vermelho "Com Perda"

### 2.7 ErrorState

```tsx
import { ErrorState } from "@/components";

<ErrorState
  title="Erro ao carregar"
  description="Não foi possível carregar os dados"
  action={{ label: "Tentar novamente", onClick: refetch }}
/>
```

### 2.8 DataCard

```tsx
import { DataCard } from "@/components";

<DataCard
  title="Card Title"
  icon={Truck}
  badge={{ label: "Ativo", variant: "default" }}
  meta={[
    { label: "Campo", value: "Valor" },
    { label: "Campo", value: "Valor" },
  ]}
>
  {/* Conteúdo extra */}
</DataCard>
```

### 2.9 ActionBar

```tsx
import { ActionBar } from "@/components";

<ActionBar>
  <Button>...</Button>
  <Button variant="outline">...</Button>
</ActionBar>
```

### 2.10 PermissionHint

```tsx
import { PermissionHint } from "@/components";

<PermissionHint message="Ação não disponível" />
```

---

## 3. Padrões de Layout

### 3.1 Estrutura de Página

```tsx
<div className="space-y-6">
  <PageHeader title="..." description="...">
    <Button>...</Button>
  </PageHeader>

  <FilterBar badgeCount={...} onClear={...}>
    {/* Filtros */}
  </FilterBar>

  {/* Conteúdo */}
</div>
```

### 3.2 Cards de Lista (Padrão Principal)

```tsx
<Card className="hover-elevate border-border/60" data-testid={`card-${item.id}`}>
  <CardContent className="p-4">
    {/* Header: status + título + ações */}
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={item.status} />
          <span className="text-xs text-muted-foreground font-mono">{item.id}</span>
        </div>
        <h3 className="font-semibold text-base text-foreground">{item.name}</h3>
        {item.type && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.type}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Botões de ação */}
        <Button size="sm" variant="ghost">...</Button>
        <Button size="sm">...</Button>
      </div>
    </div>

    {/* Metadados */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40">
      <div className="text-xs">
        <span className="text-muted-foreground">Label:</span>{" "}
        <span className="text-foreground font-medium">Valor</span>
      </div>
    </div>

    {/* Eventos/Badges extras */}
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      <span className="text-xs text-muted-foreground">Tags:</span>
      <Badge variant="outline" className="text-xs font-normal">Tag</Badge>
    </div>
  </CardContent>
</Card>
```

### 3.3 Tabelas

```tsx
<div className="border rounded-lg overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead data-testid="header-xxx">Coluna</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map(item => (
        <TableRow key={item.id} data-testid={`row-${item.id}`}>
          <TableCell data-testid={`text-xxx-${item.id}`}>Valor</TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <Button size="sm">...</Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### 3.4 Cards de Info (Detail Pages)

```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <Card>
    <CardContent className="p-4">
      <p className="text-sm text-muted-foreground">Label</p>
      <div className="mt-1">
        <StatusBadge status={...} />
      </div>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="p-4">
      <p className="text-sm text-muted-foreground">Label</p>
      <p className="text-lg font-semibold">Valor</p>
    </CardContent>
  </Card>
</div>
```

---

## 4. Padrões de Botões

### 4.1 Tamanhos

| Variante | Uso |
|----------|-----|
| `default` | Botões primários no header |
| `sm` | Botões dentro de cards de lista (ações inline) |
| `icon` | Botões de ícone único (voltar, editar, etc.) |

### 4.2 Variantes

| Variante | Uso |
|----------|-----|
| `default` | Ação primária (criar, iniciar, aprovar) |
| `outline` | Ação secundária (pausar, editar, voltar) |
| `ghost` | Ação terciária (ícone de editar, visualizar) |
| `destructive` | Ação destrutiva (excluir, rejeitar) |

### 4.3 Regras

- NUNCA adicione `hover:bg-*` ou `hover-elevate` em `<Button>` (já tem internamente)
- Botões de ícone: sempre `size="icon"`, nunca `h-6 w-6` ou `size="sm" className="w-8"`
- Botões lado a lado: `gap-2`
- Botões em header: `default` ou `outline` (altura natural)
- Botões em cards de lista: `size="sm"`

### 4.4 Ícones em Botões

```tsx
<Button>
  <Plus className="h-4 w-4 mr-2" /> Nova Movimentação
</Button>

<Button size="icon" variant="ghost">
  <Edit className="h-3.5 w-3.5" />
</Button>
```

---

## 5. Padrões de Badges

### 5.1 StatusBadge
Sempre usar `StatusBadge` component (nunca criar Badge manual com cores hardcoded).

### 5.2 Eventos/Tags
```tsx
<div className="flex items-center gap-2 mt-3 flex-wrap">
  <span className="text-xs text-muted-foreground">Eventos:</span>
  {events.map(event => (
    <Badge key={event.id} variant="outline" className="text-xs font-normal">
      {event.name}
    </Badge>
  ))}
</div>
```

### 5.3 Badges de Info
```tsx
<Badge variant="secondary" className="text-xs">{count} ativo(s)</Badge>
```

---

## 6. Padrões de Ícones

### 6.1 Ícones de Lucide
Importar ícones de `lucide-react`. Ícones comuns:
- `Plus` (criar)
- `Edit` (editar)
- `Trash2` (excluir)
- `ArrowLeft` / `ArrowRight` (navegar)
- `Eye` (visualizar)
- `CheckCircle2` (aprovar/finalizar)
- `XCircle` (rejeitar/cancelar)
- `PlayCircle` / `PauseCircle` (iniciar/pausar)
- `Truck` (movimentações)
- `Package` (loading orders)
- `ClipboardList` (requisições)
- `Calendar` (eventos)
- `FileText` (documentos)
- `Filter` (filtros)
- `Search` (busca)
- `Loader2` (loading spinner)
- `Inbox` (empty state default)
- `AlertTriangle` (erros)
- `ShieldAlert` (permissão negada)
- `Clock` (tempo)
- `User` (usuário)

### 6.2 Tamanhos de Ícones

| Contexto | Tamanho |
|----------|---------|
| PageHeader | `h-5 w-5` |
| Botão com texto | `h-4 w-4` |
| Botão `size="sm"` | `h-3.5 w-3.5` |
| Botão `size="icon"` | `h-4 w-4` |
| Empty state | `h-7 w-7` |
| FilterBar | `h-3.5 w-3.5` |
| Status/Info | `h-5 w-5` |

### 6.3 Ícones em Ícones Containers
```tsx
<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
  <Package className="h-4 w-4 text-primary/70" />
</div>
```

---

## 7. Padrões de Responsividade

### 7.1 Grids
```tsx
{/* Cards de lista: 2 colunas em mobile, 4 em desktop */}
<div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">

{/* Info cards: 1 coluna mobile, 4 desktop */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">

{/* Filtros: 1 mobile, 2 tablet, 3 desktop, 4 wide */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
```

### 7.2 Tabelas
```tsx
<div className="border rounded-lg overflow-hidden">
  <Table>
    {/* Scroll horizontal automático */}
  </Table>
</div>
```

### 7.3 Flex Wrap
```tsx
<div className="flex items-center gap-2 flex-wrap">
  {/* Botões que quebram linha em mobile */}
</div>
```

---

## 8. Padrões de Loading/Empty/Error

### 8.1 Estados

| Estado | Componente | Uso |
|--------|------------|-----|
| Loading | `PageLoading` | Tela carregando dados |
| Empty (lista) | `EmptyState` | Lista vazia |
| Error | `ErrorState` | Erro de API |
| Not Found | `EmptyState` | Registro não encontrado |
| Access Denied | `PermissionHint` | Sem permissão |

### 8.2 Loading Condicional
```tsx
if (isLoading) {
  return (
    <div className="space-y-6">
      <PageHeader title="..." description="..." />
      <PageLoading message="Carregando..." />
    </div>
  );
}

if (!data) {
  return (
    <div className="space-y-6">
      <PageHeader title="..." description="..." />
      <EmptyState
        icon={Icon}
        title="Não encontrado"
        description="..."
        action={{ label: "Voltar", onClick: () => navigate("/") }}
      />
    </div>
  );
}
```

---

## 9. Padrões de Formulários

### 9.1 Labels
```tsx
<div className="space-y-1.5">
  <label className="text-xs text-muted-foreground">Label</label>
  <Input className="h-8 text-sm" />
</div>
```

### 9.2 Selects
```tsx
<div className="space-y-1.5">
  <Label htmlFor="filter-xxx" className="text-xs text-muted-foreground">Label</Label>
  <Select>
    <SelectTrigger id="filter-xxx" className="h-8 text-sm">
      <SelectValue placeholder="Placeholder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos</SelectItem>
    </SelectContent>
  </Select>
</div>
```

---

## 10. Padrões de Divider

### 10.1 Divider em Cards
```tsx
<div className="mt-3 pt-3 border-t border-border/40">
  {/* Metadados */}
</div>
```

### 10.2 Divider de Seção
```tsx
<div className="pb-4 border-b border-border/40">
  {/* Header */}
</div>
```

---

## 11. Padrões de Hover/Interações

### 11.1 Cards Clicáveis
```tsx
<Card className="hover-elevate cursor-pointer" onClick={...}>
```

### 11.2 Regras de Elevação
- `hover-elevate` → usado em cards, list items, elementos não-botão
- `active-elevate-2` → usado para press-down em elementos customizados
- NUNCA em `<Button>` ou `<Badge>` (já têm internamente)
- NUNCA com `overflow-hidden` ou `overflow-scroll`

### 11.3 Toggle
```tsx
<Button className="toggle-elevate toggle-elevated">
```

---

## 12. Padrões de Texto

### 12.1 Hierarquia de Cores
```
Default:    text-foreground        (maioria do texto)
Secondary:  text-muted-foreground  (labels, descrições)
Tertiary:   text-xs text-muted-foreground (metadados, captions)
```

### 12.2 Fonte Mono
```tsx
<span className="text-xs text-muted-foreground font-mono">{id}</span>
```

---

## 13. Checklist de Revisão Visual

Antes de finalizar qualquer tela, verifique:

- [ ] `PageHeader` com título + descrição + slot de ações
- [ ] `FilterBar` com `badgeCount` + `onClear` (se houver filtros)
- [ ] `PageLoading` para estado de loading (nunca texto simples)
- [ ] `EmptyState` para listas vazias (nunca texto simples)
- [ ] Cards de lista com `p-4` (nunca `p-6`)
- [ ] Título de card: `font-semibold text-base` (nunca `text-2xl`)
- [ ] Metadados com `border-t border-border/40` antes
- [ ] `StatusBadge` para status (nunca Badge manual)
- [ ] Botões de ação com `size="sm"` em cards de lista
- [ ] Ícones com tamanho correto (`h-4 w-4` em botões, `h-3.5 w-3.5` em `size="sm"`)
- [ ] `data-testid` em todos os elementos interativos
- [ ] `hover-elevate` em cards clicáveis
- [ ] Nenhum `hover:bg-*` em `<Button>` ou `<Badge>`
- [ ] `npm run check` zerado
- [ ] `npm run build` passando

---

## 14. Exemplo Completo de Página

```tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Truck } from "lucide-react";
import { PageHeader, PageLoading, EmptyState, FilterBar, StatusBadge } from "@/components";
import type { SomeItem } from "@shared/schema";

export default function ExamplePage() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: items, isLoading } = useQuery<SomeItem[]>({
    queryKey: ["/api/items"],
  });

  const activeFiltersCount = useMemo(() => {
    return statusFilter !== "all" ? 1 : 0;
  }, [statusFilter]);

  const clearFilters = () => setStatusFilter("all");

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item =>
      statusFilter === "all" || item.status === statusFilter
    );
  }, [items, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Título" description="Descrição" />
        <PageLoading message="Carregando..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Título" description="Descrição">
        <Button data-testid="button-create">
          <Plus className="h-4 w-4 mr-2" /> Criar
        </Button>
      </PageHeader>

      <FilterBar badgeCount={activeFiltersCount} onClear={activeFiltersCount > 0 ? clearFilters : undefined}>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Status</label>
          {/* Select */}
        </div>
      </FilterBar>

      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Nenhum item"
            description="Crie um item para começar"
          />
        ) : (
          filteredItems.map(item => (
            <Card key={item.id} className="hover-elevate border-border/60" data-testid={`card-${item.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={item.status} />
                      <span className="text-xs text-muted-foreground font-mono">{item.id}</span>
                    </div>
                    <h3 className="font-semibold text-base text-foreground">{item.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="ghost" data-testid={`button-edit-${item.id}`}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Campo:</span>{" "}
                    <span className="text-foreground font-medium">{item.value}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
```

---

*Documento gerado em 2026-05-29. Atualizado conforme Fase 3.2.4.*

# Especificação de Layout — Ordens de Carregamento

## Visão Geral

Telas: **Lista**, **Detalhes**, **Modal Criar/Editar**.
Estilo: Design System EventFlow (dark-mode-first, Precision Logistics).
Base visual: Deep Navy (#0A1929), Slate Blue (#102A43), Azure (#00A3FF).

---

## Parte 1 — Lista de Ordens (`/loading-orders`)

### Estrutura da Página
```
┌─────────────────────────────────────────────────────────────┐
│  [PageHeader]                                               │
│  Título: "Ordens de Carregamento"                           │
│  Descrição: "Gerencie listas consolidadas..."              │
│  [Nova Ordem] (slot direito, apenas se canWrite)          │
├─────────────────────────────────────────────────────────────┤
│  [StatsBar] — 5 cards em grid                               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │
│  │Total│ │Draft│ │Ready│ │InPrg│ │Done│                  │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                  │
├─────────────────────────────────────────────────────────────┤
│  [FilterBar] — 2 filtros + badgeCount + limpar             │
│  [Status ▼] [Evento ▼]              [🔄 Limpar]            │
├─────────────────────────────────────────────────────────────┤
│  [Lista de Cards] — um card por ordem                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [StatusBadge] [orderNumber]          [✏️] [👁️]    │   │
│  │ LO-2026-001                                          │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Evento: Festival de Verão  |  Início: 15/06 08:00  │   │
│  │ Criado por: João      |  Fim: 20/06 18:00         │   │
│  │ Início Real: 15/06 09:00  (se existir)            │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Observações: ...(se existir)                       │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  [EmptyState] — quando não há ordens                       │
│  📦 "Nenhuma ordem de carregamento"                       │
│  "Crie uma ordem consolidando requisições aprovadas"      │
│  [Nova Ordem]                                             │
└─────────────────────────────────────────────────────────────┘
```

### PageHeader
- **Container**: `flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-border/40`
- **Título**: `text-xl font-semibold tracking-tight text-foreground`
- **Descrição**: `text-sm text-muted-foreground mt-1`
- **Slot de ações**: `flex items-center gap-2 flex-shrink-0`
- **Botão "Nova Ordem"**: `Button` default, ícone `<Plus className="h-4 w-4 mr-2" />`, só aparece se `userCanWriteLogistics`

### StatsBar
- **Container**: `grid grid-cols-2 sm:grid-cols-5 gap-2`
- **Cada card**: `flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card border-border/60 hover-elevate`
- **Ícone**: container `h-8 w-8 rounded-md bg-{color}/10` com ícone `h-4 w-4`
- **Número**: `text-lg font-semibold leading-none text-foreground`
- **Label**: `text-xs text-muted-foreground mt-0.5`
- **Cores por card**:
  - Total: `bg-primary/10 text-primary` + ícone `ClipboardList`
  - Rascunhos: `bg-muted-foreground/10 text-muted-foreground` + ícone `CircleDot`
  - Prontas: `bg-chart-4/10 text-chart-4` + ícone `CheckCircle2`
  - Em Andamento: `bg-chart-5/10 text-chart-5` + ícone `Truck`
  - Finalizadas: `bg-chart-4/10 text-chart-4` + ícone `Clock`

### FilterBar
- **Container**: componente `FilterBar` com `badgeCount` e `onClear`
- **Campos**: grid responsivo (1 col mobile, 2 col desktop)
- **Label**: `text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1`
- **SelectTrigger**: `h-10 bg-card border-border/60 rounded-lg text-sm`
- **Opções de Status**: draft, ready, in_progress, completed, cancelled
- **Opções de Evento**: lista de todos os eventos

### Card de Ordem (Lista)
- **Card**: `hover-elevate border-border/60 cursor-pointer`
- **CardContent**: `p-4`
- **Header**:
  - `flex items-start justify-between gap-3`
  - Esquerda: `StatusBadge` + `orderNumber` (font-mono text-xs) + título `font-semibold text-base`
  - Direita: botões `size="sm" variant="ghost"` — Editar (se canWrite) + Olho (detalhes)
- **Metadata**: `flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40`
  - Cada linha: `text-xs` com label `text-muted-foreground` + valor `text-foreground font-medium`
  - Campos: Evento, Início, Fim, Início Real (se existir), Fim Real (se existir)
- **Observações** (se existir): `mt-2 pt-2 border-t border-border/40` + `text-xs text-muted-foreground`

### EmptyState
- **Sem dados**: ícone `Package`, título "Nenhuma ordem de carregamento", descrição "Crie uma ordem consolidando requisições aprovadas", ação "Nova Ordem" (se canWrite)
- **Com filtros ativos**: descrição "Tente ajustar os filtros para ver mais resultados", ação "Limpar Filtros"

### Responsividade
- Mobile: grid stats vira 2 colunas, filtros empilham, ações do card quebram para baixo
- Tablet: stats 3 colunas, filtros lado a lado
- Desktop: stats 5 colunas, filtros lado a lado

---

## Parte 2 — Detalhes da Ordem (`/loading-orders/:id`)

### Estrutura da Página
```
┌─────────────────────────────────────────────────────────────┐
│  [PageHeader]                                               │
│  Título: "LO-2026-001"                                      │
│  Descrição: "Festival de Verão"                             │
│  [Voltar] [Editar] [Marcar Pronta] [Aprovar] [Desaprovar] │
├─────────────────────────────────────────────────────────────┤
│  [Grid 2 colunas]                                           │
│  ┌─────────────────────────┐ ┌─────────────────────────┐   │
│  │ [Card: Informações]     │ │ [Card: Requisições]     │   │
│  │ Status: [Pronta]        │ │ ┌─ Requisição Cenografia│   │
│  │ Evento: Festival de Verão│ │ │   #a1b2c3d4 [Aprovada] │   │
│  │ Início: 15/06, 08:00   │ │ └─                      │   │
│  │ Fim: 20/06, 18:00      │ │ ┌─ Requisição Iluminação│   │
│  │ Carregamento: ...      │ │ └─                      │   │
│  │ Criado por: João        │ │                         │   │
│  │ Observações: ...        │ │                         │   │
│  └─────────────────────────┘ └─────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  [Card: Itens Consolidados] (largura total)                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Mesa de Som                                        │   │
│  │ SKU: MS-2024-001      ████  15                    │   │
│  │ Separado: 12 | Carregado: 8                       │   │
│  │ Origem: [Cenografia: 10 un] [Iluminação: 5 un]   │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Caixa de Luz                                        │   │
│  │ SKU: CL-2024-002      ████  8                     │   │
│  │ Origem: [Iluminação: 8 un]                        │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  [Card: Progresso de Carregamento] (se houver movimentações)│
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Mesa de Som              12 / 15   80%              │   │
│  │ ████████████░░░░░░░░░░░░░░░░░░░░░                   │   │
│  │                                                     │   │
│  │ Caixa de Luz             8 / 8     100%             │   │
│  │ ██████████████████████████████████ [✓ Completo]    │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  [Card: Movimentações] (se houver)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Carregamento              [Em Andamento]   25 itens │   │
│  │ Veículo: ABC-1234                                   │   │
│  │ 15/06/2026, 14:30                                   │   │
│  │ [Mesa de Som: 12] [Caixa de Luz: 8] +5 mais        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### PageHeader
- **Título**: número da ordem (ex: LO-2026-001)
- **Descrição**: nome do evento
- **ActionBar**: `flex items-center gap-2 flex-wrap`
  - **Voltar**: `Button variant="outline" size="sm"` + ícone `ArrowLeft`
  - **Editar**: `Button variant="outline" size="sm"` + ícone `Edit` (se canWrite)
  - **Marcar como Pronta**: `Button size="sm"` default (se status === "draft" && canMarkReady)
  - **Aprovar para Carga**: `Button size="sm"` default (se status === "ready" && canApprove)
  - **Desaprovar**: `Button variant="outline" size="sm"` (se status === "approved" && canApprove)
  - Estados de loading: texto muda para "Marcando...", "Aprovando...", "Desaprovando..."

### Card: Informações da Ordem
- **Card**: `border-border/60`
- **Título**: `font-semibold text-base flex items-center gap-2 mb-3`
  - Ícone `ClipboardList` (text-muted-foreground)
  - Texto: "Informações da Ordem"
- **Metadados**: `flex flex-wrap gap-x-5 gap-y-2 text-sm`
  - Cada campo: `flex items-center gap-1.5`
  - Label: `text-muted-foreground`
  - Valor: `font-medium`
  - Ícones pequenos (h-3.5 w-3.5 text-muted-foreground) nos campos de data
  - Campos: Status (com StatusBadge), Evento, Início, Fim, Carregamento (se existir), Descarregamento (se existir), Criado por
- **Observações** (se existir): `mt-3 pt-3 border-t border-border/40`
  - Label: `flex items-center gap-1.5 text-sm text-muted-foreground` + ícone `Info`
  - Valor: `text-sm text-foreground`

### Card: Requisições Incluídas
- **Título**: ícone `FileText` + "Requisições Incluídas ({count})"
- **Empty**: `EmptyState compact` com ícone `FileText`, título "Nenhuma requisição", descrição "Nenhuma requisição vinculada"
- **Lista**: `space-y-2`
  - Cada item: `border rounded-lg p-3 hover-elevate cursor-pointer bg-card/50`
  - Layout: `flex items-center justify-between gap-2`
  - Esquerda: área (font-medium text-sm truncate) + ID (font-mono text-xs)
  - Direita: `StatusBadge` da requisição
  - Click: navega para `/requests/:id`

### Card: Itens Consolidados
- **Título**: ícone `Layers` + "Itens Consolidados ({count})"
- **Loading**: `PageLoading compact` com "Carregando itens..."
- **Empty**: `EmptyState compact` com ícone `Package`, título "Nenhum item consolidado"
- **Lista**: `space-y-3`
  - Cada item: `border rounded-lg p-3 hover-elevate bg-card/50`
  - **Header**: `flex items-start justify-between gap-3`
    - Esquerda: nome do produto (font-semibold text-base) + SKU (font-mono text-sm text-muted-foreground)
    - Direita: quantidade (text-xl font-bold) + unidade (text-xs text-muted-foreground)
  - **Operacional** (se picked/loaded existir): `flex flex-wrap gap-3 mt-2 text-sm`
    - Separado: label muted + valor font-medium
    - Carregado: label muted + valor font-medium
  - **Origens** (se existir): `mt-2 pt-2 border-t border-border/40`
    - Label: `text-xs text-muted-foreground mb-1.5`
    - Badges: `flex flex-wrap gap-1.5` com `Badge variant="secondary" className="text-xs font-normal"`
    - Texto: "{area}: {quantity} {unit}"

### Card: Progresso de Carregamento
- **Só aparece se** `productProgress.length > 0`
- **Título**: ícone `Truck` + "Progresso de Carregamento"
- **Lista**: `space-y-3`
  - Cada item: `border rounded-lg p-3 space-y-2 bg-card/50`
  - **Header**: `flex items-start justify-between gap-3`
    - Esquerda: nome do produto (font-medium text-sm) + SKU (font-mono text-xs)
    - Direita: "{loaded} / {expected}" (text-lg font-bold) + percentual (text-xs)
  - **ProgressBar**: `Progress` com `h-1.5`
    - Cores da barra:
      - Excedido: `[&>div]:bg-destructive`
      - Completo: `[&>div]:bg-chart-4`
      - Em andamento: `[&>div]:bg-primary`
  - **Alertas**:
    - Excedido: `flex items-center gap-1 text-sm text-destructive` + ícone `AlertCircle` + "Excedido em X unidades"
    - Completo: `flex items-center gap-1 text-sm text-chart-4` + ícone `CheckCircle` + "Completo"

### Card: Movimentações
- **Só aparece se** `movements.length > 0`
- **Título**: ícone `Truck` + "Movimentações ({count})"
- **Lista**: `space-y-2`
  - Cada item: `border rounded-lg p-3 hover-elevate cursor-pointer bg-card/50`
  - **Header**: `flex items-start justify-between gap-3`
    - Esquerda:
      - Tipo + StatusBadge (flex gap-2)
      - Veículo (se existir, text-sm text-muted-foreground)
      - Data (text-xs text-muted-foreground)
    - Direita: total de itens (text-lg font-bold) + label "itens" (text-xs)
  - **Preview de itens** (se existir): `mt-2 pt-2 border-t border-border/40`
    - `flex flex-wrap gap-1`
    - Badges: `Badge variant="secondary" className="text-xs font-normal"`
    - Primeiros 3 itens + "+X mais" se houver mais

---

## Parte 3 — Modal Criar/Editar Ordem

### Estrutura do Dialog
```
┌─────────────────────────────────────────────────────────────┐
│  [DialogHeader] — border-b border-border/40 p-6 pb-4       │
│  Título: "Nova Ordem de Carregamento"                       │
│  Descrição: "Crie uma ordem consolidando requisições..."  │
├─────────────────────────────────────────────────────────────┤
│  [Content] — p-6 pt-4                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Alerta (se ordem não editável)                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Linha 1: Evento *          | Número da Ordem *     │   │
│  │ [Select ▼]                 | [Input LO-2026-001]   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Linha 2: Início Planejado * | Fim Planejado *      │   │
│  │ [📅 datetime-local]        | [📅 datetime-local]   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Linha 3: Criado por *                               │   │
│  │ [Input Nome do responsável]                         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Linha 4: Observações                                │   │
│  │ [Textarea 3 linhas]                                │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ [Seleção de Requisições] (apenas criação)           │   │
│  │ ┌─ [✓] Requisição Cenografia  #a1b2c3d4          │   │
│  │ ├─ [✓] Requisição Iluminação  #b2c3d4e5          │   │
│  │ └─ [ ] Requisição Som          #c3d4e5f6          │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ [Seleção de Viagens] (se disponíveis)              │   │
│  │ ┌─ [✓] Viagem Centro → Zona Sul  #d4e5f6a7         │   │
│  │ └─ [ ] Viagem Zona Norte → Centro #e5f6a7b8      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  [DialogFooter] — p-6 pt-4 border-t bg-muted/30            │
│  [Cancelar]              [🔄 Salvando...] / [Criar Ordem]   │
└─────────────────────────────────────────────────────────────┘
```

### DialogHeader
- **Container**: `p-6 pb-4 border-b border-border/40`
- **Título**: `text-lg font-semibold`
- **Descrição**: `text-sm text-muted-foreground`

### DialogContent
- **Container**: `max-w-3xl max-h-[90vh] overflow-y-auto p-0`
- **Padding interno**: `p-6 pt-4`

### Alerta de não editável
- **Container**: `Alert variant="destructive" className="mb-4"`
- **Ícone**: `AlertTriangle className="h-4 w-4"`
- **Descrição**: texto da razão + lista de movimentações ativas (se existir)

### Campos do Formulário
- **Grid**: `grid grid-cols-1 sm:grid-cols-2 gap-4` para campos lado a lado
- **Label**: `text-sm font-medium` + asterisco vermelho para obrigatórios: `<span className="text-destructive">*</span>`
- **Input**: `h-10` para inputs, `rows={3}` para textarea
- **Ícones nos labels**: `h-3.5 w-3.5 text-muted-foreground` inline com gap-1.5

### Seleção de Requisições
- **Container**: `space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-card/50`
- **Item**: `flex items-center gap-3 p-2.5 rounded-md border transition-colors`
  - Selecionado: `border-primary/40 bg-primary/5`
  - Não selecionado: `border-transparent hover:bg-muted/50`
- **Checkbox**: `Checkbox` padrão do shadcn
- **Label**: `flex-1 cursor-pointer text-sm` com área (font-medium) + ID (text-xs text-muted-foreground)

### Seleção de Viagens
- Mesmo padrão visual das requisições
- Checkbox desabilitado se `!canEdit`
- Informação: descrição + ID + local de carregamento

### DialogFooter
- **Container**: `p-6 pt-4 border-t border-border/40 bg-muted/30`
- **Botão Cancelar**: `variant="outline"`, desabilitado durante loading
- **Botão Submit**: 
  - Loading: `Loader2 className="h-4 w-4 animate-spin"` + "Salvando..."
  - Normal: "Atualizar" (edição) ou "Criar Ordem" (criação)
  - Desabilitado se `!canEdit` ou `isLoading`

### Responsividade do Modal
- Mobile: campos empilham (1 coluna), seleções ocupam largura total
- Desktop: grid 2 colunas para campos lado a lado
- Scrollbar discreta no overflow (webkit-scrollbar 3px)

---

## Tokens e Padrões Reutilizados

### Cards
- Todos os cards usam: `border-border/60` + `bg-card/50` para cards internos
- Hover: `hover-elevate` (exceto em listas que já são clicáveis)
- Padding: `p-4` no CardContent
- Título de card: `font-semibold text-base flex items-center gap-2 mb-3`
- Ícone de título: `h-5 w-5 text-muted-foreground`
- Divider antes de metadata: `mt-3 pt-3 border-t border-border/40`

### Badges
- Origens: `Badge variant="secondary" className="text-xs font-normal"`
- Status: sempre `StatusBadge` (nunca hardcoded)
- Cores: todas via tokens do Design System (primary, chart-4, chart-5, destructive, muted)

### Botões
- Ações primárias: `Button` default (sem variant)
- Ações secundárias: `Button variant="outline"`
- Ícones: `h-4 w-4` com `mr-2` quando acompanhado de texto
- Tamanho: `size="sm"` para botões dentro de cards e headers

### Tipografia
- Título página: `text-xl font-semibold tracking-tight`
- Título card: `text-base font-semibold`
- Subtítulo: `text-sm font-medium`
- Label: `text-xs text-muted-foreground` (uppercase para filtros)
- Dados: `text-sm text-foreground font-medium`
- SKU/código: `font-mono text-xs`

### Cores de Status (Progresso)
- Não iniciado: barra cinza (default Progress)
- Em andamento: `bg-primary`
- Completo: `bg-chart-4`
- Excedido: `bg-destructive`

### Espaçamentos
- Page: `space-y-6` entre seções
- Card interno: `space-y-3` para lista de itens
- Grid: `gap-4` para cards lado a lado
- Filtros: `gap-2` entre campos

### Responsividade
- Grid detalhes: `grid-cols-1 md:grid-cols-2`
- Stats bar: `grid-cols-2 sm:grid-cols-5`
- Filtros: `grid-cols-1 md:grid-cols-2` (auto dentro do FilterBar)
- Ações: `flex-wrap` em todos os ActionBar
- Cards: `min-w-0` + `truncate` para evitar overflow

---

## Componentes do Design System Utilizados

| Componente | Arquivo | Uso |
|---|---|---|
| PageHeader | `components/page-header.tsx` | Título + descrição + slot de ações |
| ActionBar | `components/action-bar.tsx` | Agrupamento de botões com flex-wrap |
| FilterBar | `components/filter-bar.tsx` | Filtros com badgeCount e onClear |
| StatusBadge | `components/status-badge.tsx` | Todos os status visuais |
| EmptyState | `components/empty-state.tsx` | Estados vazios (compact e full) |
| PageLoading | `components/page-loading.tsx` | Loading states (compact e full) |
| Card | `components/ui/card.tsx` | Container de seções |
| CardContent | `components/ui/card.tsx` | Conteúdo dos cards |
| Button | `components/ui/button.tsx` | Todas as ações |
| Badge | `components/ui/badge.tsx` | Origens, previews |
| Progress | `components/ui/progress.tsx` | Barras de progresso |
| Select | `components/ui/select.tsx` | Filtros e evento |
| Checkbox | `components/ui/checkbox.tsx` | Seleção de requisições/viagens |
| Input | `components/ui/input.tsx` | Campos de texto |
| Textarea | `components/ui/textarea.tsx` | Observações |
| Label | `components/ui/label.tsx` | Labels de formulário |
| Dialog | `components/ui/dialog.tsx` | Modal criar/editar |
| Alert | `components/ui/alert.tsx` | Alerta de não editável |

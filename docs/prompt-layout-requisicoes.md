# Prompt de Layout — Requisição de Materiais (3 Telas + 3 Modais)

## Visão Geral
Sistema de Requisição de Materiais com 3 telas principais e 3 modais. Design System: Precision Logistics (dark-mode-first). Paleta: Deep Navy (#0A1929) background, Slate Blue (#102A43) cards, Azure (#00A3FF) primary, semantic colors (Emerald success, Amber warning, Ruby error). Tipografia: Inter (SemiBold 600 headlines, Medium 500 labels).

---

## Tela 1 — Lista de Requisições (`requests.tsx`)

### Container
- `space-y-6` vertical spacing
- Sem padding lateral (herdado do layout global)
- Background: `bg-background` (Deep Navy dark / white light)

### 1.1 PageHeader
- **Title**: "Requisição de Materiais" — `font-semibold text-2xl text-foreground`
- **Description**: "Gerencie requisições de materiais para seus eventos" — `text-sm text-muted-foreground`
- **Action**: Botão `Button` default (Azure) à direita: `Plus icon + "Nova Requisição"`
- Layout: `flex items-center justify-between` no header

### 1.2 FilterBar (condicional — só aparece se houver requisições)
- **BadgeCount**: número de filtros ativos (0, 1, 2...)
- **Clear button**: "Limpar Filtros" (aparece quando badgeCount > 0)
- **Filtros inline** (2 selects lado a lado):
  - **Status**: Select `h-8 text-sm`, options: Todos, Rascunho, Pendente, Aprovado, Rejeitado, Bloqueado
  - **Evento**: Select `h-8 text-sm`, options: Todos os eventos + lista dinâmica
  - Labels: `text-xs text-muted-foreground` acima de cada select
  - Container: `space-y-1.5` por filtro

### 1.3 Contador de Resultados
- Texto: `"{N} requisição(ões) encontrada(s)"` — `text-xs text-muted-foreground`
- Posicionado abaixo do FilterBar, acima da lista

### 1.4 Estados Vazios
- **EmptyState 1** (nenhuma requisição no sistema):
  - Icon: `ClipboardList` (48px, `text-muted-foreground`)
  - Title: "Nenhuma requisição ainda" — `text-lg font-semibold`
  - Description: "Crie requisições de materiais para seus eventos. Cada requisição começa como rascunho e pode ser enviada para aprovação."
  - Action: `Button` default — "Nova Requisição"
- **EmptyState 2** (filtros ativos sem resultado):
  - Icon: `ClipboardList`
  - Title: "Nenhuma requisição encontrada"
  - Description: "Ajuste os filtros para ver mais requisições."
  - Action: `Button` outline — "Limpar Filtros"

### 1.5 Grid de Cards (lista de requisições)
- **Layout**: `grid grid-cols-1 lg:grid-cols-2 gap-3`
- **Card**: `Card` com `className="hover-elevate border-border/60"`
- **CardContent**: `p-4`

#### Estrutura interna do Card (top → bottom):
1. **Header row** (`flex items-center justify-between gap-2 mb-2`):
   - Esquerda: `StatusBadge` (status atual) + `span.text-xs.text-muted-foreground.font-mono` (primeiros 8 chars do ID)
   - Direita: `span.text-xs.text-muted-foreground` (data formatada dd/MM/yyyy às HH:mm)
2. **Título** (`h3.font-semibold.text-base.text-foreground.truncate`):
   - Nome da área/requisição
3. **Evento** (`p.text-sm.text-muted-foreground.mt-1.truncate`):
   - Nome do evento vinculado ou "Evento não vinculado"
4. **Metadados** (`mt-3 pt-3 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1`):
   - 4 colunas de dados:
     - **Solicitante**: label `text-xs text-muted-foreground` + value `font-medium text-foreground truncate`
     - **Evento**: label + value (nome do evento)
     - **Data contextual**: label dinâmico (Criado / Enviado / Aprovado / Rejeitado) + value `font-medium text-foreground`
     - **Status**: label "Status" + `StatusBadge`
5. **Ações** (`mt-3 pt-3 border-t border-border/40 flex items-center justify-end gap-2`):
   - Botão `Button size="sm" variant="outline"`: `Eye icon + "Detalhes"`
   - Cada card é clicável (navega para detalhes)

### 1.6 RequestDialog (Modal)
- Trigger: botão "Nova Requisição" no PageHeader
- Ver seção "Modal 1" abaixo

---

## Tela 2 — Detalhes da Requisição (`request-details.tsx`)

### Container
- `space-y-6` vertical
- Background: `bg-background`

### 2.1 PageHeader
- **Title**: Nome da área (`request.area`) — `font-semibold text-2xl text-foreground`
- **Description**: Nome do evento (`request.event?.name`) — `text-sm text-muted-foreground`
- **ActionBar** (lado direito, `flex items-center gap-2`):
  - Botão "Voltar" (`ArrowLeft icon + variant="outline" size="sm"`): navega para `/requests`
  - Botão "Duplicar" (`Copy icon + variant="outline" size="sm"`): abre modal de duplicação (só aparece se houver itens)
  - Botão "Excluir" (`Trash2 icon + variant="outline" size="sm"`): abre AlertDialog de confirmação (só se `canEdit`)
  - Botão "Enviar" (`Send icon + variant="default" size="sm"`): submete para aprovação (só se `canEdit` e `items.length > 0`)

### 2.2 Status Badge (abaixo do header)
- `div.flex.items-center.gap-2`
- `StatusBadge` (status atual) + `span.text-xs.text-muted-foreground.font-mono` (ID truncado)

### 2.3 Alerta de Janela (condicional)
- Só aparece se `canEdit && requestWindowInfo && !isWithinWindow`
- `Alert variant="destructive"`
- Icon: `AlertCircle`
- Mensagem contextual:
  - **Antes da janela**: "Atenção: Requisições para este evento ainda não estão permitidas. Período: {start} até {end}"
  - **Depois da janela**: "Atenção: O período de requisição para este evento já foi encerrado. Período permitido era: {start} até {end}"

### 2.4 Resumo em DataCards (`PageSection`)
- **Container**: `PageSection` com `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`
- **DataCards** (máximo 6 cards, dinâmicos):
  - **Solicitante**: icon `Package`, meta: Nome do solicitante
  - **Status**: icon `Calendar`, conteúdo: `StatusBadge`
  - **Criação**: icon `Calendar`, meta: Data de criação formatada
  - **Evento**: icon `Package`, meta: Nome do evento
  - **Submissão** (se `submittedAt`): icon `Calendar`, meta: Data de envio
  - **Aprovação/Rejeição** (se `approvedAt`): icon `Calendar`, meta: Data + label "Aprovado" ou "Rejeitado"

### 2.5 Card de Observações
- `Card` com `CardContent p-4 space-y-3`
- **Título**: "Observações" — `font-semibold text-base`
- **Divider**: `mt-3 pt-3 border-t border-border/40`
- **Modo edição** (se `canEdit`):
  - `Textarea` rows={3}, placeholder: "Adicione observações sobre a requisição (opcional)"
  - Botão "Salvar" (`Save icon + variant="default" size="sm"`) aparece só se texto foi alterado
  - `flex justify-end` para botão
- **Modo leitura** (se !canEdit):
  - `p.text-sm.text-muted-foreground`: texto das observações ou "Nenhuma observação"

### 2.6 Card de Materiais Requisitados
- `Card` com `CardContent p-4`
- **Header** (`flex items-center justify-between mb-2`):
  - Esquerda: "Materiais Requisitados" — `font-semibold text-base` + contador `text-sm text-muted-foreground` ("({N} item(s))")
  - Direita: Botão "Adicionar" (`Plus icon + size="sm"`) — só se `canEdit`
- **Divider**: `mt-3 pt-3 border-t border-border/40`
- **Estado vazio** (se `items.length === 0`):
  - `EmptyState` com icon `Package`
  - Title: "Nenhum material adicionado"
  - Description: contextual ("Clique em 'Adicionar' para incluir produtos ou kits." se canEdit, senão "Esta requisição não possui materiais.")
  - Action: botão "Adicionar Material" (só se canEdit)
- **Lista de itens** (se `items.length > 0`):
  - `div.space-y-3`
  - **Item card**: `div.border.rounded-lg.p-3.hover-elevate`
  - **Layout interno** (`flex items-start justify-between gap-3`):
    - **Esquerda** (`flex-1 min-w-0`):
      - Linha 1: `span.font-medium.text-sm` (nome do produto/kit) + `StatusBadge` (approvalStatus, se !canEdit)
      - Linha 2: `div.text-sm.text-muted-foreground` — tipo ("Kit" ou SKU) + quantidade
        - Quantidade contextual:
          - Aprovado: `" Aprovado: {approved} de {total} {unit}"` — `text-chart-4`
          - Rejeitado: `" Rejeitado: {total} {unit}"` — `text-destructive`
          - Pendente: `" Quantidade: {total} {unit}"`
      - **Motivo de rejeição** (se `approvalStatus === "rejected" && rejectionReason`):
        - `div.mt-2.p-2.bg-destructive/10.border.border-destructive/20.rounded.text-sm`
        - "Motivo da rejeição:" + texto
      - **Observações do item** (se `notes`):
        - `div.mt-2.p-2.bg-muted/50.rounded.text-sm`
        - "Observações:" + texto
    - **Direita**:
      - Botão `Trash2` (`variant="ghost" size="icon"`) — só se `canEdit`

### 2.7 AlertDialog de Exclusão
- Title: "Excluir Requisição"
- Description: "Tem certeza que deseja excluir esta requisição? Esta ação não pode ser desfeita."
- Footer: "Cancelar" (outline) + "Excluir" (destructive/default)

### 2.8 Modais aninhados
- **AddItemDialog**: aberto pelo botão "Adicionar" no card de materiais
- **DuplicateRequestDialog**: aberto pelo botão "Duplicar" no header
- Ver seções "Modal 2" e "Modal 3" abaixo

---

## Modal 1 — Criar/Editar Requisição (`request-dialog.tsx`)

### Container
- `DialogContent className="max-w-md"`
- `DialogHeader`:
  - Title: "Nova Requisição" ou "Editar Requisição"
  - Description: "Crie uma requisição de materiais. Ela começa como rascunho e só pode ser enviada para aprovação dentro do período permitido pelo evento." (novo) ou "Atualize os dados da requisição." (edição)

### Formulário (`space-y-4`)
1. **Evento*** (`div.space-y-2`):
   - `Label`: "Evento *"
   - `Select` com trigger `data-testid="select-event"`
   - Options: lista de eventos
   - **Alert contextual** (aparece abaixo do Select quando evento selecionado):
     - Se janela aberta: `Alert variant="default"` — "Período permitido: {start} até {end}"
     - Se antes da janela: `Alert variant="destructive"` — "Atenção: Requisições para este evento ainda não estão permitidas."
     - Se depois da janela: `Alert variant="destructive"` — "Atenção: O período de requisição para este evento já foi encerrado."
2. **Nome da Requisição*** (`div.space-y-2`):
   - `Label`: "Nome da Requisição *"
   - `Input` placeholder: "Ex: Cenografia Palco Principal"
3. **Observações** (`div.space-y-2`):
   - `Label`: "Observações"
   - `Textarea` rows={3} placeholder: "Observações sobre a requisição (opcional)"

### Footer
- `DialogFooter`: "Cancelar" (outline) + "Criar"/"Atualizar" (default, disabled durante loading)

---

## Modal 2 — Adicionar Material (`add-item-dialog.tsx`)

### Container
- `DialogContent className="max-w-lg"`
- `DialogHeader`:
  - Title: "Adicionar Material"
  - Description: "Escolha entre adicionar um produto individual ou um kit completo. A quantidade deve ser maior que zero."

### Formulário (`space-y-4`)
- **Tabs** (`grid w-full grid-cols-2`):
  - **Tab "Produto"** (`value="product"`):
    - `div.space-y-4 mt-4`
    - **Produto***: `Select` com lista de produtos (nome + SKU)
    - **Quantidade***: `Input type="number" min="1"` (default: 1)
    - **Observações**: `Textarea` rows={2}
  - **Tab "Kit"** (`value="kit"`):
    - `div.space-y-4 mt-4`
    - **Kit***: `Select` com lista de kits
    - **Quantidade***: `Input type="number" min="1"` (default: 1)
    - **Observações**: `Textarea` rows={2}

### Footer
- `DialogFooter`: "Cancelar" (outline, reseta form ao fechar) + "Adicionar" (default, disabled durante loading)

---

## Modal 3 — Duplicar Requisição (`duplicate-request-dialog.tsx`)

### Container
- `DialogContent className="max-w-md"`
- `DialogHeader`:
  - Title: `Copy icon + "Duplicar Requisição"`
  - Description: "Cria uma nova requisição como rascunho, copiando todos os {N} itens desta requisição. Você pode alterar o evento e o nome antes de confirmar."

### Formulário (`space-y-4`)
1. **Evento*** (`div.space-y-2`):
   - `Label`: "Evento *"
   - `Select` com lista de eventos
   - **Alert contextual** (mesmo padrão do Modal 1 — janela de requisição do evento)
2. **Nome da Requisição*** (`div.space-y-2`):
   - `Label`: "Nome da Requisição *"
   - `Input` com valor default: `"{area original} (Cópia)"`
3. **Observações** (`div.space-y-2`):
   - `Label`: "Observações"
   - `Textarea` rows={3}

### Footer
- `DialogFooter`: "Cancelar" (outline) + "Duplicar" (default, disabled durante loading, redireciona para nova requisição ao sucesso)

---

## Tokens de Design (aplicados em todas as telas)

### Cores
- Background: `bg-background` (Deep Navy #0A1929 dark / white light)
- Card: `bg-card` (Slate Blue #102A43 dark / gray-50 light)
- Card border: `border-border/60`
- Divider: `border-t border-border/40`
- Text primary: `text-foreground`
- Text secondary: `text-muted-foreground`
- Primary action: Azure (`Button variant="default"`)
- Success: `text-chart-4` (Emerald)
- Destructive: `text-destructive` (Ruby)

### Tipografia
- Page title: `text-2xl font-semibold`
- Card title: `font-semibold text-base`
- Body: `text-sm`
- Label/metadata: `text-xs text-muted-foreground`
- Mono (IDs): `font-mono`

### Interações
- Cards: `hover-elevate` (subtle elevation no hover)
- Buttons: built-in hover/active states do Shadcn (nunca adicionar `hover:bg-*` manual)
- Badges: built-in hover/active states
- Items list: `hover-elevate` nos cards de item

### Responsividade
- Lista: `grid-cols-1` mobile → `lg:grid-cols-2` desktop
- Detalhes DataCards: `grid-cols-1` mobile → `sm:grid-cols-2` tablet → `lg:grid-cols-4` desktop
- Card metadata: `grid-cols-2` mobile → `sm:grid-cols-4` desktop
- Modais: `max-w-md` (criar/duplicar) e `max-w-lg` (adicionar item)

### Espaçamento
- Page sections: `space-y-6`
- Card padding: `p-4`
- Card internal spacing: `space-y-3`
- Metadata grid gap: `gap-x-4 gap-y-1`
- Card action bar gap: `gap-2`

### Componentes do Design System
- `PageHeader`: title + description + action slot
- `PageSection`: wrapper sem título (usado para DataCards)
- `FilterBar`: badgeCount + clear button + children inline
- `EmptyState`: icon + title + description + optional action
- `DataCard`: title + icon + meta array (label/value pairs) + optional children
- `ActionBar`: flex container para botões de ação no header
- `StatusBadge`: status com cor semântica (draft=gray, pending=amber, approved=emerald, rejected=ruby, cutoff_locked=slate)
- `PageLoading`: spinner + message (usado em estados de loading)

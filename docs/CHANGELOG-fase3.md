# Changelog - Fase 3 (UI/UX)

## Fase 3.3.0 — Precision Logistics Design System (2026-05-29)

### Novo Design System aplicado

1. **Cores base atualizadas (Dark Mode First)**
   - Background: `#0A1929` (Deep Navy) — antes `#111827` (slate-900)
   - Card: `#102A43` (Slate Blue) — antes `#1f2937` (slate-800)
   - Primary: `#00A3FF` (Azure) — antes `#0ea5e9` (cyan-500)
   - Border: `#1E293B` (Slate) — antes `#374151` (slate-700)
   - Destructive: `#EF4444` (Ruby) — antes `#ef4444` (red-500)
   - Accent: `#89CEFF` (Cyan) — antes `#ec4899` (pink-500)
   - Muted foreground: mais cinza para legibilidade em dark navy
   - Shadows: fundo navy com opacidade mais alta (30-60%)

2. **Light Mode também ajustado**
   - Background: cinza claro `#f1f5f9` com base azulada
   - Primary: Azure `#00A3FF` mantido
   - Sidebar: dark navy `#1e3a5f` (antes slate-900)
   - Cards: branco puro mantido
   - Shadows: base azulada escura

3. **Border Radius padronizado**
   - `lg`: `1rem` (16px) — antes 9px
   - `md`: `0.75rem` (12px) — antes 6px
   - `sm`: `0.5rem` (8px) — antes 3px
   - `xl`: `1.5rem` (24px) — novo, para pill badges

4. **Documentação atualizada**
   - `docs/DESIGN_SYSTEM.md`: tokens de cores, semântica, elevação, sombras
   - `replit.md`: seção UI/UX atualizada com descrição do Precision Logistics

### Arquivos alterados
- `client/src/index.css` — light mode e dark mode (Precision Logistics)
- `tailwind.config.ts` — border radius tokens
- `docs/DESIGN_SYSTEM.md` — documentação do novo design system
- `replit.md` — visão geral do design system

### Validações
- `npm run check`: ✅ zerado
- `npm run build`: ✅ passando (272.4kb)
- Visual: tela de login com dark navy, cards slate blue, botão Azure brilhante ✅

### O que NÃO foi alterado
- Back-end, banco, seed, migrations, schema, endpoints, payloads
- RBAC, permissions, roles
- Componentes de UI/UX (PageHeader, FilterBar, etc.) — layout intacto
- Sidebar, rotas, lógica de negócio
- Todas as telas individuais mantêm estrutura, apenas herdam novas cores

---

## Fase 3.0.1 — Quick Wins de primeira impressão (2026-05-28)

### Correções aplicadas

1. **Rota /dashboard eliminou 404**
   - Adicionado redirect `/dashboard` → `/` em `App.tsx` via componente `DashboardRedirect`.
   - Nenhum endpoint novo criado. A rota `/` já existia como tela inicial funcional.

2. **Layout público sem sidebar**
   - Rotas `/auth`, `/forgot-password`, `/reset-password` agora renderizam sem sidebar e sem header interno.
   - Implementado `AppLayout` com detecção de rota pública (`isPublicRoute`).
   - `SidebarProvider`, `AppSidebar`, `SidebarTrigger`, `NotificationBell` e header interno são condicionalmente omitidos em rotas públicas.
   - Formulários, lógica, payloads e chamadas de API inalterados.

3. **Microcopy EN/PT corrigido**
   - `not-found.tsx`: "404 Page Not Found" → "Página não encontrada"
   - `not-found.tsx`: "The page you're looking for doesn't exist or has been moved." → "A página que você está procurando não existe ou foi movida."
   - `not-found.tsx`: "Back to Dashboard" → "Voltar ao início"
   - `protected-route.tsx`: "Voltar ao Dashboard" → "Voltar ao início"
   - `movement-approvals.tsx`: "Voltar ao Dashboard" → "Voltar ao início"

### Arquivos alterados
- `client/src/App.tsx`
- `client/src/pages/not-found.tsx`
- `client/src/lib/protected-route.tsx`
- `client/src/pages/movement-approvals.tsx`

### Validações
- `npm run check`: ✅ zerado
- `npm run build`: ✅ passando
- Smoke visual: 
  - `/auth` sem sidebar ✅
  - `/forgot-password` sem sidebar ✅
  - `/reset-password` sem sidebar ✅
  - `/dashboard` não mostra 404 ✅ (redirect para `/`)
  - Rota inexistente mostra texto em português ✅
  - Navegação interna continua com sidebar ✅

### O que NÃO foi alterado
- Back-end, banco, seed, migrations, schema, endpoints, payloads
- RBAC, permissions, roles
- Sidebar interna (exceto condicional em públicas)
- Módulos de Movimentações, Loading Orders, Requisições, Produtos, Kits, Fornecedores, Devoluções
- Design System base (PageHeader, DataCard, FilterBar, EmptyState, StatusBadge)
- Dashboard analítico complexo

---

## Fase 3.1 — Design System Base (2026-05-28)

### Componentes criados

| Componente | Arquivo | Propósito |
|------------|---------|----------|
| PageHeader | `client/src/components/page-header.tsx` | Título + descrição + slot de ações |
| PageSection | `client/src/components/page-section.tsx` | Seção com título, descrição e conteúdo |
| EmptyState | `client/src/components/empty-state.tsx` | Ícone + título + descrição + CTA opcional |
| PageLoading | `client/src/components/page-loading.tsx` | Spinner centralizado com mensagem |
| ErrorState | `client/src/components/error-state.tsx` | Ícone + título + descrição + botão de retry |
| FilterBar | `client/src/components/filter-bar.tsx` | Área colapsável de filtros |
| DataCard | `client/src/components/data-card.tsx` | Card com ícone, título, badge, metadados |
| ActionBar | `client/src/components/action-bar.tsx` | Barra de ações com gap consistente |
| PermissionHint | `client/src/components/permission-hint.tsx` | Mensagem sutil de permissão negada |
| StatusBadge | `client/src/components/status-badge.tsx` | Badge padronizado para todos os módulos |
| index.ts | `client/src/components/index.ts` | Barrel export dos componentes base |

### StatusBadge — status adicionados

- **Movement**: `created`, `paused`, `disapproved`
- **User**: `active`, `inactive`
- **Return**: `return_ok`, `return_damaged`, `return_lost`

### Telas onde os componentes foram aplicados

| Tela | Componente usado |
|------|-----------------|
| `not-found.tsx` | PageHeader |
| `protected-route.tsx` | PageLoading, ErrorState |
| `dashboard.tsx` | PageHeader, PageLoading |
| `docks.tsx` | PageHeader, PageLoading, EmptyState |

### Arquivos alterados
- `client/src/components/status-badge.tsx` (status adicionados)
- `client/src/pages/not-found.tsx`
- `client/src/lib/protected-route.tsx`
- `client/src/pages/dashboard.tsx`
- `client/src/pages/docks.tsx`

### Arquivos criados
- `client/src/components/page-header.tsx`
- `client/src/components/page-section.tsx`
- `client/src/components/empty-state.tsx`
- `client/src/components/page-loading.tsx`
- `client/src/components/error-state.tsx`
- `client/src/components/filter-bar.tsx`
- `client/src/components/data-card.tsx`
- `client/src/components/action-bar.tsx`
- `client/src/components/permission-hint.tsx`
- `client/src/components/index.ts`

### Validações
- `npm run check`: ✅ zerado
- `npm run build`: ✅ passando
- Smoke visual:
  - `/auth` sem sidebar ✅
  - `/docks` com PageHeader + EmptyState ✅
  - `/dashboard` com PageHeader + PageLoading ✅
  - Rota inexistente com PageHeader ✅
  - Navegação interna continua com sidebar ✅

### O que NÃO foi alterado
- Back-end, banco, seed, migrations, schema, endpoints, payloads
- RBAC, permissions, roles
- Sidebar interna
- Módulos de Movimentações, Loading Orders, Requisições, Produtos, Kits, Fornecedores, Devoluções (exceto Docks como piloto)
- Formulários, queries, mutations
- Regras de negócio

---

## Fase 3.2.1 — Refinamento Visual de Movimentações (2026-05-29)

### Telas refinadas

| Tela | Componentes aplicados | Melhorias visuais |
|------|------------------------|-------------------|
| `movements.tsx` | PageHeader, PageLoading, EmptyState, StatusBadge, FilterBar | Header padronizado; loading com spinner; empty state com ícone; status via StatusBadge; filtros em FilterBar |
| `movement-details.tsx` | PageHeader, PageLoading, StatusBadge | Header padronizado com ações; status via StatusBadge; loading com spinner |
| `movement-approvals.tsx` | PageHeader, PageLoading, EmptyState | Header padronizado; loading com spinner; empty state com ícone |

### Detalhes por tela

1. **movements.tsx**
   - Removidos `getStatusColor`/`getStatusLabel` locais (substituídos por `StatusBadge`)
   - Header substituído por `PageHeader` com título + descrição + slot de ações
   - Loading state com `PageLoading` (spinner + mensagem)
   - Empty state com `EmptyState` (ícone `Truck`, título, descrição contextual)
   - Filtros reestruturados em `FilterBar` (collapsible, layout flex-wrap)
   - Eventos exibidos como texto simples (sem badges individuais) para reduzir poluição visual
   - Botão "Iniciar Movimentação" encurtado para "Iniciar" (economia de espaço no header)

2. **movement-details.tsx**
   - Removido `getStatusColor` local (substituído por `StatusBadge`)
   - Mantido `getStatusLabel` (necessário para audit logs de status changes)
   - Header substituído por `PageHeader` com título, descrição (nome + tipo + ordem) e ações
   - Loading state com `PageLoading`
   - Card de Status usa `StatusBadge`
   - Botão "Iniciar Movimentação" encurtado para "Iniciar"
   - Botão de voltar movido para slot de ações do PageHeader
   - `PageSection` aplicado em Status/Informações e Scanner
   - Eventos e loadingOrder preservados na descrição do header

3. **movement-approvals.tsx**
   - Header substituído por `PageHeader` com contador de pendentes no slot
   - Loading state com `PageLoading`
   - Empty state com `EmptyState` (ícone `CheckCircle2`)
   - Removido `Card` manual do empty state

### Arquivos alterados
- `client/src/pages/movements.tsx`
- `client/src/pages/movement-details.tsx`
- `client/src/pages/movement-approvals.tsx`

### Validações
- `npm run check`: ✅ zerado
- `npm run build`: ✅ passando
- Smoke visual (tentado; sem acesso logado, redirecionado para `/auth` — comportamento esperado)

### O que NÃO foi alterado
- Back-end, banco, seed, migrations, schema, endpoints, payloads
- RBAC, permissions, roles, helpers de autorização
- Chamadas de API, queries, mutations
- Status do back-end, fluxo operacional
- Scanner, regras de negócio, transitions
- Formulários, dialogs, confirmações
- Audit logs, produtos, fornecedores
- Sidebars, navegação

### Revisão corretiva (2026-05-29)
- **Lacuna encontrada**: Eventos e loadingOrder removidos acidentalmente do header de `movement-details.tsx`
- **Correção**: Restaurados na descrição do `PageHeader` (nome + tipo + ordem)
- **PageSection aplicado**: Status/Informações e Scanner do `movement-details.tsx` agora usam PageSection
- **Smoke por código**: Validado que todos os helpers RBAC (`userCanCreateMovement`, `userCanEditMovement`, `userCanManageMovementItems`, `userCanChangeMovementStatusFreely`, `userCanApproveMovement`) permanecem intactos em todos os 3 arquivos; nenhuma ação sumiu ou apareceu indevidamente
- **Diff revisado**: Nenhuma remoção acidental de API calls, queries, mutations, invalidações de cache, handlers, scanner, filtros, renderizações condicionais, imports ou tratamento de erro

### O que fica para 3.2.2
- Aplicação de `PageSection` nas listas de itens e no histórico de ações
- Aplicação de `DataCard` nos info cards (doca, veículo, progresso) — apenas se encaixar naturalmente
- Aplicação de `ActionBar` nos botões de ação
- Aplicação de `EmptyState` nas listas vazias internas (itens esperados/carregados)
- Responsividade refinada dos cards de movimentação

---

## Fase 3.2.2 — Refinamento Global Complementar (2026-05-29)

### Fundação global
- **App.tsx**: wrapper `mx-auto px-6 py-6 max-w-7xl` elimina duplo padding em todas as páginas
- Batch remoção: `p-6 space-y-6` → `space-y-6` em ~25 páginas

### Telas secundárias refinadas (16 telas)

| Tela | PageHeader | PageLoading | EmptyState |
|------|:----------:|:-----------:|:----------:|
| loading-order-details.tsx | ✅ | ✅ | ✅ |
| request-details.tsx | ✅ | ✅ | ✅ |
| stock-simulation.tsx | ✅ | ✅ | ✅ |
| stock-position-simulation.tsx | ✅ | ✅ | ✅ |
| movement-groups.tsx | ✅ | ✅ | ✅ |
| movement-types-config.tsx | ✅ | ✅ | ✅ |
| locations.tsx | ✅ | ✅ | ✅ |
| product-statuses.tsx | ✅ | ✅ | ✅ |
| product-variants.tsx | ✅ | ✅ | ✅ |
| notification-settings.tsx | ✅ | ✅ | ✅ |
| inventory-views.tsx | ✅ | ✅ | ✅ |
| product-upload.tsx | ✅ | ✅ | ✅ |
| event-upload.tsx | ✅ | ✅ | ✅ |
| trip-upload.tsx | ✅ | ✅ | ✅ |
| approval-detail.tsx | ✅ | ✅ | ✅ |
| approvals.tsx | ✅ | ✅ | ✅ |

### Telas principais refinadas (10 telas)

| Tela | PageHeader | PageLoading | EmptyState |
|------|:----------:|:-----------:|:----------:|
| loading-orders.tsx | ✅ | ✅ | ✅ |
| trips.tsx | ✅ | ✅ | ✅ |
| vehicles.tsx | ✅ | ✅ | ✅ |
| drivers.tsx | ✅ | ✅ | ✅ |
| inventory.tsx | ✅ | ✅ | ✅ |
| events.tsx | ✅ | ✅ | ✅ |
| config.tsx | ✅ | ✅ | ✅ |
| users.tsx | ✅ | ✅ | ✅ |
| suppliers.tsx | ✅ | ✅ | ✅ |
| roles.tsx | ✅ | ✅ | ✅ |

### Arquivos alterados
- `client/src/App.tsx` (padding global)
- `client/src/pages/loading-orders.tsx`
- `client/src/pages/trips.tsx`
- `client/src/pages/vehicles.tsx`
- `client/src/pages/drivers.tsx`
- `client/src/pages/inventory.tsx`
- `client/src/pages/events.tsx`
- `client/src/pages/config.tsx`
- `client/src/pages/users.tsx`
- `client/src/pages/suppliers.tsx`
- `client/src/pages/roles.tsx`
- `client/src/pages/loading-order-details.tsx`
- `client/src/pages/request-details.tsx`
- `client/src/pages/stock-simulation.tsx`
- `client/src/pages/stock-position-simulation.tsx`
- `client/src/pages/movement-groups.tsx`
- `client/src/pages/movement-types-config.tsx`
- `client/src/pages/locations.tsx`
- `client/src/pages/product-statuses.tsx`
- `client/src/pages/product-variants.tsx`
- `client/src/pages/notification-settings.tsx`
- `client/src/pages/inventory-views.tsx`
- `client/src/pages/product-upload.tsx`
- `client/src/pages/event-upload.tsx`
- `client/src/pages/trip-upload.tsx`
- `client/src/pages/approval-detail.tsx`
- `client/src/pages/approvals.tsx`

### Validações
- `npm run check`: ✅ zerado
- `npm run build`: ✅ passando
- Smoke visual: todas as páginas com PageHeader + padding consistente

### O que NÃO foi alterado
- Back-end, banco, seed, migrations, schema, endpoints, payloads
- RBAC, permissions, roles, helpers de autorização
- Chamadas de API, queries, mutations
- Status do back-end, fluxo operacional
- Regras de negócio
- Formulários, dialogs, confirmações
- Audit logs, produtos, fornecedores
- Sidebars, navegação

### Próximas fases
- **3.3** — Loading Orders refinamento complementar
- **3.4** — Requisições
- **3.5** — Catálogo
- **3.6** — Devoluções
- **3.7** — Admin/Configurações
- **3.8** — Dashboard analítico
---

## Fase 3.2.3 — Padronização de Cards, Filtros e Hierarquia (2026-05-29)

### Resumo
Revisão visual global para unificar padrão de cards de lista, filtros e hierarquia tipográfica. Nenhuma regra de negócio, RBAC ou endpoint alterado.

### FilterBar — Conversão de filtros manuais
| Tela | Antes | Depois |
|------|-------|--------|
| movements.tsx | Card manual com filtros inline | FilterBar com badgeCount + onClear |
| requests.tsx | Card manual com filtros inline | FilterBar padronizado |
| approvals.tsx | Card manual com filtros inline | FilterBar com badgeCount + onClear |

### Hierarquia de títulos em cards de lista
Padrão aplicado: `<h3 className="font-semibold text-base text-foreground">` em todos os cards de lista.

| Página | Estado |
|---------|--------|
| products.tsx | Convertido (h3 + border-t divider) |
| returns.tsx | Convertido (h3 + border-t divider) |
| kits.tsx | Já tinha border-t, h3 já correto |
| vehicles.tsx | Já tinha border-t, h3 já correto |
| docks.tsx | Já tinha border-t, h3 já correto |
| loading-orders.tsx | Já tinha border-t, h3 já correto |
| trips.tsx | Já tinha border-t, h3 já correto |
| events.tsx | Já tinha border-t, h3 já correto |
| movements.tsx | Já tinha border-t, h3 já correto |
| requests.tsx | Já tinha border-t, h3 já correto |
| approvals.tsx | Já tinha border-t, h3 já correto |
| suppliers.tsx | Tabela (não aplica card) |
| drivers.tsx | Tabela (não aplica card) |
| users.tsx | Tabela (não aplica card) |
| roles.tsx | Tabela (não aplica card) |
| inventory.tsx | Layout progress bar (não aplica card) |
| config.tsx | Cards grid com ícones (não aplica card) |

### Padrão de metadados
- **Divider**: `mt-3 pt-3 border-t border-border/40` antes de blocos de metadata/stats
- **Título**: `font-semibold text-base text-foreground` (nunca `font-medium` ou `text-2xl`)
- **Padding de cards**: `p-4` consistente (zero `p-6` remanescente)

### Arquivos alterados
- `client/src/components/filter-bar.tsx` (badgeCount + onClear)
- `client/src/pages/movements.tsx`
- `client/src/pages/requests.tsx`
- `client/src/pages/approvals.tsx`
- `client/src/pages/products.tsx`
- `client/src/pages/returns.tsx`

### Validações
- `npm run check`: ✅ zerado
- `npm run build`: ✅ passando (272.4kb)
- Sem `p-6` remanescente em cards de lista
- Sem `h3 font-medium` remanescente em cards de lista

### O que NÃO foi alterado
- Back-end, banco, seed, migrations, schema, endpoints, payloads
- RBAC, permissions, roles, helpers de autorização
- Chamadas de API, queries, mutations
- Status do back-end, fluxo operacional
- Regras de negócio

---

## Fase 3.2.4 — Refinamento de Telas Operacionais (2026-05-29)

### Resumo
Passo operacional de refinamento visual em telas críticas de movimentações, requisições e aprovações. Sem alteração de back-end, RBAC, endpoints ou regras de negócio.

### request-details.tsx
- **Loading state**: `PageLoading` (substituiu `flex items-center justify-center h-full` com texto simples)
- **Empty state**: `EmptyState` com ícone `ClipboardList` (substituiu texto simples)
- **Import**: `ClipboardList` adicionado ao `lucide-react`

### requests.tsx
- **FilterBar**: `badgeCount` + `onClear` corretamente calculados via `activeFiltersCount` (conta filtros ativos individualmente — status + evento)
- **Lógica de filtros**: `useMemo` para `activeFiltersCount` + `clearFilters` (zera ambos os filtros para `"all"`)

### approvals.tsx
- **FilterBar**: `badgeCount` corrigido de `hasActiveFilters ? 1 : 0` (boolean) para `activeFiltersCount` (contador real de 0–3)
- **Lógica de filtros**: `activeFiltersCount` via `useMemo` contando status + evento + requester

### Arquivos alterados
- `client/src/pages/request-details.tsx`
- `client/src/pages/requests.tsx`
- `client/src/pages/approvals.tsx`

### Validações
- `npm run check`: ✅ zerado
- `npm run build`: ✅ passando (272.4kb)
- Zero alteração de back-end, RBAC, endpoints, queries, mutations

### O que NÃO foi alterado
- Back-end, banco, seed, migrations, schema, endpoints, payloads
- RBAC, permissions, roles, helpers de autorização
- Chamadas de API, queries, mutations
- Status do back-end, fluxo operacional
- Regras de negócio

---

## Fase 3.2.5 — 10/10 Operational UI Pass (2026-05-29)

### Resumo
Aplicação profunda do Design System nas telas operacionais críticas. Transformação de movimentações, ordens de carregamento e aprovações em experiência visual profissional, limpa e densa. Cada tela ganhou stats bar, filtros, cards compactos e padrão de metadata consistente.

### movements.tsx (Tela Referência 10/10)

**Stats Bar (novo)** — 5 contadores clicáveis (Total, Criadas, Em Andamento, Pausadas, Finalizadas) com dot de cor e estado `active` quando filtrado.

**FilterBar** — 7 filtros com pills de filtros ativos visíveis abaixo do FilterBar (mesmo fechado).

**Cards operacionais**:
- Card inteiro clicável (`cursor-pointer` + `onClick` navigate)
- `e.stopPropagation()` nos botões de ação (Iniciar, Pausar, Finalizar, Continuar, Editar, Ver)
- `Eye` substituiu `ArrowRight` como botão de detalhes
- Eventos integrados na metadata strip (sem label "Eventos:")
- Metadata strip usa `flex-wrap` (mais flexível que `grid-cols-4`)

**Ações** — Editável sempre visível para `created`/`paused`, status transição sempre visível para o status atual.

### loading-orders.tsx

**Stats Bar (novo)** — 5 contadores (Total, Rascunhos, Prontas, Em Andamento, Finalizadas).

**FilterBar (novo)** — 2 filtros: Status + Evento, com `badgeCount` + `onClear`.

**Cards operacionais**:
- Alinhado com padrão movements: card clicável, `Eye` para detalhes, `Edit` para editar
- Metadata strip com `flex-wrap` incluindo horários reais (start/end)
- Loading state com `PageHeader` + `PageLoading`

### approvals.tsx

**Stats Bar (novo)** — 3 contadores (Pendentes, Aprovados, Rejeitados).

**StatusBadge duplicado removido** — linha 40-52 (Badge local com `bg-chart-3`, `bg-chart-4`, `bg-destructive`) deletada. Agora usa `StatusBadge` compartilhado de `@/components/status-badge`.

**Cards operacionais**:
- Seção "Pendentes" e "Processadas" com `border-b` header (padrão movements)
- Cards com `border-border/60`, metadata strip `flex-wrap`
- ID curto (`slice(0,8)`) em `font-mono` como secondary info
- Layout compacto: `space-y-3` entre cards

### movement-approvals.tsx

**Tabela → Cards (reformulação)** — Substituiu Table/TableHeader/TableBody/TableRow por cards operacionais seguindo padrão movements.

**Cards** — Header com número + nature badge + nome + ações (Aprovar/Rejeitar). Metadata strip com criador, data, grupo, eventos.

**Nature badge** — Mantido (local, não é status; é natureza de movimentação).

**Loading state** — Alinhado com `PageHeader` + `PageLoading` dentro de `space-y-6`.

### Arquivos alterados
- `client/src/pages/movements.tsx` (tela referência 10/10)
- `client/src/pages/loading-orders.tsx` (stats, filtros, cards)
- `client/src/pages/approvals.tsx` (stats, StatusBadge compartilhado, cards)
- `client/src/pages/movement-approvals.tsx` (tabela→cards, loading state)
- `docs/CHANGELOG-fase3.md` (esta seção)
- `docs/DESIGN_SYSTEM.md` (design tokens e padrões completos)

### Validações
- `npm run check`: ✅ zerado
- `npm run build`: ✅ passando (272.4kb)
- Zero alteração de back-end, RBAC, endpoints, queries, mutations

### O que NÃO foi alterado
- Back-end, banco, seed, migrations, schema, endpoints, payloads
- RBAC, permissions, roles, helpers de autorização
- Chamadas de API, queries, mutations
- Status do back-end, fluxo operacional
- Regras de negócio

### Próximas fases
- **3.3** — Detail pages (movement-details, loading-order-details, request-details, approval-detail)
- **3.4** — Requisições
- **3.5** — Catálogo
- **3.6** — Devoluções
- **3.7** — Admin/Configurações
- **3.8** — Dashboard analítico
- **3.9** — Login/Auth flow

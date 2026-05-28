# Changelog - Fase 3 (UI/UX)

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

### Próximas fases
- **3.2** — Movimentações (aplicar PageHeader, EmptyState, FilterBar, StatusBadge)
- **3.3** — Loading Orders
- **3.4** — Requisições
- **3.5** — Catálogo
- **3.6** — Devoluções
- **3.7** — Admin/Configurações
- **3.8** — Dashboard analítico
- **3.9** — Login/Auth flow (já parcialmente coberto pela 3.0.1)

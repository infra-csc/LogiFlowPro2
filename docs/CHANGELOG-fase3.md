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

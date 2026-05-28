# EventFlow Logistics - Event Material Management System

## Overview
EventFlow Logistics is a web application designed to streamline event material management, from requisition and inventory tracking to multi-vehicle loading and reverse logistics. It operates under an "event umbrella" model, organizing all material-related activities by event. The system aims to reduce operational overhead, provide real-time visibility, and support various teams including planning, operations, scenography, warehouse, driving, and inventory management. Key capabilities include cutoff deadlines, parametric kit explosion, time-phased inventory projection, and detailed damage/loss tracking for returns. The project's ambition is to optimize event logistics through comprehensive, integrated management.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (2025-11-01)
- **Ownership-Based Permissions (Phase 1)**: Implemented resource ownership control where only the creator (or admins) can edit/delete resources. Converted requestedBy/createdBy fields from text to FK references to users.id. Created server/ownership.ts with canEditResource/canDeleteResource utilities that check admin role OR resource ownership. Updated all POST routes to auto-populate creator from authenticated user. Added ownership checks to PATCH/DELETE routes for requests, trips, loading orders, and movements. Updated frontend request-details page to show/hide edit/delete buttons based on ownership verification.

## Bug Fix (2026-05-28) — Fase 1.4 (autorização admin)
- **Causa raiz do 403 no `DELETE /api/drivers/:id` para o usuário `admin`**: mismatch de strings. No seed do banco a role administrativa chama-se **`Adm`** (pt-BR) e está corretamente atribuída ao usuário `admin` via `user_roles`. Porém `isAdmin()` em `server/ownership.ts` e o cálculo de `isAdmin` em `server/auth.ts` (`GET /api/user`) comparavam contra a string literal `'admin'` (inglês, minúsculo). Resultado: `isAdmin` sempre `false` para o usuário admin → 403 em qualquer rota admin-only e front-end inteiro sub-permissionado.
- **Bug**, não comportamento esperado. Impacto: DELETE de drivers/suppliers (e qualquer rota admin-only futura) bloqueava o próprio admin; UI dependente de `user.isAdmin` escondia funcionalidades de admin.
- **Correção mínima** (sem alterar banco, sem migration, sem ampliar permissões além do seed): comparação de role agora é **case-insensitive** e aceita as duas grafias do seed (`'admin'` e `'adm'`). Aplicada em 2 lugares: `server/ownership.ts:isAdmin()` e `server/auth.ts:GET /api/user`. Nenhuma role nova é concedida — só é honrada a role já atribuída via `user_roles`.
- **Smoke completo (Fase 1.4)**: anônimo `DELETE /api/drivers/:id` → 401 ✓; usuário não-admin (role `Gestor Logistica`) → 403 ✓; admin → 204 ✓; admin `GET /api/user` agora devolve `"isAdmin":true` ✓; criação/edição/exclusão de motorista pelo admin ok ponta-a-ponta.
- **Auditoria de duplicação `GET /api/users`** (apenas diagnóstico, sem remoção — proposta para Fase 1.5):
  - **3 declarações**: `routes.ts:1994` (com `requireAuth`, devolve `users.map(({password,...}) => user)` — superset), `routes.ts:2723` (auth manual, devolve `{id, username, name}` para @mention), `routes.ts:3059` (auth manual, devolve campos de user-management explícitos via Drizzle).
  - **Express resolve a primeira registrada** → linha 1994 é a única ativa em runtime; linhas 2723 e 3059 são código morto. A linha 1994 é superset funcional das outras duas (todos os campos necessários para @mention e para user-management estão presentes). Remoção é segura, mas fica para fase dedicada.
  - Não há duplicação de `GET /api/users/:id` (declarado uma única vez em `routes.ts:2005`).
- **Sem alteração** em banco, migrations, payloads (formato JSON de `/api/user` mantém `roles` e `isAdmin`), nomes de rotas, regras de negócio, front-end ou ownership de outras entidades.

## TypeScript Cleanup (2026-05-28) — Fase 1.3 (front-end)
- **`client/src/components/ObjectUploader.tsx`**: Uppy emite `UploadResult<Meta, Body>` no evento `complete`, mas o prop `onComplete` exigia `UploadResult<Record<string, unknown>, Record<string, unknown>>`, incompatível. Importado `Meta` de `@uppy/core` e exportado `type ObjectUploaderResult = UploadResult<Meta, Record<string, never>>`. Prop agora recebe esse alias. Sem mudança de runtime.
- **`client/src/components/kit-dialog.tsx` + `client/src/components/product-dialog.tsx`**: atualizados para consumir `ObjectUploaderResult` (em vez do tipo antigo). Lógica de `handleUploadComplete` intocada — continua lendo `result.successful[0].response` como antes. Upload de imagem de produto e kit funcionando normalmente.
- **`client/src/pages/dashboard.tsx:213`**: `<Button variant="link">` não existe no `buttonVariants` do projeto (só `default | destructive | outline | secondary | ghost`). Trocado para `variant="ghost"` com classes utilitárias `text-primary underline-offset-4 hover:underline` para preservar a aparência de link inline. Comportamento de clique (abre URL da notificação) inalterado.
- **`client/src/pages/drivers.tsx`**: `driverFormSchema = insertDriverSchema.extend({...}).omit({ id, createdAt })` tentava re-omitir chaves que `insertDriverSchema` já omite em `shared/schema.ts`, fazendo TS colapsar `DriverFormData` para `never` e propagando 9 erros para todos os `FormField name="..."`. Removida a chamada `.omit` redundante. Schema de validação, lista de campos, submit, criação, edição e upload de CNH preservados (smoke confirma 201 criação + 200 edição).
- **Nenhum `any`/`as any` novo.** Um único alias de tipo exportado (`ObjectUploaderResult`).
- **Sem alteração** em back-end, banco, migrations, endpoints, payloads, autenticação, permissões, regras de negócio ou layout/UX.

## TypeScript Cleanup (2026-05-28) — Fase 1.2
- **Root cause server-side errors**: `shared/schema.ts` had `export const users: any = pgTable(...)`. The `: any` annotation poisoned Drizzle's type inference for every field of `users` (forcing `password`, `active` and related insert types into a degenerate `unknown[] | [any, ...any[]]` shape) and made `db.insert(users).returning()` non-iterable, breaking `auth.ts:128/131`, `routes.ts:2024/2025/2040/2123` and `storage.ts:1381` (createUser destructuring). Removed the `: any`, restoring proper inference.
- **Cascade exposure**: removing `: any` revealed pre-existing latent mismatches — `req.user` is `Omit<User, "password">` (Passport strips it on serialize) but `ownership.ts` functions were typed as full `User`. Introduced a local `type AuthUser = Omit<User, "password">` and used it on `canEditResource`/`canDeleteResource`/`isAdmin`/`getUserInfo`. No call-site changes; only `user.id` is read.
- **`server/routes-optimization.ts`** — corrections aligned with the actual schema, no algorithm changes:
  - `completedAt: true` → `completedAt: new Date()` in 4 spots (success + failure branches of both endpoints). Column is `timestamp("completed_at")`.
  - Decimal columns now receive strings via `.toFixed(2)` (Drizzle's `decimal(...)` insert type is `string`): `confidenceScore`, `utilizationPercentage`, `weightDistributionScore`, `totalDistanceKm`, `fuelEstimateLiters`. Output payload unchanged (PG already returns decimals as strings).
  - `arrivalTime: d.arrivalDateTime` → `.toISOString()` to satisfy `RouteStop.arrivalTime: string`.
  - `.filter(Boolean)` substituído por type predicate `.filter((x): x is string => x !== null)`. Mesmo resultado em runtime.
  - `trip.unloadingLocation ?? undefined` para casar com `string | undefined`.
- **No usage of `any` or `as any` was introduced.** All casts are explicit and local (one `Omit<User, "password">` type alias).
- **Sem alteração** em banco, migrations, payloads de API, nomes de rotas, autenticação, regras de negócio ou front-end.
- **Erros remanescentes em `npm run check`** (frontend, fora do escopo declarado da Fase 1.2): `client/src/components/ObjectUploader.tsx:49`, `client/src/pages/dashboard.tsx:213` (variant `"link"`), `client/src/pages/drivers.tsx:51/52/344/358/372/386/408/422/436`. Não tocados conforme regra do usuário.

## Security Fixes (2026-05-28) — Fase 1.1 Lote A + B
- **Lote A — Proteção de leitura nas rotas GET internas**: aplicado `requireAuth` em 46 rotas GET que estavam públicas. Cobertura: dashboard, eventos, kits, fornecedores, produtos, requisições, veículos, motoristas, docas, viagens, ordens de carregamento, movimentações, devoluções, usuários (todas as 4 declarações duplicadas de `/api/users` agora protegidas), papéis, permissões, otimizações e relatórios de simulação. `/api/user` mantido inalterado (Passport interno). Login/register/forgot-password/reset-password seguem públicas.
- **Lote B — `GET /api/loading-orders/:id/can-edit`**: protegido com `requireAuth`. Última rota GET interna que ainda estava pública agora exige sessão.
- Sem alterações em banco, payloads, regras de negócio ou front-end.

## Security Fixes (2026-05-27)
- **DELETE /api/request-items/:id**: Added authentication check and ownership verification via parent request lookup. Only the request creator (or admin) can delete its items.
- **DELETE /api/suppliers/:id**: Now requires authentication and admin role.
- **DELETE /api/drivers/:id**: Now requires authentication and admin role.
- **PATCH /api/requests/:id**: Removed conditional ownership check (was only enforced for `draft` status). Now always validates owner/admin. Also blocks direct status transitions to approved/rejected — only `draft` and `pending_approval` are allowed here; privileged transitions must go through their dedicated approve/reject routes.
- **POST /api/requests/:id/items**: Added authentication + ownership check (owner of the parent request or admin only).
- Added `getRequestItem(id)` to storage layer (interface + implementation) to support parent-request lookup for ownership validation.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript and Vite. It features a desktop-first responsive design based on Radix UI and shadcn/ui (New York style) with Tailwind CSS. Design principles include Material Design, a custom dark blue/light blue/pink/purple color palette, and the Inter font. Emphasis is placed on information density, keyboard-first interaction, semantic color-coded status badges, data tables, and minimal modal usage.

### Technical Implementations
- **Frontend**: State management is handled by TanStack Query for server state and React Hook Form with Zod for form validation.
- **Backend**: Built with Node.js, Express.js, and TypeScript (ES Modules). It exposes a RESTful API with JSON, featuring route registration, a storage layer abstraction, request logging, and centralized error handling.
- **Database**: Drizzle ORM is used with Neon serverless PostgreSQL, supporting WebSocket and connection pooling. The design is schema-first with migrations.
- **Authentication & Authorization**: Session-based authentication via Passport.js (local strategy), bcrypt for password hashing, `express-session` with PostgreSQL store, role-based access control (RBAC), password recovery, and a user approval system.
- **Key Features**:
    - **Material Request Management**: Supports creation, approval workflows (approve-all, approve-partial, reject-all), item list management, status tracking, and event requisition window enforcement.
    - **Loading Orders**: Consolidates approved material requests into picking lists, including parametric kit expansion (BOM), grouping identical products, and tracking source breakdown.
    - **Warehouse Movements**: Manages loading/unloading operations with a scanner interface, supporting various movement types, status transitions, real-time item tracking, and multi-event association.
    - **Product & Kit Management**: Provides dialogs for editing products and kits, including image upload.
    - **Bulk Import System**: Allows Excel-based bulk import for events, products, and transport planning with data preview, validation, and error reporting.
    - **Notification System**: Comprehensive system with @mention support, in-app notifications, preferences panel, and dashboard display.
    - **Transport Planning**: Manages vehicle types and detailed trip planning with multiple destinations, offering both list and calendar views.
    - **AI-Powered Optimization**: Incorporates 3D bin packing algorithms (First-Fit Decreasing Height) for vehicle loading and nearest neighbor heuristic for route planning, providing distance, duration, fuel estimates, and detailed loading sequences.
    - **Reports Module - Stock Simulation**: Proactive shortage identification by aggregating material needs, comparing against inventory, and identifying potential shortages. Features multi-select filters, status classification (FALTA/CRÍTICO/ADEQUADO), drill-down, and Excel export.
    - **Product Variants & Equivalencies System**: Tracks material ownership (owned, rented, third_party) and automatically resolves supplier-specific SKUs to principal SKUs, ensuring traceability.
    - **Configurable Movement Types System**: Organizes warehouse movements into customizable groups and types, supporting configurable properties like nature, approval requirements, and supplier tracking. Includes a dedicated approval workflow for movements.
    - **Product Status & Location Control System**: Manages product lifecycle states (statuses) and physical locations, allowing for CRUD operations and integration with movement types to control permitted source and target statuses/locations.
    - **Driver Management**: Manages driver registration, including CNH document upload, with full CRUD functionality and CNH validation.
    - **User Approval System**: Manages user registration approval workflows with role-based access control, allowing for pending, approved, and rejected statuses with audit trails.

### System Design Choices
- **Data Model**: Event-centric with robust schemas for material requests, trips, inventory movements, returns, and audit logs. Utilizes PostgreSQL enums for status management.
- **Architectural Patterns**: Employs separation of concerns (client/server/shared), type sharing between frontend and backend, and the Repository pattern. Zod schemas are derived from Drizzle for validation.

## External Dependencies

- **Database**: Neon Serverless PostgreSQL.
- **UI Components**: Radix UI, cmdk, embla-carousel-react, date-fns, lucide-react.
- **Development Tools**: Vite plugins (@replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner).
- **Form & Validation**: React Hook Form, Zod.
- **Styling**: Tailwind CSS, PostCSS.
- **Authentication**: Passport.js, express-session, connect-pg-simple, bcrypt.
- **Object Storage**: Replit Object Storage (utilizing Google Cloud Storage).
- **Excel Export**: SheetJS (xlsx).

---

## Guia de Implementação Futura: Sistema Avançado de Papéis e Permissões

### Visão Geral
Este guia documenta melhorias planejadas para o sistema de gerenciamento de papéis e permissões, baseado em boas práticas de UX, segurança e usabilidade corporativa.

### Problemas da Implementação Atual
- Lista simples sem agrupamento lógico de módulos
- Falta de hierarquia visual entre permissões
- Ausência de busca/filtros eficientes
- Sem indicação de dependências entre permissões
- Processo manual individual para cada checkbox
- Falta de templates ou perfis pré-definidos
- Sem preview do impacto de cada permissão
- Ausência de auditoria (quem alterou, quando)

### Estrutura Proposta

#### Layout Master-Detail
Interface dividida em dois painéis:
- **Painel Esquerdo**: Árvore hierárquica de módulos com indicadores visuais
- **Painel Direito**: Configuração detalhada de permissões com contexto

#### Organização Hierárquica de Módulos

**Categorias Principais:**
1. **OPERACIONAL**: Estoque, Movimentações, Eventos, Localizações
2. **ADMINISTRATIVO**: Usuários, Papéis, Configurações, Relatórios
3. **FINANCEIRO**: Contratos, Custos, Análises
4. **MANUTENÇÃO**: Ordens de Serviço, Histórico, Preventiva

**Indicadores Visuais:**
- [•] = Todas as permissões concedidas
- [◐] = Algumas permissões concedidas
- [○] = Nenhuma permissão concedida
- Contador de permissões: (2/4)

#### Sistema de Permissões Detalhado

**Níveis de Permissão:**
1. **Básicas**: Visualizar, Criar, Editar, Excluir
2. **Avançadas**: Configurações específicas do módulo
3. **Relatórios**: Acesso a diferentes tipos de relatórios

**Informações por Permissão:**
- Descrição clara do que permite
- Dependências (auto-seleção de pré-requisitos)
- Nível de impacto (Baixo, Médio, Alto, Crítico)
- Ícones intuitivos para cada ação

**Sistema de Dependências Automáticas:**
- Criar/Editar/Excluir → Auto-seleciona Visualizar
- Excluir → Requer Editar
- Relatórios → Requer Visualizar do módulo
- Alertas visuais para dependências não atendidas

### Funcionalidades Avançadas

#### Templates Pré-Definidos
1. **Operador Básico**: Visualizar módulos operacionais, criar/editar eventos e movimentações
2. **Supervisor**: Operador Básico + edição de produtos, relatórios gerenciais
3. **Gerente**: Supervisor + administração de usuários, relatórios completos
4. **Administrador**: Acesso total ao sistema

#### Ferramentas de Produtividade
- Busca em tempo real por módulos/permissões
- Seleção em massa por categoria
- Copiar permissões de outro papel
- Exportar/Importar configurações
- Resetar para padrões
- Visualizar como usuário (preview)

#### Resumo e Validação
Modal de confirmação antes de salvar mostrando:
- Módulos com acesso total
- Módulos com acesso parcial
- Módulos sem acesso
- Alertas de segurança para permissões críticas
- Lista de mudanças realizadas

### Sistema de Auditoria

**Rastreamento Completo:**
- Data/hora da alteração
- Usuário que fez a alteração
- Permissões adicionadas
- Permissões removidas
- Templates aplicados
- Histórico completo de modificações

### Códigos Visuais

**Cores por Nível de Acesso:**
- Verde: Acesso total ao módulo
- Amarelo: Acesso parcial ao módulo
- Vermelho: Nenhum acesso ao módulo
- Azul: Permissões administrativas
- Roxo: Permissões de relatórios

**Ícones Padronizados:**
- 👁️ Visualizar | ➕ Criar | ✏️ Editar | 🗑️ Excluir
- 📊 Relatórios | ⚙️ Configuração | 🔐 Admin | ⚠️ Crítico

**Indicadores de Status:**
- ✅ Permissão concedida
- ❌ Permissão negada
- 🔒 Permissão bloqueada (dependência)
- ⚠️ Permissão com impacto alto
- 🔄 Permissão herdada de template

### Benefícios Esperados

**Para Administradores:**
- Configuração 70% mais rápida com templates
- Visão clara e estruturada de permissões
- Auditoria completa de alterações
- Prevenção de erros com validação automática

**Para Segurança:**
- Controle granular de acessos
- Rastreabilidade total de mudanças
- Alertas para permissões críticas
- Validação antes de aplicar mudanças

**Para Usuários:**
- Interface intuitiva e organizada
- Feedback claro sobre permissões
- Menos erros de configuração
- Melhor experiência geral

### Implementação Técnica Sugerida

**Backend:**
- Expandir tabela `permissions` com campos: `module`, `category`, `impact_level`, `dependencies`
- Criar tabela `permission_templates` para perfis pré-definidos
- Implementar auditoria em tabela `permission_audit_log`
- API para validação de dependências

**Frontend:**
- Componente de árvore hierárquica (React)
- Sistema de busca/filtro em tempo real
- Modal de confirmação com resumo
- Componente de histórico de auditoria
- Sistema de notificações para mudanças críticas

**Estado Atual (Phase 1):**
- ✅ Ownership-based permissions implementado
- ✅ Admin override funcional
- ✅ Validação dupla (UI + backend)
- ✅ Sistema básico de roles via userRoles table

**Próximas Fases:**
- Phase 2: Implementar hierarquia de roles e herança de permissões
- Phase 3: Sistema de auditoria completo
- Phase 4: Templates e seleção em massa
- Phase 5: Interface avançada master-detail
- Phase 6: Sistema de dependências automáticas

---
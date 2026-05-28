# EventFlow Logistics - Event Material Management System

## Overview
EventFlow Logistics is a web application designed to streamline event material management, from requisition and inventory tracking to multi-vehicle loading and reverse logistics. It operates under an "event umbrella" model, organizing all material-related activities by event. The system aims to reduce operational overhead, provide real-time visibility, and support various teams including planning, operations, scenography, warehouse, driving, and inventory management. Key capabilities include cutoff deadlines, parametric kit explosion, time-phased inventory projection, and detailed damage/loss tracking for returns.

## User Preferences
Preferred communication style: Simple, everyday language.

## Estado Atual (2026-05-28)

- **Autenticação**: toda rota interna (leitura e escrita) exige login.
- **Autorização (ownership)**: criador ou admin podem editar/excluir os recursos sensíveis (requests, trips, loading-orders, movements).
- **Autorização (RBAC funcional)**: middlewares `requireAdmin` / `requireAnyRole` aplicados em rotas administrativas, de configuração, de logística (trips/drivers/vehicles/docks), de catálogo (products/kits/suppliers) e de ordens de carregamento.
- **Fonte única de `isAdmin`**: `shared/roles.ts:isAdminRoleName` (case-insensitive, reconhece `Adm`/`admin`), re-exportada por `server/ownership.ts` e consumida pelo front via `client/src/lib/authz.ts`.
- **Front-end**: UX defensiva — botões de escrita escondidos por papel, leitura mantida para qualquer logado. Back-end continua a fonte da verdade.
- **Qualidade**: `npm run check` zerado, `npm run build` passando, CI em `.github/workflows/ci.yml` rodando `npm ci` → `check` → `build` em push/PR.

## Histórico de Fases

### Fase 1 — Endurecimento da base (concluída em 2026-05-28)
- Ownership-based permissions; rotas POST/PATCH/DELETE sensíveis exigem auth + dono ou admin.
- `requireAuth` aplicado em 46+ rotas GET internas antes públicas.
- `npm run check` zerado em back-end e front-end.
- Correção do bug de comparação `'admin'` vs `'Adm'` (case-insensitive, fonte única `isAdminRoleName`).
- Duplicações inalcançáveis removidas.
- CI básico ativo.
- **Detalhes**: [`docs/CHANGELOG-fase1.md`](docs/CHANGELOG-fase1.md).

### Fase 2 — RBAC progressivo (em andamento)
- **2.0**: planejamento (matriz papel × módulo × ação; endpoint × papel mínimo para 137 endpoints).
- **2.1**: infraestrutura mínima (`shared/roles.ts`, `server/authz.ts`, middlewares `requireRole`/`requireAnyRole`/`requireAdmin`; super-admin opcional via `EMERGENCY_ADMIN_USERNAME`).
- **2.2**: `requireAdmin` em 33 rotas administrativas e de configuração; auto-cadastro público preservado; `PATCH /api/users/:id` recebeu auth pela primeira vez (correção de hole crítico).
- **2.2.1**: `GET /api/users/mention-lookup` (payload mínimo) para preservar @mentions após `requireAdmin` em `/api/users`.
- **2.3**: role `LOGISTICA` adicionada; `requireAnyRole([ADMIN, LOGISTICA])` em 10 rotas de escrita (trips, drivers, vehicles, docks, loading-orders/trips); ownership preservado.
- **2.3.1**: front-end alinhado — `client/src/lib/authz.ts`, `ProtectedRoute.requireAdmin`, sidebar filtrada, botões de escrita gated.
- **2.4 / 2.4.1 / 2.4.2**: `requireAdmin` em 9 rotas de catálogo (products/kits/suppliers); padronização de auth em `/suppliers/recent` e `/products/:sku/recent-suppliers`; correção de bug de ordem de rotas e bug SQL latente em `getRecentSuppliers`.
- **2.5.1**: RBAC em loading-orders — 3 holes críticos fechados (`mark-ready`, `approve`, `disapprove` agora autenticados); `requireAnyRole([ADMIN, LOGISTICA])` em 5 rotas; `requireAdmin` em approve/disapprove (provisório até existir Supervisor).
- **2.5.2** (2026-05-28): limpeza de documentação — `replit.md` enxugado, histórico detalhado consolidado em `docs/CHANGELOG-fase1.md` e `docs/CHANGELOG-fase2.md`. Sem alteração funcional.
- **2.6** (2026-05-28): planejamento das roles funcionais Almoxarifado e Supervisor — diagnóstico, matriz revisada, plano de fases e 11 decisões aprovadas. Sem código alterado.
- **2.6.1** (2026-05-28): base das novas roles — canônicos `ROLES.ALMOXARIFADO`/`ROLES.SUPERVISOR` + aliases em `shared/roles.ts`; script idempotente `server/seed-roles.ts` (rodar via `npx tsx server/seed-roles.ts`); 2 roles criadas no banco com `description` preenchida, 0 usuários vinculados, nenhum endpoint aplicando ainda.
- **2.6.2** (2026-05-28): RBAC efetivo em loading-orders — `items`/`mark-ready` para `[ADMIN, LOGISTICA, ALMOXARIFADO]`; `approve`/`disapprove` saem de `requireAdmin` provisório e passam a `[ADMIN, SUPERVISOR]`. Front-end fica para 2.6.3.
- **2.6.3** (2026-05-28): front-end de loading-orders alinhado — helpers `userIsAlmoxarifado`/`userIsSupervisor`/`userCanHandleLoadingOrderItems`/`userCanMarkLoadingOrderReady`/`userCanApproveLoadingOrder` em `client/src/lib/authz.ts`; em `loading-order-details.tsx`, "Marcar como Pronta" passa a aceitar Almoxarifado e "Aprovar"/"Desaprovar" passam a aceitar Supervisor. Demais telas (lista, dialog de criação/edição, dialog de otimização) já estavam corretas.
- **Detalhes**: [`docs/CHANGELOG-fase2.md`](docs/CHANGELOG-fase2.md).

- **2.7** (2026-05-28): auditoria completa de movimentações (11 seções; 6 holes de escrita identificados; matriz papel × ação; 11 decisões aprovadas pelo usuário: D1 leitura comum, D2 Almoxarifado em itens, D3 Logística fora, D4 Supervisor em approve/reject, D5 cancel = Admin/Almox-dono, D6 ninguém cria `pending_approval`, D7 PATCH /status admin-only, D8 escape ownership, D9 audit logs autenticados, D10 esconder "Editar Status" no front, D11 audit no decrement adiado). Sem código alterado.
- **2.8.1** (2026-05-28): RBAC efetivo em 6 rotas críticas de movimentações — `POST/PATCH/DELETE` em items → `[ADMIN, ALMOXARIFADO]`; `PATCH /:id/status` → `requireAdmin()`; `POST /approve`/`/reject` → `[ADMIN, SUPERVISOR]`. Smoke matrix 6×5 (30 cenários) validado; front e demais rotas intactos.
- **2.8.2** (2026-05-28): RBAC nas 3 rotas médias de movimentações — `POST /api/movements` → `[ADMIN, ALMOXARIFADO]`; `PATCH /api/movements/:id` → `[ADMIN, ALMOXARIFADO]` + correção do ownership escape (D8) e do escape de status via PATCH geral; `GET /api/movements/pending-approval` → `[ADMIN, SUPERVISOR]`. Smoke matrix 7×5 (35 cenários) validado; front e demais rotas intactos.
- **2.8.3** (2026-05-28): front-end de movimentações alinhado — 6 helpers novos em `authz.ts`; botões de escrita (create, edit, status, items, aprovações) e scanner gated por persona; sidebar oculta link de aprovações de movimentações para não-Admin/Supervisor. `npm run check` e `build` zerados. Back-end inalterado.
- **2.8.4** (2026-05-28): audit log no decremento — rota `PATCH /api/movements/:id/items/:itemId/decrement` agora registra `movement_audit_logs` com `action: "item_quantity_changed"`, `actorId`, `actorName`, `metadata` (previousQuantity, newQuantity, quantityDecremented, productName, sku, ownerName, ownerType). Padrão existente `createMovementAuditLog` reutilizado. Smoke tests 5×5 validados (Admin/Almox passam; Supervisor/Comum/Anônimo rejeitados). Dados restaurados. `npm run check` e `build` zerados. Dívida técnica do `PATCH /status` documentada (rota Admin-only provisória; no futuro deve ser substituída por transições explícitas).

- **2.9** (2026-05-28): auditoria de Devoluções — 2 rotas identificadas (GET/POST). `GET /api/returns` com `requireAuth`. `POST /api/returns` **sem nenhuma proteção** (hole crítico). Módulo é registro passivo de constatação (tripId, productId, quantidades, avaria, perda). Sem status, processamento, aprovação, impacto em estoque, audit log. Nenhum código alterado.
- **2.10** (2026-05-28): RBAC mínimo em Devoluções — `POST /api/returns` recebeu `requireAnyRole([ADMIN, ALMOXARIFADO])`. Smoke tests 6×2 (12 cenários) validados: Admin/Almox criam; Logística/Supervisor/Comum rejeitados; Anônimo 401. Dados de smoke restaurados. `npm run check` e `build` zerados. Nenhuma rota nova, botão, dialog, status, front-end, banco ou schema alterado.

### Próximas fases (planejadas)
- **Fases futuras** (roadmap de longo prazo): hierarquia de roles, sistema de auditoria, templates, interface master-detail, dependências automáticas. Roadmap detalhado em [`docs/RBAC-future-guide.md`](docs/RBAC-future-guide.md).

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18 with TypeScript and Vite. It features a desktop-first responsive design based on Radix UI and shadcn/ui (New York style) with Tailwind CSS. Design principles include Material Design, a custom dark blue/light blue/pink/purple color palette, and the Inter font. Emphasis is placed on information density, keyboard-first interaction, semantic color-coded status badges, data tables, and minimal modal usage.

### Technical Implementations
- **Frontend**: TanStack Query for server state; React Hook Form + Zod for forms.
- **Backend**: Node.js, Express.js, TypeScript (ES Modules), RESTful API with JSON, storage layer abstraction, centralized error handling.
- **Database**: Drizzle ORM with Neon serverless PostgreSQL (WebSocket + connection pooling); schema-first with migrations.
- **Authentication & Authorization**: Passport.js (local strategy), bcrypt, `express-session` com PostgreSQL store, RBAC, password recovery, user approval system.
- **Key Features**:
    - **Material Request Management**: criação, fluxos de aprovação (all/partial/reject), itens, status, janela de requisição por evento.
    - **Loading Orders**: consolidação de requests aprovados em picking lists, expansão paramétrica de kits (BOM), agrupamento e breakdown por origem.
    - **Warehouse Movements**: carregamento/descarregamento via scanner, tipos configuráveis, transições de status, multi-evento.
    - **Product & Kit Management**: edição com upload de imagem.
    - **Bulk Import System**: importação Excel para events, products e planejamento de transporte, com preview e validação.
    - **Notification System**: @mentions, notificações in-app, preferências e dashboard.
    - **Transport Planning**: tipos de veículo e planejamento de viagens com múltiplos destinos (list + calendar).
    - **AI-Powered Optimization**: 3D bin packing (First-Fit Decreasing Height) para carregamento e nearest-neighbor para rota; distância, duração, combustível e sequência de carregamento.
    - **Reports — Stock Simulation**: identificação proativa de faltas (FALTA/CRÍTICO/ADEQUADO) com filtros multi-select, drill-down e export Excel.
    - **Product Variants & Equivalencies**: ownership (owned/rented/third_party) e resolução de SKU fornecedor → SKU principal.
    - **Configurable Movement Types**: grupos e tipos customizáveis com regras de natureza, aprovação e fornecedor.
    - **Product Status & Location Control**: estados e locais físicos com CRUD e integração a tipos de movimento.
    - **Driver Management**: cadastro, upload de CNH e validação.
    - **User Approval System**: workflow pending/approved/rejected com audit trail.

### System Design Choices
- **Data Model**: event-centric; schemas para requests, trips, movements, returns, audit logs; enums PostgreSQL para status.
- **Architectural Patterns**: separação client/server/shared, type sharing, Repository pattern, Zod derivado do Drizzle.

## External Dependencies

- **Database**: Neon Serverless PostgreSQL.
- **UI Components**: Radix UI, cmdk, embla-carousel-react, date-fns, lucide-react.
- **Development Tools**: Vite plugins (@replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner).
- **Form & Validation**: React Hook Form, Zod.
- **Styling**: Tailwind CSS, PostCSS.
- **Authentication**: Passport.js, express-session, connect-pg-simple, bcrypt.
- **Object Storage**: Replit Object Storage (Google Cloud Storage).
- **Excel Export**: SheetJS (xlsx).

## Documentos relacionados

- [`docs/CHANGELOG-fase1.md`](docs/CHANGELOG-fase1.md) — histórico detalhado da Fase 1.
- [`docs/CHANGELOG-fase2.md`](docs/CHANGELOG-fase2.md) — histórico detalhado da Fase 2.
- [`docs/RBAC-future-guide.md`](docs/RBAC-future-guide.md) — roadmap de longo prazo do sistema de papéis e permissões.
- [`docs/PRODUCT_VARIANTS_PLAN.md`](docs/PRODUCT_VARIANTS_PLAN.md) — plano do sistema de variantes/equivalências de produto.
- [`docs/controle-status-movimentacoes.md`](docs/controle-status-movimentacoes.md) — controle de status de movimentações.

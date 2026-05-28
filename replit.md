# EventFlow Logistics - Event Material Management System

## Overview
EventFlow Logistics is a web application designed to streamline event material management, from requisition and inventory tracking to multi-vehicle loading and reverse logistics. It operates under an "event umbrella" model, organizing all material-related activities by event. The system aims to reduce operational overhead, provide real-time visibility, and support various teams including planning, operations, scenography, warehouse, driving, and inventory management. Key capabilities include cutoff deadlines, parametric kit explosion, time-phased inventory projection, and detailed damage/loss tracking for returns. The project's ambition is to optimize event logistics through comprehensive, integrated management.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (2025-11-01)
- **Ownership-Based Permissions (Phase 1)**: Implemented resource ownership control where only the creator (or admins) can edit/delete resources. Converted requestedBy/createdBy fields from text to FK references to users.id. Created server/ownership.ts with canEditResource/canDeleteResource utilities that check admin role OR resource ownership. Updated all POST routes to auto-populate creator from authenticated user. Added ownership checks to PATCH/DELETE routes for requests, trips, loading orders, and movements. Updated frontend request-details page to show/hide edit/delete buttons based on ownership verification.

## Fase 1 — Endurecimento da base (concluída em 2026-05-28)

Sub-fases 1.0 a 1.6 estabilizaram a base do sistema antes da Fase 2 (matriz de papéis funcionais):

- **Fase 1**: ownership-based permissions; rotas POST/PATCH/DELETE sensíveis exigem autenticação + dono ou admin; criados `server/ownership.ts` e `getRequestItem(id)`; campos `requestedBy`/`createdBy` migrados para FK `users.id`.
- **Fase 1.1**: `requireAuth` em 46+ rotas GET internas que estavam públicas; última GET interna pública (`/api/loading-orders/:id/can-edit`) também fechada.
- **Fase 1.2**: zerado `npm run check` no back-end (removido `: any` poluindo inferência da tabela `users`; ajustes em `routes-optimization.ts`; `AuthUser = Omit<User, "password">` em `ownership.ts`).
- **Fase 1.3**: zerado `npm run check` no front-end (`ObjectUploader`/`kit-dialog`/`product-dialog`, variant `link` no `dashboard.tsx`, schema redundante em `drivers.tsx`).
- **Fase 1.4**: corrigido 403 indevido para admin (role no seed é `Adm`/pt-BR, código comparava `'admin'`); comparação agora case-insensitive em `ownership.ts` e `auth.ts`.
- **Fase 1.5**: removidas 2 declarações inalcançáveis de `GET /api/users` em `routes.ts`; fonte única `isAdminRoleName(name)` em `ownership.ts` consumida também por `auth.ts`.
- **Fase 1.6**: CI básico em `.github/workflows/ci.yml` rodando `npm ci` → `npm run check` → `npm run build` em push/PR; histórico detalhado consolidado em `docs/CHANGELOG-fase1.md`.

**Histórico detalhado de cada sub-fase**: ver [`docs/CHANGELOG-fase1.md`](docs/CHANGELOG-fase1.md).

**Estado atual**:
- Toda escrita interna exige autenticação + ownership/admin.
- Toda leitura interna exige autenticação.
- `npm run check` zerado; `npm run build` passando; CI ativo.
- `isAdmin` em uma única fonte da verdade (`server/ownership.ts:isAdminRoleName`).

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
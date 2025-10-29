# EventFlow Logistics - Event Material Management System

## Overview
EventFlow Logistics is a comprehensive web application for managing event logistics, focusing on material requisition, inventory tracking, multi-vehicle loading, and reverse logistics. It operates under an "event umbrella" model, organizing all material requests, trips, and returns by event for efficient coordination. The system targets planning, operations, scenography, warehouse, driving, and inventory management teams. Its primary purpose is to streamline event material management, reduce operational overhead, and provide real-time visibility across all logistical phases through features like cutoff deadlines, parametric kit explosion, time-phased inventory projection, and detailed damage/loss tracking for returns.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks**: React 18 with TypeScript, Vite, Wouter.
- **UI/UX**: Desktop-first responsive design using Radix UI and shadcn/ui (New York style) with Tailwind CSS. Incorporates Material Design principles, a custom dark blue/light blue/pink/purple color palette, and the Inter font. Prioritizes information density, keyboard-first interaction, semantic color-coded status badges, data tables, and minimal use of modals.
- **State Management**: TanStack Query for server state, React Hook Form with Zod for form validation.

### Backend
- **Runtime**: Node.js with Express.js, TypeScript (ES Modules).
- **API Design**: RESTful API with JSON, route registration, storage layer abstraction, request logging, centralized error handling.
- **Database**: Drizzle ORM, Neon serverless PostgreSQL with WebSocket support, connection pooling, schema-first design with migrations.
- **Schema Design Highlights**: Event-centric data model, material requests with area segmentation, trips linked to events/vehicles/drivers/docks, parametric kit system, detailed inventory movement tracking, return records with damage/loss, audit logs, PostgreSQL enums for status.
- **Architectural Patterns**: Separation of concerns (client/server/shared), type sharing, Repository pattern, Zod schemas from Drizzle, ORM relations.

### Key Features
- **Authentication & Authorization**: Session-based authentication using Passport.js (local strategy), bcrypt for password hashing, `express-session` with PostgreSQL store, role-based access control (RBAC), and password recovery.
- **Material Request Management**: Supports creation, approval workflows (approve-all, approve-partial, reject-all), item list management with product/kit addition, status tracking, and event requisition window enforcement.
- **Loading Orders**: Consolidates approved material requests into picking lists, supporting parametric kit expansion (BOM), grouping identical products, and tracking source breakdown. Features a multi-stage status workflow.
- **Warehouse Movements (Carga e Descarga)**: Manages loading/unloading operations with a scanner interface. Supports various movement types, status transitions, real-time item tracking, and multi-event association. Provides detailed views for expected vs. loaded items, product search, and comprehensive filtering.
- **Product & Kit Management**: Dialogs for editing products and kits, including image upload functionality.
- **Bulk Import System**: Excel-based bulk import for events, products, and transport planning (trips). Features file upload, data preview with validation, automatic type conversion, detailed error reporting, and partial import support.
- **Event Enhancements**: Events include `sku`, `requestWindowStart`, and `requestWindowEnd` fields to control material requisition periods.
- **Notification System**: Comprehensive system with @mention support in comments, in-app notifications with unread count indicator, notification preferences panel for email settings, and dashboard display. Supports mark-as-read functionality and real-time updates.
- **Transport Planning**: Overhauled system with vehicle type management, detailed trip planning with multiple destinations, and a dual-view display (list and calendar/agenda view) for trips. Calendar view categorizes trips by loading and unloading dates with distinct visual indicators.
- **AI-Powered Optimization**: Advanced optimization system for vehicle loading and route planning. Vehicle loading optimization uses 3D bin packing algorithms (First-Fit Decreasing Height strategy) to maximize space utilization and weight distribution. Route optimization employs nearest neighbor heuristic for multi-stop trip planning with distance, duration, and fuel estimates. Features optimization run tracking, confidence scoring, warnings, recommendations, and detailed loading sequences with layer-based positioning.
- **Reports Module - Stock Simulation**: Comprehensive stock simulation system for proactive shortage identification. Aggregates material needs from multiple events and material requests, compares against current inventory levels, and identifies potential shortages before event execution. Features multi-select filters (events, requests, date range, status), status classification (FALTA/CRÍTICO/ADEQUADO), drill-down by event breakdown, Excel export with multiple worksheets, and real-time search/filtering capabilities.
- **Configurable Movement Types System (Phase 1)**: Fully implemented configurable movement types system that organizes warehouse movements into groups and types. Features include:
  - **Movement Groups**: 5 pre-configured groups (Operações Logísticas, Controle de Qualidade, Terceiros, Ajustes e Correções, Transferências Internas) with purpose classification, color coding, and emoji icons. CRUD operations via card-based UI.
  - **Movement Types Config**: ~20 pre-seeded movement types with configurable properties: name, description, nature (entrada/saída/transferência/ajuste), group assignment, supplier tracking (supplier_name, supplier_notes), product variant support (equivalent_sku), and **requires_approval** flag for approval workflow control. Table-based UI with filters by group, nature, and active status.
  - **Database Schema**: New enums (movement_group_purpose, movement_nature, batch_ownership_type, movement_status with pending_approval), tables (movement_groups, movement_types_config, batch_lots), and backward-compatible movement_type_config_id field in movements table. Approval tracking fields (approved_by, approved_at, rejected_by, rejected_at, rejection_reason) in movements table.
  - **Backend**: Storage layer with CRUD methods, REST API endpoints with validation, and seed script for initial data population. Approval workflow methods (listPendingMovements, approveMovement, rejectMovement) with authenticated endpoints.
  - **Frontend**: Three responsive pages (/config/movement-groups, /config/movement-types, /movement-approvals) with full CRUD, filtering, and navigation integration via collapsible "Aprovações" submenu grouping requisitions and movements. Movement creation dialog uses configurable types with visual indicator (⚠️) for approval-required types. Movement list displays movementTypeConfig.name instead of legacy type enum.
  - **Approval Workflow**: Movements with requires_approval=true are created with status "pending_approval" and bypass inventory changes. Approval action changes status to "created" and records approver/timestamp. Rejection changes status to "cancelled" with required reason. Both actions create audit log entries.
  - **Future Phases**: System prepared for batch/lot tracking with batch_lots table and ownership types (próprio, terceiro, consignado).

## External Dependencies

- **Database**: Neon Serverless PostgreSQL, Drizzle Kit.
- **UI Components**: Radix UI, cmdk, embla-carousel-react, date-fns, lucide-react.
- **Development Tools**: Vite plugins (@replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner).
- **Form & Validation**: React Hook Form, Zod, @hookform/resolvers.
- **Styling**: Tailwind CSS, PostCSS, class-variance-authority, clsx, tailwind-merge.
- **Authentication**: Passport.js, express-session, connect-pg-simple, bcrypt.
- **Object Storage**: Replit Object Storage (Google Cloud Storage).
- **Excel Export**: SheetJS (xlsx) for multi-worksheet Excel report generation.
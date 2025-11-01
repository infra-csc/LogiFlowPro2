# EventFlow Logistics - Event Material Management System

## Overview
EventFlow Logistics is a web application designed to streamline event material management, from requisition and inventory tracking to multi-vehicle loading and reverse logistics. It operates under an "event umbrella" model, organizing all material-related activities by event. The system aims to reduce operational overhead, provide real-time visibility, and support various teams including planning, operations, scenography, warehouse, driving, and inventory management. Key capabilities include cutoff deadlines, parametric kit explosion, time-phased inventory projection, and detailed damage/loss tracking for returns. The project's ambition is to optimize event logistics through comprehensive, integrated management.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (2025-11-01)
- **Ownership-Based Permissions (Phase 1)**: Implemented resource ownership control where only the creator (or admins) can edit/delete resources. Converted requestedBy/createdBy fields from text to FK references to users.id. Created server/ownership.ts with canEditResource/canDeleteResource utilities that check admin role OR resource ownership. Updated all POST routes to auto-populate creator from authenticated user. Added ownership checks to PATCH/DELETE routes for requests, trips, loading orders, and movements. Updated frontend request-details page to show/hide edit/delete buttons based on ownership verification.

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
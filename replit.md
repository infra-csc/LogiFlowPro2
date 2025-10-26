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

## External Dependencies

- **Database**: Neon Serverless PostgreSQL, Drizzle Kit.
- **UI Components**: Radix UI, cmdk, embla-carousel-react, date-fns, lucide-react.
- **Development Tools**: Vite plugins (@replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner).
- **Form & Validation**: React Hook Form, Zod, @hookform/resolvers.
- **Styling**: Tailwind CSS, PostCSS, class-variance-authority, clsx, tailwind-merge.
- **Authentication**: Passport.js, express-session, connect-pg-simple, bcrypt.
- **Object Storage**: Replit Object Storage (Google Cloud Storage).
# EventFlow Logistics - Event Material Management System

## Overview
EventFlow Logistics is a comprehensive web application for managing event logistics, focusing on material requisition, inventory tracking, multi-vehicle loading, and reverse logistics. It operates under an "event umbrella" model, organizing all material requests, trips, and returns by event for efficient coordination. The system targets planning, operations, scenography, warehouse, driving, and inventory management teams. Its primary purpose is to streamline event material management, reduce operational overhead, and provide real-time visibility across all logistical phases through features like cutoff deadlines, parametric kit explosion, time-phased inventory projection, and detailed damage/loss tracking for returns.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks**: React 18 with TypeScript, Vite, Wouter.
- **UI/UX**: Desktop-first responsive design, Radix UI, shadcn/ui (New York style), Tailwind CSS, Material Design principles, custom dark blue/light blue/pink/purple color palette, Inter font. Prioritizes information density, keyboard-first interaction, semantic color-coded status badges, data tables, and minimal use of modals.
- **State Management**: TanStack Query for server state, React Hook Form with Zod for form validation.

### Backend
- **Runtime**: Node.js with Express.js, TypeScript (ES Modules).
- **API Design**: RESTful API with JSON, route registration, storage layer abstraction, request logging, centralized error handling.
- **Database**: Drizzle ORM, Neon serverless PostgreSQL with WebSocket support, connection pooling, schema-first design with migrations.
- **Schema Design Highlights**: Event-centric data model, material requests with area segmentation, trips linked to events/vehicles/drivers/docks, parametric kit system, detailed inventory movement tracking, return records with damage/loss, audit logs, PostgreSQL enums for status.
- **Architectural Patterns**: Separation of concerns (client/server/shared), type sharing, Repository pattern, Zod schemas from Drizzle, ORM relations.

### Key Features
- **Authentication & Authorization**: Session-based authentication using Passport.js (local strategy), bcrypt for password hashing, `express-session` with PostgreSQL store, role-based access control (RBAC). Includes a password recovery system with secure tokens and expiration.
- **Material Request Management**: Creation, approval workflow (approve-all, approve-partial, reject-all), item list management with product/kit addition, status tracking, and event requisition window enforcement (start/end dates for submissions).
- **Loading Orders**: System for consolidating approved material requests into picking lists. Supports parametric kit expansion (BOM), grouping identical products, and tracking source breakdown. Features a multi-stage status workflow (draft, ready, approved, in_progress, completed, cancelled).
- **Warehouse Movements (Carga e Descarga)**: Module for managing loading/unloading operations with a scanner interface. Supports various movement types (outbound_event, inbound_event, etc.), status transitions, and real-time item tracking. The details page provides a side-by-side view of expected vs. loaded items, product search with autocomplete, progress bars, clickable expected items for quick scanning, and alerts for quantity overages or exceeded items. Features unit-level unload controls: "-" button to decrement quantity by 1 (auto-removes when reaching 0), and "X" button to remove item completely regardless of quantity. Loaded items are consolidated by product, displaying a single line per product with total quantity even when multiple database records exist for the same product. When a movement is associated with a loading order, products loaded that are not included in the order are visually flagged with amber background/border styling and a warning badge reading "Produto não consta na ordem".
- **Product & Kit Management**: Dedicated dialogs for editing products and kits, including image upload functionality (Replit Object Storage via presigned URLs) and handling of various field types.
- **Bulk Import System**: Excel-based bulk import functionality for both events and products. Features file upload, data preview with validation, automatic type conversion (dates, numbers to strings), detailed error reporting with row-by-row feedback, and partial import support. Backend endpoints (POST /api/events/bulk, POST /api/products/bulk) handle array processing with individual validation and return detailed success/error results (201 for full success, 207 for partial success).
- **Event Enhancements**: Events include `sku`, `requestWindowStart`, and `requestWindowEnd` fields to control material requisition periods. Bulk import supports all event fields including optional requisition windows and notes.

## External Dependencies

- **Database**: Neon Serverless PostgreSQL, Drizzle Kit.
- **UI Components**: Radix UI, cmdk, embla-carousel-react, date-fns, lucide-react.
- **Development Tools**: Vite plugins (@replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner).
- **Form & Validation**: React Hook Form, Zod, @hookform/resolvers.
- **Styling**: Tailwind CSS, PostCSS, class-variance-authority, clsx, tailwind-merge.
- **Authentication**: Passport.js, express-session, connect-pg-simple, bcrypt.
- **Object Storage**: Replit Object Storage (Google Cloud Storage).
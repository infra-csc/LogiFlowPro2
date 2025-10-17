# EventFlow Logistics - Event Material Management System

## Overview
EventFlow Logistics is a comprehensive web application for managing event logistics, focusing on material requisition, inventory tracking, multi-vehicle loading, and reverse logistics. It operates under an "event umbrella" model, organizing all material requests, trips, and returns by event for efficient coordination. The system targets planning, operations, scenography, warehouse, driving, and inventory management teams, emphasizing efficiency through features like cutoff deadlines, parametric kit explosion (BOM), time-phased inventory projection, and detailed damage/loss tracking for returns. The project's ambition is to streamline event material management, reduce operational overhead, and provide real-time visibility across all logistical phases.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Frameworks**: React 18 with TypeScript, Vite for bundling, Wouter for routing.
- **UI/UX**: Desktop-first responsive design, Radix UI primitives, shadcn/ui (New York style), Tailwind CSS, Material Design principles, custom dark blue/light blue/pink/purple color palette, Inter font.
- **State Management**: TanStack Query for server state, React Hook Form with Zod for form validation.
- **Key Design Decisions**: Prioritizes information density, keyboard-first interaction, semantic color-coded status badges, data tables for list views, minimal use of modals.

### Backend Architecture
- **Runtime**: Node.js with Express.js, TypeScript (ES Modules).
- **API Design**: RESTful API with JSON, route registration, storage layer abstraction, request logging, centralized error handling.
- **Database**: Drizzle ORM, Neon serverless PostgreSQL with WebSocket support, connection pooling, schema-first design with migrations.
- **Schema Design Highlights**: Event-centric data model, material requests with area segmentation, trips linked to events/vehicles/drivers/docks, parametric kit system, detailed inventory movement tracking, return records with damage/loss, audit logs, PostgreSQL enums for status.
- **Key Architectural Patterns**: Separation of concerns (client/server/shared), type sharing, Repository pattern, Zod schemas from Drizzle, ORM relations.

### System Features and Implementations
- **Authentication & Authorization**: Passport.js with local strategy, bcrypt for password hashing, `express-session` with PostgreSQL store, role-based access control (RBAC) with granular page permissions, session-based authentication.
- **Material Request Management**: Simplified request creation, dedicated details page (`/requests/:id`), status-based access control (draft, pending approval), item list management with product/kit addition, automatic item saving, request submission workflow.
- **Request Status & User Info**: `submittedAt` timestamp for requests, requester's name displayed, date formatting (`dd/MM/yyyy, HH:mm`), dynamic UI based on request status.
- **Product & Kit Image Upload**: Integration with Replit Object Storage (Google Cloud Storage), presigned PUT URLs for client-side uploads via Uppy, backend endpoints for image upload/serving/normalization, public ACL for images, image preview and removal, consistent image display across product/kit cards with fallbacks.

## External Dependencies

- **Database**: Neon Serverless PostgreSQL, Drizzle Kit.
- **UI Components**: Radix UI, cmdk, embla-carousel-react, date-fns, lucide-react.
- **Development Tools**: Vite plugins (@replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner).
- **Form & Validation**: React Hook Form, Zod, @hookform/resolvers.
- **Styling**: Tailwind CSS, PostCSS, class-variance-authority, clsx, tailwind-merge.
- **Authentication**: Passport.js, express-session, connect-pg-simple, bcrypt.
- **Object Storage**: Replit Object Storage (Google Cloud Storage).
- **File Upload Client**: Uppy (implicitly used via `ObjectUploader`).
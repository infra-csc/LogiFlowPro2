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
- **Material Request Approval System** (Oct 17, 2025): Complete approval workflow supporting approve-all, approve-partial (item-by-item with custom quantities), and reject-all operations. Backend implements three POST endpoints (`/api/requests/:id/approve-all`, `/api/requests/:id/approve-partial`, `/api/requests/:id/reject-all`) with transaction-based updates to request and item statuses. Frontend provides two pages: `/approvals` (list view of pending requests) and `/approvals/:id` (detailed approval interface with item selection, per-item approval/rejection, quantity adjustment, and rejection reason capture). Schema includes `itemApprovalStatusEnum` (pending/approved/rejected), item-level fields (`approvalStatus`, `approvedQuantity`, `rejectionReason`), and request-level status updates (partially_approved when some items approved/rejected). E2E tested via Playwright confirming partial and full approval flows.
- **Request Status & User Info**: `submittedAt` timestamp for requests, requester's name displayed, date formatting (`dd/MM/yyyy, HH:mm`), dynamic UI based on request status.
- **Product & Kit Image Upload**: Integration with Replit Object Storage (Google Cloud Storage), presigned PUT URLs for client-side uploads via Uppy, backend endpoints for image upload/serving/normalization, public ACL for images, image preview and removal, consistent image display across product/kit cards with fallbacks.
- **Product & Kit Edit Dialogs**: useEffect hooks reset form state when dialogs open or entities change, ensuring all fields pre-fill correctly on edit. Product dialog handles numeric fields (weight, stock) properly. Kit dialog includes dynamic field (Unit for number type, Options for select type) that converts between CSV strings and arrays. Both dialogs tested with e2e playwright tests.

### Critical Bug Fixes & Learnings
- **apiRequest Response Handling** (Fixed Oct 17, 2025): The `apiRequest` function in `client/src/lib/queryClient.ts` returns a `Response` object, NOT parsed JSON. Must call `.json()` before accessing response data. Fixed in product-dialog.tsx and kit-dialog.tsx where upload parameter retrieval was failing with "Cannot upload to an undefined URL" because `response.uploadURL` was undefined - should be `(await response.json()).uploadURL`.
- **HTML Entity Decoding in Signed URLs**: Replit sidecar returns presigned URLs with HTML entities (`&amp;` instead of `&`). These are decoded server-side using `.replace(/&amp;/g, '&')` before sending to frontend.
- **Cache Synchronization Pattern**: After image uploads, parent pages (products.tsx, kits.tsx) use useEffect to monitor query data changes and update selected entity state, ensuring UI reflects backend updates immediately.

## External Dependencies

- **Database**: Neon Serverless PostgreSQL, Drizzle Kit.
- **UI Components**: Radix UI, cmdk, embla-carousel-react, date-fns, lucide-react.
- **Development Tools**: Vite plugins (@replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner).
- **Form & Validation**: React Hook Form, Zod, @hookform/resolvers.
- **Styling**: Tailwind CSS, PostCSS, class-variance-authority, clsx, tailwind-merge.
- **Authentication**: Passport.js, express-session, connect-pg-simple, bcrypt.
- **Object Storage**: Replit Object Storage (Google Cloud Storage).
- **File Upload Client**: Uppy (implicitly used via `ObjectUploader`).
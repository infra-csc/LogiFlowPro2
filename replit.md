# EventFlow Logistics - Event Material Management System

## Overview

EventFlow Logistics is a comprehensive web application for managing event logistics operations, specifically focused on material requisition, inventory tracking, multi-vehicle loading operations, and reverse logistics. The system operates under an "event umbrella" model where all material requests, trips, and returns are organized by event, enabling efficient coordination of multiple simultaneous events.

The application serves various stakeholders including planning/operations teams, scenography departments, warehouse staff, drivers, and inventory management personnel. It emphasizes operational efficiency with features like cutoff deadline enforcement, parametric kit explosion (BOM), time-phased inventory projection, and detailed damage/loss tracking during returns.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tool**
- React 18 with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- Desktop-first responsive design with tablet support for warehouse operations

**UI Component System**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui component library (New York style variant)
- Tailwind CSS for utility-first styling with custom design tokens
- Material Design principles for enterprise data-driven UI
- Custom color palette: dark blue primary (#0F172A), light blue secondary (#38BDF8), pink accent (#EC4899), purple accent (#8B5CF6)
- Inter font family via Google Fonts CDN

**State Management & Data Fetching**
- TanStack Query (React Query) for server state management
- Custom query client with infinite stale time for reduced refetching
- React Hook Form with Zod validation for form handling
- @hookform/resolvers for schema-based validation

**Key Design Decisions**
- Information density prioritized over aesthetics for operational efficiency
- Keyboard-first interactions with mouse support for power users
- Status badges with semantic colors for quick visual recognition
- Data tables as primary interface pattern for list views
- Modals/dialogs used sparingly; prefer inline editing where possible

### Backend Architecture

**Runtime & Framework**
- Node.js with Express.js server
- TypeScript with ES Modules (type: "module")
- Development: tsx for TypeScript execution
- Production: esbuild for bundling with ESM output

**API Design**
- RESTful API with JSON payloads
- Route registration pattern in `/server/routes.ts`
- Storage layer abstraction via `/server/storage.ts` interface
- Request logging middleware with timing and response capture
- Error handling middleware with status code normalization

**Database Layer**
- Drizzle ORM for type-safe database operations
- Neon serverless PostgreSQL with WebSocket support
- Connection pooling via @neondatabase/serverless
- Schema-first design with migrations in `/migrations` directory
- Shared schema definitions in `/shared/schema.ts` for type consistency across client/server

**Schema Design Highlights**
- Event-centric data model with events as the primary organizational entity
- Material requests linked to events with area-based segmentation
- Trips associated with events, vehicles, drivers, and docks
- Parametric kit system with JSON-based parameter storage and BOM lines
- Inventory movements tracked by type (inbound, outbound, transfer, adjustment, loss, damage)
- Return records with separate damaged/lost quantity tracking
- Audit logs for compliance and troubleshooting
- PostgreSQL enums for status fields to enforce valid states

**Key Architectural Patterns**
- Separation of concerns: client/server/shared directory structure
- Type sharing between frontend and backend via shared schema
- Repository pattern via IStorage interface for data access abstraction
- Zod schemas derived from Drizzle tables using drizzle-zod for validation
- Relations defined in schema for ORM query optimization

### External Dependencies

**Database**
- Neon Serverless PostgreSQL (via DATABASE_URL environment variable)
- WebSocket connection support for serverless environments
- Drizzle Kit for schema migrations and database management

**UI Component Libraries**
- Radix UI components (@radix-ui/react-*) for accessible primitives
- cmdk for command palette functionality
- embla-carousel-react for carousel components
- date-fns for date manipulation and formatting
- lucide-react for icon system

**Development Tools**
- Vite plugins for development experience:
  - @replit/vite-plugin-runtime-error-modal for error overlay
  - @replit/vite-plugin-cartographer (Replit-specific)
  - @replit/vite-plugin-dev-banner (Replit-specific)

**Form & Validation**
- React Hook Form for form state management
- Zod for runtime type validation
- @hookform/resolvers for integration between libraries

**Styling**
- Tailwind CSS with PostCSS processing
- class-variance-authority for variant-based component APIs
- clsx + tailwind-merge for conditional class composition

**Session Management**
- connect-pg-simple for PostgreSQL-backed session store (dependency present, implementation pending)

**Type Safety**
- TypeScript strict mode enabled
- Path aliases (@/, @shared/, @assets/) for clean imports
- Shared types between client and server via @shared namespace
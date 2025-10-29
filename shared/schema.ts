import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  integer, 
  decimal, 
  jsonb,
  pgEnum,
  boolean
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const eventStatusEnum = pgEnum("event_status", [
  "planning",
  "approved",
  "in_progress",
  "completed",
  "cancelled"
]);

export const requestStatusEnum = pgEnum("request_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "cutoff_locked",
  "in_picking",
  "partially_loaded",
  "loaded",
  "in_transit",
  "in_use",
  "return_pending",
  "completed"
]);

export const itemApprovalStatusEnum = pgEnum("item_approval_status", [
  "pending",
  "approved",
  "rejected"
]);

export const tripStatusEnum = pgEnum("trip_status", [
  "planned",
  "loading",
  "loaded",
  "in_transit",
  "at_destination",
  "unloading",
  "completed"
]);

export const loadingOrderStatusEnum = pgEnum("loading_order_status", [
  "draft",
  "ready",
  "approved",
  "in_progress",
  "completed",
  "cancelled"
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "outbound_event",
  "inbound_event", 
  "inbound_purchase",
  "inbound_rental",
  "outbound_rental_return",
  "internal_transfer",
  "inventory_adjustment"
]);

export const movementStatusEnum = pgEnum("movement_status", [
  "created",
  "pending_approval",
  "in_progress",
  "paused",
  "completed",
  "cancelled"
]);

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "reserve",
  "load",
  "return",
  "damage",
  "loss",
  "purchase",
  "rental_in",
  "rental_out",
  "repair_in",
  "repair_out",
  "adjustment"
]);

export const ownershipTypeEnum = pgEnum("ownership_type", [
  "owned",
  "rented",
  "third_party"
]);

export const productStatusEnum = pgEnum("product_status", [
  "available",
  "reserved",
  "loaded",
  "in_transit",
  "in_use",
  "returned",
  "damaged",
  "in_repair",
  "unusable",
  "lost"
]);

// Movement configuration enums (Phase 1)
export const movementGroupPurposeEnum = pgEnum("movement_group_purpose", [
  "operational",
  "quality_control",
  "third_party",
  "adjustments"
]);

export const movementNatureEnum = pgEnum("movement_nature", [
  "inbound",
  "outbound",
  "transfer",
  "adjustment"
]);

export const batchOwnershipTypeEnum = pgEnum("batch_ownership_type", [
  "owned",
  "rented",
  "consigned",
  "commodatum"
]);

// Users table (Authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Roles table
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Permissions table (page-based permissions)
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  page: text("page").notNull().unique(), // e.g., 'dashboard', 'events', 'products', etc.
  displayName: text("display_name").notNull(),
  canView: boolean("can_view").notNull().default(false),
  canCreate: boolean("can_create").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false)
});

// User-Role relationship (many-to-many)
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().default(sql`now()`)
});

// Role-Permission relationship (many-to-many)
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  canView: boolean("can_view").notNull().default(false),
  canCreate: boolean("can_create").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false)
});

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku"),
  name: text("name").notNull(),
  client: text("client").notNull(),
  location: text("location").notNull(),
  setupDate: timestamp("setup_date").notNull(),
  eventDate: timestamp("event_date").notNull(),
  teardownDate: timestamp("teardown_date").notNull(),
  requestWindowStart: timestamp("request_window_start"),
  requestWindowEnd: timestamp("request_window_end"),
  status: eventStatusEnum("status").notNull().default("planning"),
  cutoffConfig: jsonb("cutoff_config").$type<Record<string, string>>().default({}),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// Kits/Projects table
export const kits = pgTable("kits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  parameters: jsonb("parameters").$type<{
    name: string;
    type: "number" | "select";
    unit?: string;
    options?: string[];
  }[]>().notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// BOM Lines table
export const bomLines = pgTable("bom_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kitId: varchar("kit_id").notNull().references(() => kits.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantityFormula: text("quantity_formula").notNull(),
  notes: text("notes")
});

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  ownership: ownershipTypeEnum("ownership").notNull().default("owned"),
  unit: text("unit").notNull().default("unit"),
  weight: decimal("weight", { precision: 10, scale: 2 }),
  dimensions: text("dimensions"),
  barcode: text("barcode"),
  location: text("location"),
  minimumStock: integer("minimum_stock").default(0),
  currentStock: integer("current_stock").default(0),
  imageUrl: text("image_url"),
  alternativeProductIds: text("alternative_product_ids").array(),
  // Phase 1 additions
  requiresSupplier: boolean("requires_supplier").notNull().default(false),
  equivalentSku: text("equivalent_sku"), // For linking variants
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Material Requests table
export const materialRequests = pgTable("material_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  area: text("area").notNull(),
  status: requestStatusEnum("status").notNull().default("draft"),
  requestedBy: text("requested_by").notNull(),
  submittedAt: timestamp("submitted_at"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  cutoffTime: timestamp("cutoff_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Request Items table
export const requestItems = pgTable("request_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => materialRequests.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => products.id),
  quantity: integer("quantity").notNull(),
  approvalStatus: itemApprovalStatusEnum("approval_status").notNull().default("pending"),
  approvedQuantity: integer("approved_quantity"),
  rejectionReason: text("rejection_reason"),
  kitId: varchar("kit_id").references(() => kits.id),
  kitParameters: jsonb("kit_parameters"),
  notes: text("notes")
});

// Vehicle Types table
export const vehicleTypes = pgTable("vehicle_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  capacity: decimal("capacity", { precision: 10, scale: 2 }),
  weightLimit: decimal("weight_limit", { precision: 10, scale: 2 }),
  lengthLimit: decimal("length_limit", { precision: 10, scale: 2 }),
  // Medidas do baú
  cargoLength: decimal("cargo_length", { precision: 10, scale: 2 }),
  cargoHeight: decimal("cargo_height", { precision: 10, scale: 2 }),
  cargoWidth: decimal("cargo_width", { precision: 10, scale: 2 }),
  axleCount: integer("axle_count"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plate: text("plate").notNull().unique(),
  vehicleTypeId: varchar("vehicle_type_id").references(() => vehicleTypes.id),
  type: text("type").notNull(), // Manter por compatibilidade
  maxWeight: decimal("max_weight", { precision: 10, scale: 2 }),
  maxVolume: decimal("max_volume", { precision: 10, scale: 2 }),
  dimensions: text("dimensions"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Drivers table
export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  license: text("license").notNull(),
  phone: text("phone").notNull(),
  available: boolean("available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Docks table
export const docks = pgTable("docks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(1),
  restrictions: text("restrictions"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Movement Groups table (Phase 1)
export const movementGroups = pgTable("movement_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6b7280"),
  icon: text("icon").notNull().default("📦"),
  purpose: movementGroupPurposeEnum("purpose").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// Movement Types Config table (Phase 1)
export const movementTypesConfig = pgTable("movement_types_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  groupId: varchar("group_id").notNull().references(() => movementGroups.id),
  nature: movementNatureEnum("nature").notNull(),
  
  // Control impacts
  affectsPhysicalInventory: boolean("affects_physical_inventory").notNull().default(true),
  affectsOperationalInventory: boolean("affects_operational_inventory").notNull().default(true),
  affectsPatrimonialInventory: boolean("affects_patrimonial_inventory").notNull().default(true),
  
  // Configuration
  requiresApproval: boolean("requires_approval").notNull().default(false),
  requiresDocument: boolean("requires_document").notNull().default(false),
  allowsMixedBatch: boolean("allows_mixed_batch").notNull().default(true),
  
  // Dynamic configurations (JSON)
  allowedSourceStatuses: jsonb("allowed_source_statuses").$type<string[]>(),
  allowedDestinationStatuses: jsonb("allowed_destination_statuses").$type<string[]>(),
  requiredFields: jsonb("required_fields").$type<string[]>(),
  optionalFields: jsonb("optional_fields").$type<string[]>(),
  specialValidations: jsonb("special_validations").$type<Record<string, any>>(),
  
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// Batch Lots table (Phase 2 preparation)
export const batchLots = pgTable("batch_lots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  batchCode: text("batch_code").notNull(),
  ownershipType: batchOwnershipTypeEnum("ownership_type").notNull(),
  
  // Owner (for third-party material)
  ownerId: varchar("owner_id"), // FK to suppliers (future table)
  ownerName: text("owner_name"), // Cache of name
  
  // Specific data
  contractId: varchar("contract_id"),
  entryDate: timestamp("entry_date").notNull(),
  expiryDate: timestamp("expiry_date"),
  
  // Location
  location: text("location"),
  
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// Trips table (Planejamento de Transporte)
export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description"),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  vehicleId: varchar("vehicle_id").references(() => vehicles.id), // Opcional
  vehicleTypeId: varchar("vehicle_type_id").notNull().references(() => vehicleTypes.id),
  driverId: varchar("driver_id").references(() => drivers.id), // Opcional
  dockId: varchar("dock_id").references(() => docks.id),
  
  // Seção Carregamento
  loadingLocation: text("loading_location"),
  loadingStartTime: timestamp("loading_start_time"),
  loadingEndTime: timestamp("loading_end_time"),
  departureDateTime: timestamp("departure_date_time"),
  
  // Seção Descarregamento
  unloadingLocation: text("unloading_location"),
  unloadingStartTime: timestamp("unloading_start_time"),
  unloadingEndTime: timestamp("unloading_end_time"),
  
  // Campos legados (manter por compatibilidade)
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  
  status: tripStatusEnum("status").notNull().default("planned"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Trip Events table (Many-to-Many)
export const tripEvents = pgTable("trip_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().default(sql`now()`)
});

// Trip Destinations table (Multiple arrival locations)
export const tripDestinations = pgTable("trip_destinations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  location: text("location").notNull(),
  arrivalDateTime: timestamp("arrival_date_time").notNull(),
  sequence: integer("sequence").notNull().default(1),
  notes: text("notes")
});

// Trip Items table
export const tripItems = pgTable("trip_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  plannedQuantity: integer("planned_quantity").notNull(),
  loadedQuantity: integer("loaded_quantity").default(0),
  returnedQuantity: integer("returned_quantity").default(0),
  discrepancies: text("discrepancies")
});

// Loading Orders table
export const loadingOrders = pgTable("loading_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  orderNumber: text("order_number").notNull(),
  status: loadingOrderStatusEnum("status").notNull().default("draft"),
  plannedStartTime: timestamp("planned_start_time").notNull(),
  plannedEndTime: timestamp("planned_end_time").notNull(),
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  loadingDate: timestamp("loading_date"),
  unloadingDate: timestamp("unloading_date"),
  createdBy: text("created_by").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// Loading Order - Material Request relationship (Many-to-Many)
export const loadingOrderRequests = pgTable("loading_order_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadingOrderId: varchar("loading_order_id").notNull().references(() => loadingOrders.id, { onDelete: "cascade" }),
  requestId: varchar("request_id").notNull().references(() => materialRequests.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().default(sql`now()`)
});

// Loading Order Consolidated Items table
export const loadingOrderItems = pgTable("loading_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadingOrderId: varchar("loading_order_id").notNull().references(() => loadingOrders.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  consolidatedQuantity: integer("consolidated_quantity").notNull(),
  pickedQuantity: integer("picked_quantity").default(0),
  loadedQuantity: integer("loaded_quantity").default(0),
  sourceRequests: jsonb("source_requests").$type<Array<{
    requestId: string;
    area: string;
    quantity: number;
    fromKit?: {
      kitId: string;
      kitName: string;
      itemId: string;
    };
  }>>().notNull(),
  notes: text("notes")
});

// Loading Order Trips junction table (many-to-many)
export const loadingOrderTrips = pgTable("loading_order_trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loadingOrderId: varchar("loading_order_id").notNull().references(() => loadingOrders.id, { onDelete: "cascade" }),
  tripId: varchar("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().default(sql`now()`)
});

// Warehouse Movements table (Carga e Descarga)
export const movements = pgTable("movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  movementNumber: text("movement_number").notNull().unique(),
  name: text("name").notNull(),
  // Phase 1: Support both legacy enum and new configurable types
  type: movementTypeEnum("type"), // Now optional when movementTypeConfigId is set
  movementTypeConfigId: varchar("movement_type_config_id").references(() => movementTypesConfig.id),
  status: movementStatusEnum("status").notNull().default("created"),
  loadingOrderId: varchar("loading_order_id").references(() => loadingOrders.id),
  eventId: varchar("event_id").references(() => events.id), // Deprecated: use movementEvents table for multiple events
  vehiclePlate: text("vehicle_plate"),
  dockId: varchar("dock_id").references(() => docks.id),
  startedAt: timestamp("started_at"),
  pausedAt: timestamp("paused_at"),
  completedAt: timestamp("completed_at"),
  totalDuration: integer("total_duration"), // em minutos
  createdBy: text("created_by").notNull(),
  // Approval fields
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// Movement Events junction table (many-to-many)
export const movementEvents = pgTable("movement_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  movementId: varchar("movement_id").notNull().references(() => movements.id, { onDelete: "cascade" }),
  eventId: varchar("event_id").notNull().references(() => events.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Movement Trips junction table (many-to-many)
export const movementTrips = pgTable("movement_trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  movementId: varchar("movement_id").notNull().references(() => movements.id, { onDelete: "cascade" }),
  tripId: varchar("trip_id").notNull().references(() => trips.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Movement Items table
export const movementItems = pgTable("movement_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  movementId: varchar("movement_id").notNull().references(() => movements.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  scanned: boolean("scanned").default(false),
  location: text("location"),
  notes: text("notes"),
  // Phase 1 additions
  supplierName: text("supplier_name"), // Supplier tracking
  supplierNotes: text("supplier_notes"), // Notes about supplier
  processedAt: timestamp("processed_at").notNull().default(sql`now()`)
});

// Inventory Movements table
export const inventoryMovements = pgTable("inventory_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  type: inventoryMovementTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  reference: text("reference"),
  eventId: varchar("event_id").references(() => events.id),
  tripId: varchar("trip_id").references(() => trips.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Returns table
export const returns = pgTable("returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().references(() => trips.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  expectedQuantity: integer("expected_quantity").notNull(),
  returnedQuantity: integer("returned_quantity").notNull(),
  damagedQuantity: integer("damaged_quantity").default(0),
  lostQuantity: integer("lost_quantity").default(0),
  damagePhotos: text("damage_photos").array(),
  damageDescription: text("damage_description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  userId: text("user_id").notNull(),
  changes: jsonb("changes"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Notification System

// Entity types that support comments
export const commentEntityTypeEnum = pgEnum("comment_entity_type", [
  "event",
  "material_request",
  "trip",
  "loading_order",
  "movement"
]);

// Notification types
export const notificationTypeEnum = pgEnum("notification_type", [
  "mention",
  "comment_reply",
  "status_change",
  "approval_request"
]);

// Comments table
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: commentEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  content: text("content").notNull(),
  mentions: text("mentions").array().default(sql`'{}'::text[]`), // Array of user IDs mentioned
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: commentEntityTypeEnum("entity_type"),
  entityId: varchar("entity_id"),
  commentId: varchar("comment_id").references(() => comments.id, { onDelete: "cascade" }),
  actionUrl: text("action_url"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Notification settings
export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  emailOnMention: boolean("email_on_mention").notNull().default(true),
  emailOnCommentReply: boolean("email_on_comment_reply").notNull().default(false),
  emailOnStatusChange: boolean("email_on_status_change").notNull().default(false),
  emailOnApprovalRequest: boolean("email_on_approval_request").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// Relations
export const eventsRelations = relations(events, ({ many }) => ({
  materialRequests: many(materialRequests),
  trips: many(trips),
  loadingOrders: many(loadingOrders),
  inventoryMovements: many(inventoryMovements),
  movementEvents: many(movementEvents)
}));

export const kitsRelations = relations(kits, ({ many }) => ({
  bomLines: many(bomLines),
  requestItems: many(requestItems)
}));

export const bomLinesRelations = relations(bomLines, ({ one }) => ({
  kit: one(kits, {
    fields: [bomLines.kitId],
    references: [kits.id]
  }),
  product: one(products, {
    fields: [bomLines.productId],
    references: [products.id]
  })
}));

export const productsRelations = relations(products, ({ many }) => ({
  bomLines: many(bomLines),
  requestItems: many(requestItems),
  tripItems: many(tripItems),
  inventoryMovements: many(inventoryMovements),
  returns: many(returns)
}));

export const materialRequestsRelations = relations(materialRequests, ({ one, many }) => ({
  event: one(events, {
    fields: [materialRequests.eventId],
    references: [events.id]
  }),
  items: many(requestItems),
  loadingOrderRequests: many(loadingOrderRequests)
}));

export const requestItemsRelations = relations(requestItems, ({ one }) => ({
  request: one(materialRequests, {
    fields: [requestItems.requestId],
    references: [materialRequests.id]
  }),
  product: one(products, {
    fields: [requestItems.productId],
    references: [products.id]
  }),
  kit: one(kits, {
    fields: [requestItems.kitId],
    references: [kits.id]
  })
}));

export const vehicleTypesRelations = relations(vehicleTypes, ({ many }) => ({
  vehicles: many(vehicles),
  trips: many(trips)
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  event: one(events, {
    fields: [trips.eventId],
    references: [events.id]
  }),
  vehicle: one(vehicles, {
    fields: [trips.vehicleId],
    references: [vehicles.id]
  }),
  vehicleType: one(vehicleTypes, {
    fields: [trips.vehicleTypeId],
    references: [vehicleTypes.id]
  }),
  driver: one(drivers, {
    fields: [trips.driverId],
    references: [drivers.id]
  }),
  dock: one(docks, {
    fields: [trips.dockId],
    references: [docks.id]
  }),
  items: many(tripItems),
  returns: many(returns),
  inventoryMovements: many(inventoryMovements),
  tripEvents: many(tripEvents),
  destinations: many(tripDestinations),
  movementTrips: many(movementTrips),
  loadingOrderTrips: many(loadingOrderTrips)
}));

export const tripEventsRelations = relations(tripEvents, ({ one }) => ({
  trip: one(trips, {
    fields: [tripEvents.tripId],
    references: [trips.id]
  }),
  event: one(events, {
    fields: [tripEvents.eventId],
    references: [events.id]
  })
}));

export const tripDestinationsRelations = relations(tripDestinations, ({ one }) => ({
  trip: one(trips, {
    fields: [tripDestinations.tripId],
    references: [trips.id]
  })
}));

export const tripItemsRelations = relations(tripItems, ({ one }) => ({
  trip: one(trips, {
    fields: [tripItems.tripId],
    references: [trips.id]
  }),
  product: one(products, {
    fields: [tripItems.productId],
    references: [products.id]
  })
}));

export const returnsRelations = relations(returns, ({ one }) => ({
  trip: one(trips, {
    fields: [returns.tripId],
    references: [trips.id]
  }),
  product: one(products, {
    fields: [returns.productId],
    references: [products.id]
  })
}));

export const loadingOrdersRelations = relations(loadingOrders, ({ one, many }) => ({
  event: one(events, {
    fields: [loadingOrders.eventId],
    references: [events.id]
  }),
  orderRequests: many(loadingOrderRequests),
  items: many(loadingOrderItems),
  orderTrips: many(loadingOrderTrips)
}));

export const loadingOrderRequestsRelations = relations(loadingOrderRequests, ({ one }) => ({
  loadingOrder: one(loadingOrders, {
    fields: [loadingOrderRequests.loadingOrderId],
    references: [loadingOrders.id]
  }),
  request: one(materialRequests, {
    fields: [loadingOrderRequests.requestId],
    references: [materialRequests.id]
  })
}));

export const loadingOrderItemsRelations = relations(loadingOrderItems, ({ one }) => ({
  loadingOrder: one(loadingOrders, {
    fields: [loadingOrderItems.loadingOrderId],
    references: [loadingOrders.id]
  }),
  product: one(products, {
    fields: [loadingOrderItems.productId],
    references: [products.id]
  })
}));

export const loadingOrderTripsRelations = relations(loadingOrderTrips, ({ one }) => ({
  loadingOrder: one(loadingOrders, {
    fields: [loadingOrderTrips.loadingOrderId],
    references: [loadingOrders.id]
  }),
  trip: one(trips, {
    fields: [loadingOrderTrips.tripId],
    references: [trips.id]
  })
}));

export const movementsRelations = relations(movements, ({ one, many }) => ({
  loadingOrder: one(loadingOrders, {
    fields: [movements.loadingOrderId],
    references: [loadingOrders.id]
  }),
  event: one(events, {
    fields: [movements.eventId],
    references: [events.id]
  }),
  dock: one(docks, {
    fields: [movements.dockId],
    references: [docks.id]
  }),
  items: many(movementItems),
  movementEvents: many(movementEvents),
  movementTrips: many(movementTrips)
}));

export const movementItemsRelations = relations(movementItems, ({ one }) => ({
  movement: one(movements, {
    fields: [movementItems.movementId],
    references: [movements.id]
  }),
  product: one(products, {
    fields: [movementItems.productId],
    references: [products.id]
  })
}));

export const movementEventsRelations = relations(movementEvents, ({ one }) => ({
  movement: one(movements, {
    fields: [movementEvents.movementId],
    references: [movements.id]
  }),
  event: one(events, {
    fields: [movementEvents.eventId],
    references: [events.id]
  })
}));

export const movementTripsRelations = relations(movementTrips, ({ one }) => ({
  movement: one(movements, {
    fields: [movementTrips.movementId],
    references: [movements.id]
  }),
  trip: one(trips, {
    fields: [movementTrips.tripId],
    references: [trips.id]
  })
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  vehicleType: one(vehicleTypes, {
    fields: [vehicles.vehicleTypeId],
    references: [vehicleTypes.id]
  }),
  trips: many(trips)
}));

export const driversRelations = relations(drivers, ({ many }) => ({
  trips: many(trips)
}));

export const docksRelations = relations(docks, ({ many }) => ({
  trips: many(trips)
}));

export const movementGroupsRelations = relations(movementGroups, ({ many }) => ({
  movementTypes: many(movementTypesConfig)
}));

export const movementTypesConfigRelations = relations(movementTypesConfig, ({ one, many }) => ({
  group: one(movementGroups, {
    fields: [movementTypesConfig.groupId],
    references: [movementGroups.id]
  }),
  movements: many(movements)
}));

export const batchLotsRelations = relations(batchLots, ({ one }) => ({
  product: one(products, {
    fields: [batchLots.productId],
    references: [products.id]
  })
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  userRoles: many(userRoles),
  comments: many(comments),
  notifications: many(notifications),
  notificationSettings: one(notificationSettings, {
    fields: [users.id],
    references: [notificationSettings.userId]
  })
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id]
  }),
  notifications: many(notifications)
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  }),
  comment: one(comments, {
    fields: [notifications.commentId],
    references: [comments.id]
  })
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, {
    fields: [notificationSettings.userId],
    references: [users.id]
  })
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions)
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions)
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id]
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id]
  })
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id]
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id]
  })
}));

// Zod schemas for validation
export const insertEventSchema = createInsertSchema(events, {
  setupDate: z.coerce.date(),
  eventDate: z.coerce.date(),
  teardownDate: z.coerce.date(),
  requestWindowStart: z.coerce.date().optional().nullable(),
  requestWindowEnd: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertKitSchema = createInsertSchema(kits).omit({
  id: true,
  createdAt: true
});

export const insertBomLineSchema = createInsertSchema(bomLines).omit({
  id: true
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true
});

export const insertMaterialRequestSchema = createInsertSchema(materialRequests).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
  approvedBy: true,
  approvedAt: true
});

export const insertRequestItemSchema = createInsertSchema(requestItems).omit({
  id: true
}).refine(
  (data) => data.productId || data.kitId,
  { message: "Deve fornecer productId ou kitId" }
);

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true
});

export const insertDriverSchema = createInsertSchema(drivers).omit({
  id: true,
  createdAt: true
});

export const insertDockSchema = createInsertSchema(docks).omit({
  id: true,
  createdAt: true
});

export const insertMovementGroupSchema = createInsertSchema(movementGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMovementTypeConfigSchema = createInsertSchema(movementTypesConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertBatchLotSchema = createInsertSchema(batchLots).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertTripSchema = createInsertSchema(trips, {
  loadingStartTime: z.coerce.date().optional(),
  loadingEndTime: z.coerce.date().optional(),
  departureDateTime: z.coerce.date().optional(),
  unloadingStartTime: z.coerce.date().optional(),
  unloadingEndTime: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  actualStart: true,
  actualEnd: true
});

export const insertTripItemSchema = createInsertSchema(tripItems).omit({
  id: true
});

export const insertVehicleTypeSchema = createInsertSchema(vehicleTypes).omit({
  id: true,
  createdAt: true
});

export const insertTripEventSchema = createInsertSchema(tripEvents).omit({
  id: true,
  addedAt: true
});

export const insertTripDestinationSchema = createInsertSchema(tripDestinations, {
  arrivalDateTime: z.coerce.date()
}).omit({
  id: true
});

export const insertLoadingOrderSchema = createInsertSchema(loadingOrders, {
  plannedStartTime: z.coerce.date(),
  plannedEndTime: z.coerce.date(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  actualStartTime: true,
  actualEndTime: true
});

export const insertLoadingOrderRequestSchema = createInsertSchema(loadingOrderRequests).omit({
  id: true,
  addedAt: true
});

export const insertLoadingOrderItemSchema = createInsertSchema(loadingOrderItems).omit({
  id: true
});

export const insertMovementSchema = createInsertSchema(movements).omit({
  id: true,
  movementNumber: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  pausedAt: true,
  completedAt: true,
  totalDuration: true
});

export const insertMovementWithEventsSchema = insertMovementSchema.extend({
  eventIds: z.array(z.string()).min(1, "Selecione pelo menos um evento"),
  tripIds: z.array(z.string()).optional()
});

export const insertMovementItemSchema = createInsertSchema(movementItems).omit({
  id: true,
  processedAt: true
});

export const insertMovementTripSchema = createInsertSchema(movementTrips).omit({
  id: true,
  createdAt: true
});

export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({
  id: true,
  createdAt: true
});

export const insertReturnSchema = createInsertSchema(returns).omit({
  id: true,
  createdAt: true
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  assignedAt: true
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true
});

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// TypeScript types
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Kit = typeof kits.$inferSelect;
export type InsertKit = z.infer<typeof insertKitSchema>;

export type BomLine = typeof bomLines.$inferSelect;
export type InsertBomLine = z.infer<typeof insertBomLineSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type MaterialRequest = typeof materialRequests.$inferSelect;
export type InsertMaterialRequest = z.infer<typeof insertMaterialRequestSchema>;

export type RequestItem = typeof requestItems.$inferSelect;
export type InsertRequestItem = z.infer<typeof insertRequestItemSchema>;

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;

export type Dock = typeof docks.$inferSelect;
export type InsertDock = z.infer<typeof insertDockSchema>;

export type MovementGroup = typeof movementGroups.$inferSelect;
export type InsertMovementGroup = z.infer<typeof insertMovementGroupSchema>;

export type MovementTypeConfig = typeof movementTypesConfig.$inferSelect;
export type InsertMovementTypeConfig = z.infer<typeof insertMovementTypeConfigSchema>;

export type BatchLot = typeof batchLots.$inferSelect;
export type InsertBatchLot = z.infer<typeof insertBatchLotSchema>;

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;

export type TripItem = typeof tripItems.$inferSelect;
export type InsertTripItem = z.infer<typeof insertTripItemSchema>;

export type VehicleType = typeof vehicleTypes.$inferSelect;
export type InsertVehicleType = z.infer<typeof insertVehicleTypeSchema>;

export type TripEvent = typeof tripEvents.$inferSelect;
export type InsertTripEvent = z.infer<typeof insertTripEventSchema>;

export type TripDestination = typeof tripDestinations.$inferSelect;
export type InsertTripDestination = z.infer<typeof insertTripDestinationSchema>;

export type LoadingOrder = typeof loadingOrders.$inferSelect;
export type InsertLoadingOrder = z.infer<typeof insertLoadingOrderSchema>;

export type LoadingOrderRequest = typeof loadingOrderRequests.$inferSelect;
export type InsertLoadingOrderRequest = z.infer<typeof insertLoadingOrderRequestSchema>;

export type LoadingOrderItem = typeof loadingOrderItems.$inferSelect;
export type InsertLoadingOrderItem = z.infer<typeof insertLoadingOrderItemSchema>;

export type Movement = typeof movements.$inferSelect;
export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type InsertMovementWithEvents = z.infer<typeof insertMovementWithEventsSchema>;

export type MovementEvent = typeof movementEvents.$inferSelect;

export type MovementTrip = typeof movementTrips.$inferSelect;
export type InsertMovementTrip = z.infer<typeof insertMovementTripSchema>;

export type MovementItem = typeof movementItems.$inferSelect;
export type InsertMovementItem = z.infer<typeof insertMovementItemSchema>;

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;

export type Return = typeof returns.$inferSelect;
export type InsertReturn = z.infer<typeof insertReturnSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;

// AI Optimization System

// Optimization type enum
export const optimizationTypeEnum = pgEnum("optimization_type", [
  "vehicle_loading",
  "route_planning",
  "combined"
]);

// Optimization status enum  
export const optimizationStatusEnum = pgEnum("optimization_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "applied"
]);

// Optimization Runs table - tracks each optimization request
export const optimizationRuns = pgTable("optimization_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: optimizationTypeEnum("type").notNull(),
  status: optimizationStatusEnum("status").notNull().default("pending"),
  loadingOrderId: varchar("loading_order_id").references(() => loadingOrders.id),
  tripId: varchar("trip_id").references(() => trips.id),
  requestedBy: varchar("requested_by").notNull().references(() => users.id),
  inputParams: jsonb("input_params").$type<{
    productIds?: string[];
    vehicleTypeId?: string;
    destinations?: Array<{location: string; arrivalDateTime: string}>;
    constraints?: Record<string, any>;
  }>(),
  executionTimeMs: integer("execution_time_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at")
});

// Loading Optimizations table - stores vehicle loading suggestions
export const loadingOptimizations = pgTable("loading_optimizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  optimizationRunId: varchar("optimization_run_id").notNull().references(() => optimizationRuns.id, { onDelete: "cascade" }),
  loadingOrderId: varchar("loading_order_id").notNull().references(() => loadingOrders.id),
  vehicleTypeId: varchar("vehicle_type_id").notNull().references(() => vehicleTypes.id),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  utilizationPercentage: decimal("utilization_percentage", { precision: 5, scale: 2 }).notNull(),
  weightDistributionScore: decimal("weight_distribution_score", { precision: 5, scale: 2 }),
  loadingSequence: jsonb("loading_sequence").$type<Array<{
    productId: string;
    productName: string;
    quantity: number;
    position: {x: number; y: number; z: number};
    dimensions: {length: number; width: number; height: number};
    weight: number;
    layer: number;
  }>>().notNull(),
  warnings: text("warnings").array(),
  recommendations: text("recommendations").array(),
  estimatedLoadingTimeMinutes: integer("estimated_loading_time_minutes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Route Optimizations table - stores route planning suggestions
export const routeOptimizations = pgTable("route_optimizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  optimizationRunId: varchar("optimization_run_id").notNull().references(() => optimizationRuns.id, { onDelete: "cascade" }),
  tripId: varchar("trip_id").references(() => trips.id),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }).notNull(),
  totalDistanceKm: decimal("total_distance_km", { precision: 10, scale: 2 }),
  estimatedDurationMinutes: integer("estimated_duration_minutes"),
  fuelEstimateLiters: decimal("fuel_estimate_liters", { precision: 10, scale: 2 }),
  optimizedRoute: jsonb("optimized_route").$type<Array<{
    order: number;
    location: string;
    arrivalTime: string;
    departureTime?: string;
    distanceFromPrevious: number;
    durationFromPrevious: number;
    instructions?: string;
  }>>().notNull(),
  alternativeRoutes: jsonb("alternative_routes").$type<Array<{
    name: string;
    totalDistanceKm: number;
    estimatedDurationMinutes: number;
    route: Array<{location: string; arrivalTime: string}>;
  }>>(),
  warnings: text("warnings").array(),
  recommendations: text("recommendations").array(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});

// Relations for optimization tables
export const optimizationRunsRelations = relations(optimizationRuns, ({ one, many }) => ({
  loadingOrder: one(loadingOrders, {
    fields: [optimizationRuns.loadingOrderId],
    references: [loadingOrders.id]
  }),
  trip: one(trips, {
    fields: [optimizationRuns.tripId],
    references: [trips.id]
  }),
  requestedByUser: one(users, {
    fields: [optimizationRuns.requestedBy],
    references: [users.id]
  }),
  loadingOptimizations: many(loadingOptimizations),
  routeOptimizations: many(routeOptimizations)
}));

export const loadingOptimizationsRelations = relations(loadingOptimizations, ({ one }) => ({
  optimizationRun: one(optimizationRuns, {
    fields: [loadingOptimizations.optimizationRunId],
    references: [optimizationRuns.id]
  }),
  loadingOrder: one(loadingOrders, {
    fields: [loadingOptimizations.loadingOrderId],
    references: [loadingOrders.id]
  }),
  vehicleType: one(vehicleTypes, {
    fields: [loadingOptimizations.vehicleTypeId],
    references: [vehicleTypes.id]
  })
}));

export const routeOptimizationsRelations = relations(routeOptimizations, ({ one }) => ({
  optimizationRun: one(optimizationRuns, {
    fields: [routeOptimizations.optimizationRunId],
    references: [optimizationRuns.id]
  }),
  trip: one(trips, {
    fields: [routeOptimizations.tripId],
    references: [trips.id]
  })
}));

// Insert schemas
export const insertOptimizationRunSchema = createInsertSchema(optimizationRuns).omit({
  id: true,
  createdAt: true,
  completedAt: true
});

export const insertLoadingOptimizationSchema = createInsertSchema(loadingOptimizations).omit({
  id: true,
  createdAt: true
});

export const insertRouteOptimizationSchema = createInsertSchema(routeOptimizations).omit({
  id: true,
  createdAt: true
});

// Types
export type OptimizationRun = typeof optimizationRuns.$inferSelect;
export type InsertOptimizationRun = z.infer<typeof insertOptimizationRunSchema>;

export type LoadingOptimization = typeof loadingOptimizations.$inferSelect;
export type InsertLoadingOptimization = z.infer<typeof insertLoadingOptimizationSchema>;

export type RouteOptimization = typeof routeOptimizations.$inferSelect;
export type InsertRouteOptimization = z.infer<typeof insertRouteOptimizationSchema>;

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

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plate: text("plate").notNull().unique(),
  type: text("type").notNull(),
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

// Trips table
export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  vehicleId: varchar("vehicle_id").notNull().references(() => vehicles.id),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  dockId: varchar("dock_id").references(() => docks.id),
  scheduledStart: timestamp("scheduled_start").notNull(),
  scheduledEnd: timestamp("scheduled_end").notNull(),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  status: tripStatusEnum("status").notNull().default("planned"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
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

// Warehouse Movements table (Carga e Descarga)
export const movements = pgTable("movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  movementNumber: text("movement_number").notNull().unique(),
  name: text("name").notNull(),
  type: movementTypeEnum("type").notNull(),
  status: movementStatusEnum("status").notNull().default("created"),
  loadingOrderId: varchar("loading_order_id").references(() => loadingOrders.id),
  vehiclePlate: text("vehicle_plate"),
  dockId: varchar("dock_id").references(() => docks.id),
  startedAt: timestamp("started_at"),
  pausedAt: timestamp("paused_at"),
  completedAt: timestamp("completed_at"),
  totalDuration: integer("total_duration"), // em minutos
  createdBy: text("created_by").notNull(),
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

// Movement Items table
export const movementItems = pgTable("movement_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  movementId: varchar("movement_id").notNull().references(() => movements.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  scanned: boolean("scanned").default(false),
  location: text("location"),
  notes: text("notes"),
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

export const tripsRelations = relations(trips, ({ one, many }) => ({
  event: one(events, {
    fields: [trips.eventId],
    references: [events.id]
  }),
  vehicle: one(vehicles, {
    fields: [trips.vehicleId],
    references: [vehicles.id]
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
  inventoryMovements: many(inventoryMovements)
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
  items: many(loadingOrderItems)
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

export const movementsRelations = relations(movements, ({ one, many }) => ({
  loadingOrder: one(loadingOrders, {
    fields: [movements.loadingOrderId],
    references: [loadingOrders.id]
  }),
  dock: one(docks, {
    fields: [movements.dockId],
    references: [docks.id]
  }),
  items: many(movementItems),
  movementEvents: many(movementEvents)
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

export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  trips: many(trips)
}));

export const driversRelations = relations(drivers, ({ many }) => ({
  trips: many(trips)
}));

export const docksRelations = relations(docks, ({ many }) => ({
  trips: many(trips)
}));

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles)
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

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  createdAt: true,
  actualStart: true,
  actualEnd: true
});

export const insertTripItemSchema = createInsertSchema(tripItems).omit({
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
  eventIds: z.array(z.string()).min(1, "Selecione pelo menos um evento")
});

export const insertMovementItemSchema = createInsertSchema(movementItems).omit({
  id: true,
  processedAt: true
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

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;

export type TripItem = typeof tripItems.$inferSelect;
export type InsertTripItem = z.infer<typeof insertTripItemSchema>;

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

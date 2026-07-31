import { db } from "./db";
import { eq, desc, and, sql, inArray, isNotNull } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import {
  events,
  kits,
  bomLines,
  suppliers,
  products,
  materialRequests,
  requestItems,
  vehicleTypes,
  vehicles,
  drivers,
  docks,
  trips,
  tripItems,
  tripEvents,
  tripDestinations,
  loadingOrders,
  loadingOrderRequests,
  loadingOrderItems,
  loadingOrderTrips,
  movements,
  movementEvents,
  movementTrips,
  movementRequests,
  movementItems,
  movementAuditLogs,
  inventoryMovements,
  returns,
  auditLogs,
  users,
  passwordResetTokens,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  comments,
  notifications,
  notificationSettings,
  optimizationRuns,
  loadingOptimizations,
  routeOptimizations,
  movementGroups,
  movementTypesConfig,
  batchLots,
  inventorySnapshots,
  movementAttachments,
  type MovementAttachment,
  type InsertMovementAttachment,
  type Event,
  type InsertEvent,
  type Kit,
  type InsertKit,
  type BomLine,
  type InsertBomLine,
  type Product,
  type InsertProduct,
  type MaterialRequest,
  type InsertMaterialRequest,
  type RequestItem,
  type InsertRequestItem,
  type VehicleType,
  type InsertVehicleType,
  type Vehicle,
  type InsertVehicle,
  type Driver,
  type InsertDriver,
  type Dock,
  type InsertDock,
  type Trip,
  type InsertTrip,
  type TripItem,
  type InsertTripItem,
  type TripEvent,
  type InsertTripEvent,
  type TripDestination,
  type InsertTripDestination,
  type LoadingOrder,
  type InsertLoadingOrder,
  type LoadingOrderRequest,
  type InsertLoadingOrderRequest,
  type LoadingOrderItem,
  type InsertLoadingOrderItem,
  type Movement,
  type InsertMovement,
  type InsertMovementWithEvents,
  type MovementItem,
  type InsertMovementItem,
  type MovementAuditLog,
  type InsertMovementAuditLog,
  type InventoryMovement,
  type InsertInventoryMovement,
  type Return,
  type InsertReturn,
  type AuditLog,
  type InsertAuditLog,
  type User,
  type InsertUser,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type Role,
  type InsertRole,
  type Permission,
  type InsertPermission,
  type UserRole,
  type InsertUserRole,
  type RolePermission,
  type InsertRolePermission,
  type Comment,
  type InsertComment,
  type Notification,
  type InsertNotification,
  type NotificationSettings,
  type InsertNotificationSettings,
  type OptimizationRun,
  type InsertOptimizationRun,
  type LoadingOptimization,
  type InsertLoadingOptimization,
  type RouteOptimization,
  type InsertRouteOptimization,
  type MovementGroup,
  type InsertMovementGroup,
  type MovementTypeConfig,
  type InsertMovementTypeConfig,
  type BatchLot,
  type InsertBatchLot,
  type Supplier,
  type InsertSupplier,
} from "@shared/schema";

export interface IStorage {
  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;

  // Kits
  getKits(): Promise<Kit[]>;
  getKit(id: string): Promise<Kit | undefined>;
  createKit(kit: InsertKit): Promise<Kit>;
  updateKit(id: string, kit: Partial<InsertKit>): Promise<Kit>;

  // BOM Lines
  getBomLinesByKit(kitId: string): Promise<BomLine[]>;
  createBomLine(bomLine: InsertBomLine): Promise<BomLine>;
  deleteBomLinesByKit(kitId: string): Promise<void>;

  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: string): Promise<void>;

  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getTargetProduct(scannedSku: string): Promise<{ product: Product; isVariant: boolean } | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;

  // Material Requests
  getMaterialRequests(eventId?: string): Promise<MaterialRequest[]>;
  getMaterialRequestsByUser(userId: string): Promise<MaterialRequest[]>;
  getMaterialRequest(id: string): Promise<MaterialRequest | undefined>;
  createMaterialRequest(request: InsertMaterialRequest): Promise<MaterialRequest>;
  createRequestWithItems(request: InsertMaterialRequest, items: InsertRequestItem[]): Promise<MaterialRequest>;
  updateMaterialRequest(id: string, request: Partial<InsertMaterialRequest>): Promise<MaterialRequest>;

  // Request Items
  getRequestItems(requestId: string): Promise<RequestItem[]>;
  getRequestItemsByRequestIds(requestIds: string[]): Promise<RequestItem[]>;
  getRequestDownstream(requestId: string): Promise<{ loadingOrderStatuses: string[]; tripStatuses: string[] }>;
  getRequestItem(id: string): Promise<RequestItem | undefined>;
  createRequestItem(item: InsertRequestItem): Promise<RequestItem>;
  updateRequestItem(id: string, item: Partial<InsertRequestItem>): Promise<RequestItem>;
  deleteRequestItem(id: string): Promise<void>;
  deleteMaterialRequest(id: string): Promise<void>;
  
  // Request Approvals
  approveRequestAll(requestId: string, approverName: string, comments?: string): Promise<void>;
  approveRequestPartial(requestId: string, approverName: string, itemApprovals: Array<{itemId: string, status: string, approvedQuantity?: number, rejectionReason?: string}>, comments?: string): Promise<void>;
  rejectRequestAll(requestId: string, approverName: string, reason: string): Promise<void>;
  reopenRequest(requestId: string): Promise<void>;

  // Vehicle Types
  getVehicleTypes(): Promise<VehicleType[]>;
  getVehicleType(id: string): Promise<VehicleType | undefined>;
  createVehicleType(vehicleType: InsertVehicleType): Promise<VehicleType>;
  updateVehicleType(id: string, vehicleType: Partial<InsertVehicleType>): Promise<VehicleType>;

  // Vehicles
  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle>;
  deleteVehicle(id: string): Promise<void>;

  // Drivers
  getDrivers(): Promise<Driver[]>;
  getDriver(id: string): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriver(id: string, driver: Partial<InsertDriver>): Promise<Driver>;
  deleteDriver(id: string): Promise<void>;

  // Docks
  getDocks(): Promise<Dock[]>;
  getDock(id: string): Promise<Dock | undefined>;
  createDock(dock: InsertDock): Promise<Dock>;
  updateDock(id: string, dock: Partial<InsertDock>): Promise<Dock>;
  deleteDock(id: string): Promise<void>;

  // Trips
  getTrips(eventId?: string): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: string, trip: Partial<InsertTrip>): Promise<Trip>;

  // Trip Items
  getTripItems(tripId: string): Promise<TripItem[]>;
  createTripItem(item: InsertTripItem): Promise<TripItem>;

  // Trip Events (junction table)
  getTripEvents(tripId: string): Promise<TripEvent[]>;
  createTripEvent(tripEvent: InsertTripEvent): Promise<TripEvent>;
  deleteTripEvents(tripId: string): Promise<void>;

  // Trip Destinations
  getTripDestinations(tripId: string): Promise<TripDestination[]>;
  createTripDestination(destination: InsertTripDestination): Promise<TripDestination>;
  deleteTripDestinations(tripId: string): Promise<void>;

  // Loading Orders
  getLoadingOrders(eventId?: string): Promise<LoadingOrder[]>;
  getLoadingOrder(id: string): Promise<LoadingOrder | undefined>;
  createLoadingOrder(order: InsertLoadingOrder): Promise<LoadingOrder>;
  updateLoadingOrder(id: string, order: Partial<InsertLoadingOrder>): Promise<LoadingOrder>;
  approveLoadingOrder(id: string): Promise<LoadingOrder>;
  disapproveLoadingOrder(id: string): Promise<LoadingOrder>;
  markLoadingOrderAsReady(id: string): Promise<LoadingOrder>;

  // Loading Order Requests (junction table)
  getLoadingOrderRequests(loadingOrderId: string): Promise<LoadingOrderRequest[]>;
  createLoadingOrderRequest(relation: InsertLoadingOrderRequest): Promise<LoadingOrderRequest>;

  // Loading Order Items
  getLoadingOrderItems(loadingOrderId: string): Promise<LoadingOrderItem[]>;
  createLoadingOrderItem(item: InsertLoadingOrderItem): Promise<LoadingOrderItem>;
  deleteLoadingOrder(id: string): Promise<void>;
  deleteLoadingOrderItems(loadingOrderId: string): Promise<void>;

  // Loading Order Trips (junction table)
  getLoadingOrderTrips(loadingOrderId: string): Promise<{id: string; tripId: string; addedAt: Date; vehicle2Id?: string | null; vehiclePlate2?: string | null}[]>;
  createLoadingOrderTrip(loadingOrderId: string, tripId: string): Promise<{id: string; tripId: string; addedAt: Date}>;
  deleteLoadingOrderTrips(loadingOrderId: string): Promise<void>;

  // Loading Order Request Slots
  getLoadingOrderRequestSlots(loadingOrderId: string): Promise<{requestId: string; vehicleSlot: number}[]>;
  updateLoadingOrderRequestSlot(loadingOrderId: string, requestId: string, vehicleSlot: number): Promise<void>;

  // Movements
  getMovements(eventId?: string): Promise<Movement[]>;
  getMovement(id: string): Promise<Movement | undefined>;
  getMovementsByLoadingOrder(loadingOrderId: string): Promise<Movement[]>;
  createMovement(movement: InsertMovement): Promise<Movement>;
  createMovementWithEvents(movement: InsertMovementWithEvents): Promise<Movement>;
  updateMovement(id: string, movement: Partial<InsertMovement>): Promise<Movement>;
  deleteMovement(id: string): Promise<void>;

  // Movement Items
  getMovementItems(movementId: string): Promise<MovementItem[]>;
  createMovementItem(item: InsertMovementItem): Promise<MovementItem>;
  decrementMovementItemQuantity(id: string): Promise<MovementItem | null>;
  deleteMovementItem(id: string): Promise<void>;
  getRecentSuppliers(limit?: number): Promise<string[]>;

  // Movement Audit Logs
  createMovementAuditLog(log: InsertMovementAuditLog): Promise<MovementAuditLog>;
  getMovementAuditLogs(movementId: string): Promise<MovementAuditLog[]>;

  // Movement Attachments
  getMovementAttachments(movementId: string): Promise<MovementAttachment[]>;
  createMovementAttachment(data: InsertMovementAttachment): Promise<MovementAttachment>;
  softDeleteMovementAttachment(id: string, movementId: string): Promise<void>;

  // Inventory Movements
  getInventoryMovements(): Promise<InventoryMovement[]>;
  createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement>;

  // Returns
  getReturns(): Promise<Return[]>;
  getReturn(id: string): Promise<Return | undefined>;
  createReturn(returnItem: InsertReturn): Promise<Return>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Authentication & Authorization
  sessionStore: session.Store;
  
  // Users
  getUsers(): Promise<User[]>;
  getUsersForMentionLookup(): Promise<Pick<User, "id" | "username" | "name">[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  
  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  
  // Roles
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role>;
  deleteRole(id: string): Promise<void>;
  
  // Permissions
  getPermissions(): Promise<Permission[]>;
  getPermission(id: string): Promise<Permission | undefined>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  updatePermission(id: string, permission: Partial<InsertPermission>): Promise<Permission>;
  
  // User Roles
  getUserRoles(userId: string): Promise<UserRole[]>;
  assignUserRole(userRole: InsertUserRole): Promise<UserRole>;
  removeUserRole(userId: string, roleId: string): Promise<void>;
  
  // Role Permissions
  getRolePermissions(roleId: string): Promise<RolePermission[]>;
  assignRolePermission(rolePermission: InsertRolePermission): Promise<RolePermission>;
  updateRolePermission(id: string, rolePermission: Partial<InsertRolePermission>): Promise<RolePermission>;
  removeRolePermission(roleId: string, permissionId: string): Promise<void>;
  
  // Comments
  getComments(entityType: string, entityId: string): Promise<Comment[]>;
  getComment(id: string): Promise<Comment | undefined>;
  createComment(comment: InsertComment): Promise<Comment>;
  
  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  
  // Notification Settings
  getNotificationSettings(userId: string): Promise<NotificationSettings | undefined>;
  createNotificationSettings(settings: InsertNotificationSettings): Promise<NotificationSettings>;
  updateNotificationSettings(userId: string, settings: Partial<InsertNotificationSettings>): Promise<NotificationSettings>;
  
  // AI Optimization
  createOptimizationRun(run: InsertOptimizationRun): Promise<OptimizationRun>;
  getOptimizationRun(id: string): Promise<OptimizationRun | undefined>;
  updateOptimizationRun(id: string, data: Partial<InsertOptimizationRun> & {executionTimeMs?: number; errorMessage?: string; completedAt?: Date}): Promise<OptimizationRun>;
  createLoadingOptimization(optimization: InsertLoadingOptimization): Promise<LoadingOptimization>;
  getLoadingOptimizationsByLoadingOrder(loadingOrderId: string): Promise<any[]>;
  createRouteOptimization(optimization: InsertRouteOptimization): Promise<RouteOptimization>;
  getRouteOptimizationsByTrip(tripId: string): Promise<any[]>;
  
  // Movement Groups (Phase 1)
  getMovementGroups(): Promise<MovementGroup[]>;
  getMovementGroup(id: string): Promise<MovementGroup | undefined>;
  createMovementGroup(group: InsertMovementGroup): Promise<MovementGroup>;
  updateMovementGroup(id: string, group: Partial<InsertMovementGroup>): Promise<MovementGroup>;
  deleteMovementGroup(id: string): Promise<void>;
  
  // Movement Types Config (Phase 1)
  getMovementTypesConfig(filters?: { groupId?: string; nature?: string; active?: boolean }): Promise<MovementTypeConfig[]>;
  getMovementTypeConfig(id: string): Promise<MovementTypeConfig | undefined>;
  createMovementTypeConfig(typeConfig: InsertMovementTypeConfig): Promise<MovementTypeConfig>;
  updateMovementTypeConfig(id: string, typeConfig: Partial<InsertMovementTypeConfig>): Promise<MovementTypeConfig>;
  deleteMovementTypeConfig(id: string): Promise<void>;
  
  // Supplier tracking (Phase 1)
  getRecentSuppliersBySku(sku: string, months?: number): Promise<Array<{ name: string; frequency: number; lastUsed: Date }>>;
}

export class DatabaseStorage implements IStorage {
  // Events
  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(desc(events.createdAt));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db.insert(events).values(event).returning();
    return created;
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set({ ...event, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  // Kits
  async getKits(): Promise<Kit[]> {
    return await db.select().from(kits).orderBy(desc(kits.createdAt));
  }

  async getKit(id: string): Promise<Kit | undefined> {
    const [kit] = await db.select().from(kits).where(eq(kits.id, id));
    return kit || undefined;
  }

  async createKit(kit: InsertKit): Promise<Kit> {
    const [created] = await db.insert(kits).values(kit as any).returning();
    return created;
  }

  async updateKit(id: string, kit: Partial<InsertKit>): Promise<Kit> {
    const [updated] = await db.update(kits).set(kit as any).where(eq(kits.id, id)).returning();
    return updated;
  }

  // BOM Lines
  async getBomLinesByKit(kitId: string): Promise<BomLine[]> {
    return await db.select().from(bomLines).where(eq(bomLines.kitId, kitId));
  }

  async createBomLine(bomLine: InsertBomLine): Promise<BomLine> {
    const [created] = await db.insert(bomLines).values(bomLine).returning();
    return created;
  }

  async deleteBomLinesByKit(kitId: string): Promise<void> {
    await db.delete(bomLines).where(eq(bomLines.kitId, kitId));
  }

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier || undefined;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [created] = await db.insert(suppliers).values(supplier).returning();
    return created;
  }

  async updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier> {
    const [updated] = await db.update(suppliers).set(supplier).where(eq(suppliers.id, id)).returning();
    return updated;
  }

  async deleteSupplier(id: string): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product || undefined;
  }

  async getTargetProduct(scannedSku: string): Promise<{ product: Product; isVariant: boolean } | undefined> {
    // First, try to find the product by scanned SKU
    const scannedProduct = await this.getProductBySku(scannedSku);
    
    if (!scannedProduct) {
      return undefined;
    }
    
    // If it's a variant, resolve to the principal product
    if (scannedProduct.productType === 'variante' && scannedProduct.equivalentSku) {
      const principalProduct = await this.getProductBySku(scannedProduct.equivalentSku);
      
      if (!principalProduct) {
        throw new Error(`Principal product not found for variant ${scannedSku}`);
      }
      
      return {
        product: principalProduct,
        isVariant: true
      };
    }
    
    // It's already a principal product
    return {
      product: scannedProduct,
      isVariant: false
    };
  }

  // Material Requests
  // eventId (optional) scopes the query to one event in SQL — used by the
  // event overview so it no longer loads every request just to filter in JS.
  async getMaterialRequests(eventId?: string): Promise<MaterialRequest[]> {
    const requests = await db
      .select({
        id: materialRequests.id,
        eventId: materialRequests.eventId,
        area: materialRequests.area,
        status: materialRequests.status,
        requestedBy: materialRequests.requestedBy,
        submittedAt: materialRequests.submittedAt,
        approvedBy: materialRequests.approvedBy,
        approvedAt: materialRequests.approvedAt,
        cutoffTime: materialRequests.cutoffTime,
        notes: materialRequests.notes,
        createdAt: materialRequests.createdAt,
        event: events,
        requestedByUser: {
          id: users.id,
          name: users.name,
          username: users.username
        }
      })
      .from(materialRequests)
      .leftJoin(events, eq(materialRequests.eventId, events.id))
      .leftJoin(users, eq(materialRequests.requestedBy, users.id))
      .where(eventId ? eq(materialRequests.eventId, eventId) : undefined)
      .orderBy(desc(materialRequests.createdAt));

    return requests as any;
  }

  async getMaterialRequestsByUser(userId: string): Promise<MaterialRequest[]> {
    const requests = await db
      .select({
        id: materialRequests.id,
        eventId: materialRequests.eventId,
        area: materialRequests.area,
        status: materialRequests.status,
        requestedBy: materialRequests.requestedBy,
        submittedAt: materialRequests.submittedAt,
        approvedBy: materialRequests.approvedBy,
        approvedAt: materialRequests.approvedAt,
        cutoffTime: materialRequests.cutoffTime,
        notes: materialRequests.notes,
        createdAt: materialRequests.createdAt,
        event: events,
        requestedByUser: {
          id: users.id,
          name: users.name,
          username: users.username
        }
      })
      .from(materialRequests)
      .leftJoin(events, eq(materialRequests.eventId, events.id))
      .leftJoin(users, eq(materialRequests.requestedBy, users.id))
      .where(eq(materialRequests.requestedBy, userId))
      .orderBy(desc(materialRequests.createdAt));

    return requests as any;
  }

  async getMaterialRequest(id: string): Promise<MaterialRequest | undefined> {
    const [request] = await db
      .select({
        id: materialRequests.id,
        eventId: materialRequests.eventId,
        area: materialRequests.area,
        status: materialRequests.status,
        requestedBy: materialRequests.requestedBy,
        submittedAt: materialRequests.submittedAt,
        approvedBy: materialRequests.approvedBy,
        approvedAt: materialRequests.approvedAt,
        cutoffTime: materialRequests.cutoffTime,
        notes: materialRequests.notes,
        createdAt: materialRequests.createdAt,
        event: events,
        requestedByUser: {
          id: users.id,
          name: users.name,
          username: users.username
        }
      })
      .from(materialRequests)
      .leftJoin(events, eq(materialRequests.eventId, events.id))
      .leftJoin(users, eq(materialRequests.requestedBy, users.id))
      .where(eq(materialRequests.id, id));
    
    return request as any || undefined;
  }

  async createMaterialRequest(request: InsertMaterialRequest): Promise<MaterialRequest> {
    const [created] = await db.insert(materialRequests).values(request).returning();
    return created;
  }

  // Create a request together with its items atomically. Used by the duplicate
  // flow, which previously inserted the request and then looped item inserts on
  // the bare db handle — a failure partway left a request with only some (or
  // none) of the items copied.
  async createRequestWithItems(
    request: InsertMaterialRequest,
    items: InsertRequestItem[]
  ): Promise<MaterialRequest> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(materialRequests).values(request).returning();
      if (items.length > 0) {
        await tx
          .insert(requestItems)
          .values(items.map((item) => ({ ...item, requestId: created.id })));
      }
      return created;
    });
  }

  async updateMaterialRequest(id: string, request: Partial<InsertMaterialRequest>): Promise<MaterialRequest> {
    const [updated] = await db.update(materialRequests).set(request).where(eq(materialRequests.id, id)).returning();
    return updated;
  }

  // Request Items
  async getRequestItems(requestId: string): Promise<RequestItem[]> {
    const items = await db
      .select({
        id: requestItems.id,
        requestId: requestItems.requestId,
        productId: requestItems.productId,
        kitId: requestItems.kitId,
        quantity: requestItems.quantity,
        approvalStatus: requestItems.approvalStatus,
        approvedQuantity: requestItems.approvedQuantity,
        rejectionReason: requestItems.rejectionReason,
        kitParameters: requestItems.kitParameters,
        notes: requestItems.notes,
        product: products,
        kit: kits,
      })
      .from(requestItems)
      .leftJoin(products, eq(requestItems.productId, products.id))
      .leftJoin(kits, eq(requestItems.kitId, kits.id))
      .where(eq(requestItems.requestId, requestId));
    
    return items as any;
  }

  // Reverse lookup for the derived physical-progress feature: given a request,
  // collect the statuses of the loading orders it belongs to and of the trips
  // those orders are assigned to. Trips are reached through loading orders
  // (request -> loading_order_requests -> loading_order_trips -> trips).
  async getRequestDownstream(
    requestId: string
  ): Promise<{ loadingOrderStatuses: string[]; tripStatuses: string[] }> {
    const orders = await db
      .select({ id: loadingOrders.id, status: loadingOrders.status })
      .from(loadingOrderRequests)
      .innerJoin(loadingOrders, eq(loadingOrderRequests.loadingOrderId, loadingOrders.id))
      .where(eq(loadingOrderRequests.requestId, requestId));

    const orderIds = orders.map((o) => o.id);
    const tripRows = orderIds.length
      ? await db
          .select({ status: trips.status })
          .from(loadingOrderTrips)
          .innerJoin(trips, eq(loadingOrderTrips.tripId, trips.id))
          .where(inArray(loadingOrderTrips.loadingOrderId, orderIds))
      : [];

    return {
      loadingOrderStatuses: orders.map((o) => o.status),
      tripStatuses: tripRows.map((t) => t.status),
    };
  }

  async getRequestItemsByRequestIds(requestIds: string[]): Promise<RequestItem[]> {
    if (requestIds.length === 0) return [];
    const items = await db
      .select({
        id: requestItems.id,
        requestId: requestItems.requestId,
        productId: requestItems.productId,
        kitId: requestItems.kitId,
        quantity: requestItems.quantity,
        approvalStatus: requestItems.approvalStatus,
        approvedQuantity: requestItems.approvedQuantity,
        rejectionReason: requestItems.rejectionReason,
        kitParameters: requestItems.kitParameters,
        notes: requestItems.notes,
      })
      .from(requestItems)
      .where(inArray(requestItems.requestId, requestIds));
    return items as any;
  }

  async createRequestItem(item: InsertRequestItem): Promise<RequestItem> {
    const [created] = await db.insert(requestItems).values(item).returning();
    return created;
  }

  async getRequestItem(id: string): Promise<RequestItem | undefined> {
    const [item] = await db.select().from(requestItems).where(eq(requestItems.id, id));
    return item;
  }

  async updateRequestItem(id: string, item: Partial<InsertRequestItem>): Promise<RequestItem> {
    const [updated] = await db
      .update(requestItems)
      .set(item)
      .where(eq(requestItems.id, id))
      .returning();
    return updated;
  }

  async deleteRequestItem(id: string): Promise<void> {
    await db.delete(requestItems).where(eq(requestItems.id, id));
  }

  async deleteMaterialRequest(id: string): Promise<void> {
    await db.delete(materialRequests).where(eq(materialRequests.id, id));
  }

  // Request Approvals
  // The approval writes below run in a transaction: approving the items and
  // flipping the request status must land together, otherwise a failure
  // halfway leaves a request whose items disagree with its own status.
  async approveRequestAll(requestId: string, approverName: string, comments?: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Approve every item in one statement — approvedQuantity is copied from
      // each row's own quantity, so no per-item round trip is needed.
      await tx
        .update(requestItems)
        .set({
          approvalStatus: "approved",
          approvedQuantity: sql`${requestItems.quantity}`,
          rejectionReason: null,
        })
        .where(eq(requestItems.requestId, requestId));

      await tx
        .update(materialRequests)
        .set({
          status: "approved",
          approvedBy: approverName,
          approvedAt: new Date(),
          notes: comments ? `${comments}\n---\nAprovação completa` : "Aprovação completa",
        })
        .where(eq(materialRequests.id, requestId));
    });
  }

  async approveRequestPartial(
    requestId: string,
    approverName: string,
    itemApprovals: Array<{itemId: string, status: string, approvedQuantity?: number, rejectionReason?: string}>,
    comments?: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Item decisions differ per row, so these stay individual statements —
      // but they must not be visible without the matching request status.
      for (const approval of itemApprovals) {
        await tx
          .update(requestItems)
          .set({
            approvalStatus: approval.status as any,
            approvedQuantity: approval.approvedQuantity,
            rejectionReason: approval.rejectionReason || null,
          })
          .where(
            and(
              eq(requestItems.id, approval.itemId),
              // Scope to the request being approved so a caller cannot decide
              // items belonging to someone else's request by passing their ids.
              eq(requestItems.requestId, requestId)
            )
          );
      }

      // Re-read inside the transaction so the derived status reflects the
      // writes above rather than a pre-update snapshot.
      const items = await tx.select().from(requestItems).where(eq(requestItems.requestId, requestId));
      const hasApproved = items.some(i => i.approvalStatus === "approved");
      const allRejected = items.every(i => i.approvalStatus === "rejected");

      let requestStatus: string;
      if (allRejected) {
        requestStatus = "rejected";
      } else if (hasApproved) {
        requestStatus = "approved";
      } else {
        requestStatus = "pending_approval";
      }

      await tx
        .update(materialRequests)
        .set({
          status: requestStatus as any,
          approvedBy: approverName,
          approvedAt: new Date(),
          notes: comments ? `${comments}\n---\nAprovação parcial` : "Aprovação parcial",
        })
        .where(eq(materialRequests.id, requestId));
    });
  }

  async rejectRequestAll(requestId: string, approverName: string, reason: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(requestItems)
        .set({
          approvalStatus: "rejected",
          approvedQuantity: 0,
          rejectionReason: reason,
        })
        .where(eq(requestItems.requestId, requestId));

      await tx
        .update(materialRequests)
        .set({
          status: "rejected",
          approvedBy: approverName,
          approvedAt: new Date(),
          rejectionReason: reason,
        })
        .where(eq(materialRequests.id, requestId));
    });
  }

  // Send a rejected request back to draft so its owner can fix and resubmit it,
  // instead of the rejection being a dead end that forces recreating from
  // scratch. Clears the approval verdict on both the request and its items
  // (back to pending) atomically.
  async reopenRequest(requestId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(requestItems)
        .set({
          approvalStatus: "pending",
          approvedQuantity: null,
          rejectionReason: null,
        })
        .where(eq(requestItems.requestId, requestId));

      await tx
        .update(materialRequests)
        .set({
          status: "draft",
          approvedBy: null,
          approvedAt: null,
          rejectionReason: null,
          submittedAt: null,
        })
        .where(eq(materialRequests.id, requestId));
    });
  }

  // Vehicle Types
  async getVehicleTypes(): Promise<VehicleType[]> {
    return await db.select().from(vehicleTypes).orderBy(desc(vehicleTypes.createdAt));
  }

  async getVehicleType(id: string): Promise<VehicleType | undefined> {
    const [vehicleType] = await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, id));
    return vehicleType || undefined;
  }

  async createVehicleType(vehicleType: InsertVehicleType): Promise<VehicleType> {
    const [created] = await db.insert(vehicleTypes).values(vehicleType).returning();
    return created;
  }

  async updateVehicleType(id: string, vehicleType: Partial<InsertVehicleType>): Promise<VehicleType> {
    const [updated] = await db.update(vehicleTypes).set(vehicleType).where(eq(vehicleTypes.id, id)).returning();
    return updated;
  }

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle || undefined;
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [created] = await db.insert(vehicles).values(vehicle).returning();
    return created;
  }

  async updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle> {
    const [updated] = await db.update(vehicles).set(vehicle).where(eq(vehicles.id, id)).returning();
    return updated;
  }

  async deleteVehicle(id: string): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
  }

  // Drivers
  async getDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers).orderBy(desc(drivers.createdAt));
  }

  async getDriver(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver || undefined;
  }

  async createDriver(driver: InsertDriver): Promise<Driver> {
    const [created] = await db.insert(drivers).values(driver).returning();
    return created;
  }

  async updateDriver(id: string, driver: Partial<InsertDriver>): Promise<Driver> {
    const [updated] = await db.update(drivers).set(driver).where(eq(drivers.id, id)).returning();
    return updated;
  }

  async deleteDriver(id: string): Promise<void> {
    await db.delete(drivers).where(eq(drivers.id, id));
  }

  // Docks
  async getDocks(): Promise<Dock[]> {
    return await db.select().from(docks).orderBy(desc(docks.createdAt));
  }

  async getDock(id: string): Promise<Dock | undefined> {
    const [dock] = await db.select().from(docks).where(eq(docks.id, id));
    return dock || undefined;
  }

  async createDock(dock: InsertDock): Promise<Dock> {
    const [created] = await db.insert(docks).values(dock).returning();
    return created;
  }

  async updateDock(id: string, dock: Partial<InsertDock>): Promise<Dock> {
    const [updated] = await db.update(docks).set(dock).where(eq(docks.id, id)).returning();
    return updated;
  }

  async deleteDock(id: string): Promise<void> {
    await db.delete(docks).where(eq(docks.id, id));
  }

  // Trips
  async getTrips(eventId?: string): Promise<Trip[]> {
    return await db.query.trips.findMany({
      where: eventId ? eq(trips.eventId, eventId) : undefined,
      with: {
        event: true,
        vehicle: true,
        vehicleType: true,
        driver: true,
        dock: true,
        destinations: true
      },
      orderBy: (trips, { desc }) => [desc(trips.createdAt)]
    });
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    return await db.query.trips.findFirst({
      where: (trips, { eq }) => eq(trips.id, id),
      with: {
        event: true,
        vehicle: true,
        vehicleType: true,
        driver: true,
        dock: true,
        destinations: true
      }
    });
  }

  async createTrip(trip: InsertTrip): Promise<Trip> {
    const [created] = await db.insert(trips).values(trip).returning();
    return created;
  }

  async updateTrip(id: string, trip: Partial<InsertTrip>): Promise<Trip> {
    const [updated] = await db.update(trips).set(trip).where(eq(trips.id, id)).returning();
    return updated;
  }

  // Trip Items
  async getTripItems(tripId: string): Promise<TripItem[]> {
    return await db.select().from(tripItems).where(eq(tripItems.tripId, tripId));
  }

  async createTripItem(item: InsertTripItem): Promise<TripItem> {
    const [created] = await db.insert(tripItems).values(item).returning();
    return created;
  }

  // Trip Events (junction table)
  async getTripEvents(tripId: string): Promise<TripEvent[]> {
    return await db.select().from(tripEvents).where(eq(tripEvents.tripId, tripId));
  }

  async createTripEvent(tripEvent: InsertTripEvent): Promise<TripEvent> {
    const [created] = await db.insert(tripEvents).values(tripEvent).returning();
    return created;
  }

  async deleteTripEvents(tripId: string): Promise<void> {
    await db.delete(tripEvents).where(eq(tripEvents.tripId, tripId));
  }

  // Trip Destinations
  async getTripDestinations(tripId: string): Promise<TripDestination[]> {
    return await db.select().from(tripDestinations).where(eq(tripDestinations.tripId, tripId)).orderBy(tripDestinations.sequence);
  }

  async createTripDestination(destination: InsertTripDestination): Promise<TripDestination> {
    const [created] = await db.insert(tripDestinations).values(destination).returning();
    return created;
  }

  async deleteTripDestinations(tripId: string): Promise<void> {
    await db.delete(tripDestinations).where(eq(tripDestinations.tripId, tripId));
  }

  // Loading Orders
  async getLoadingOrders(eventId?: string): Promise<any[]> {
    const itemsAgg = db
      .select({
        loadingOrderId: loadingOrderItems.loadingOrderId,
        totalItems: sql<number>`COALESCE(SUM(${loadingOrderItems.consolidatedQuantity}), 0)`.as("totalItems"),
        loadedItems: sql<number>`COALESCE(SUM(${loadingOrderItems.loadedQuantity}), 0)`.as("loadedItems"),
      })
      .from(loadingOrderItems)
      .groupBy(loadingOrderItems.loadingOrderId)
      .as("itemsAgg");

    const results = await db
      .select({
        id: loadingOrders.id,
        eventId: loadingOrders.eventId,
        orderNumber: loadingOrders.orderNumber,
        status: loadingOrders.status,
        plannedStartTime: loadingOrders.plannedStartTime,
        plannedEndTime: loadingOrders.plannedEndTime,
        actualStartTime: loadingOrders.actualStartTime,
        actualEndTime: loadingOrders.actualEndTime,
        loadingDate: loadingOrders.loadingDate,
        unloadingDate: loadingOrders.unloadingDate,
        createdBy: loadingOrders.createdBy,
        notes: loadingOrders.notes,
        createdAt: loadingOrders.createdAt,
        updatedAt: loadingOrders.updatedAt,
        event: events,
        totalItems: itemsAgg.totalItems,
        loadedItems: itemsAgg.loadedItems,
      })
      .from(loadingOrders)
      .leftJoin(events, eq(loadingOrders.eventId, events.id))
      .leftJoin(itemsAgg, eq(loadingOrders.id, itemsAgg.loadingOrderId))
      .where(eventId ? eq(loadingOrders.eventId, eventId) : undefined)
      .orderBy(desc(loadingOrders.createdAt));

    // Resolve user names for createdBy
    const userIds = Array.from(new Set(results.filter(r => r.createdBy).map(r => r.createdBy)));
    const userNames: Record<string, string> = {};
    if (userIds.length > 0) {
      const userRows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
      for (const u of userRows) {
        userNames[u.id] = u.name || u.id;
      }
    }

    return results.map(r => ({
      ...r,
      createdBy: userNames[r.createdBy] || r.createdBy,
    }));
  }

  async getLoadingOrder(id: string): Promise<LoadingOrder | undefined> {
    const [order] = await db.select().from(loadingOrders).where(eq(loadingOrders.id, id));
    return order || undefined;
  }

  async createLoadingOrder(order: InsertLoadingOrder): Promise<LoadingOrder> {
    const [created] = await db.insert(loadingOrders).values(order).returning();
    return created;
  }

  async updateLoadingOrder(id: string, order: Partial<InsertLoadingOrder>): Promise<LoadingOrder> {
    const [updated] = await db.update(loadingOrders).set(order).where(eq(loadingOrders.id, id)).returning();
    return updated;
  }

  async approveLoadingOrder(id: string): Promise<LoadingOrder> {
    const [updated] = await db
      .update(loadingOrders)
      .set({ status: "approved", updatedAt: sql`now()` })
      .where(eq(loadingOrders.id, id))
      .returning();
    return updated;
  }

  async disapproveLoadingOrder(id: string): Promise<LoadingOrder> {
    const [updated] = await db
      .update(loadingOrders)
      .set({ status: "draft", updatedAt: sql`now()` })
      .where(eq(loadingOrders.id, id))
      .returning();
    return updated;
  }

  async markLoadingOrderAsReady(id: string): Promise<LoadingOrder> {
    const [updated] = await db
      .update(loadingOrders)
      .set({ status: "ready", updatedAt: sql`now()` })
      .where(eq(loadingOrders.id, id))
      .returning();
    return updated;
  }

  // Loading Order Requests (junction table)
  async getLoadingOrderRequests(loadingOrderId: string): Promise<LoadingOrderRequest[]> {
    return await db.select().from(loadingOrderRequests).where(eq(loadingOrderRequests.loadingOrderId, loadingOrderId));
  }

  async createLoadingOrderRequest(relation: InsertLoadingOrderRequest): Promise<LoadingOrderRequest> {
    const [created] = await db.insert(loadingOrderRequests).values(relation).returning();
    return created;
  }

  // Loading Order Items
  async getLoadingOrderItems(loadingOrderId: string): Promise<LoadingOrderItem[]> {
    const items = await db
      .select({
        id: loadingOrderItems.id,
        loadingOrderId: loadingOrderItems.loadingOrderId,
        productId: loadingOrderItems.productId,
        consolidatedQuantity: loadingOrderItems.consolidatedQuantity,
        pickedQuantity: loadingOrderItems.pickedQuantity,
        loadedQuantity: loadingOrderItems.loadedQuantity,
        sourceRequests: loadingOrderItems.sourceRequests,
        product: products,
      })
      .from(loadingOrderItems)
      .leftJoin(products, eq(loadingOrderItems.productId, products.id))
      .where(eq(loadingOrderItems.loadingOrderId, loadingOrderId));
    
    return items as any;
  }

  async createLoadingOrderItem(item: InsertLoadingOrderItem): Promise<LoadingOrderItem> {
    const [created] = await db.insert(loadingOrderItems).values(item as any).returning();
    return created;
  }

  async deleteLoadingOrder(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(loadingOrderRequests).where(eq(loadingOrderRequests.loadingOrderId, id));
      await tx.delete(loadingOrderItems).where(eq(loadingOrderItems.loadingOrderId, id));
      await tx.delete(loadingOrderTrips).where(eq(loadingOrderTrips.loadingOrderId, id));
      await tx.delete(loadingOrders).where(eq(loadingOrders.id, id));
    });
  }

  async deleteLoadingOrderItems(loadingOrderId: string): Promise<void> {
    await db.delete(loadingOrderItems).where(eq(loadingOrderItems.loadingOrderId, loadingOrderId));
  }

  // Loading Order Trips (junction table)
  async getLoadingOrderTrips(loadingOrderId: string): Promise<{id: string; tripId: string; addedAt: Date; vehicle2Id?: string | null; vehiclePlate2?: string | null}[]> {
    const results = await db
      .select({
        id: loadingOrderTrips.id,
        tripId: loadingOrderTrips.tripId,
        addedAt: loadingOrderTrips.addedAt,
        vehicle2Id: trips.vehicle2Id,
        vehiclePlate2: trips.vehiclePlate2,
      })
      .from(loadingOrderTrips)
      .leftJoin(trips, eq(loadingOrderTrips.tripId, trips.id))
      .where(eq(loadingOrderTrips.loadingOrderId, loadingOrderId));
    return results.map(r => ({
      id: r.id,
      tripId: r.tripId,
      addedAt: r.addedAt,
      vehicle2Id: r.vehicle2Id,
      vehiclePlate2: r.vehiclePlate2,
    }));
  }

  async getLoadingOrderRequestSlots(loadingOrderId: string): Promise<{requestId: string; vehicleSlot: number}[]> {
    const results = await db
      .select({ requestId: loadingOrderRequests.requestId, vehicleSlot: loadingOrderRequests.vehicleSlot })
      .from(loadingOrderRequests)
      .where(eq(loadingOrderRequests.loadingOrderId, loadingOrderId));
    return results.map(r => ({ requestId: r.requestId, vehicleSlot: r.vehicleSlot ?? 1 }));
  }

  async updateLoadingOrderRequestSlot(loadingOrderId: string, requestId: string, vehicleSlot: number): Promise<void> {
    await db
      .update(loadingOrderRequests)
      .set({ vehicleSlot })
      .where(
        and(
          eq(loadingOrderRequests.loadingOrderId, loadingOrderId),
          eq(loadingOrderRequests.requestId, requestId)
        )
      );
  }

  async createLoadingOrderTrip(loadingOrderId: string, tripId: string): Promise<{id: string; tripId: string; addedAt: Date}> {
    const [created] = await db.insert(loadingOrderTrips).values({ loadingOrderId, tripId }).returning();
    return {
      id: created.id,
      tripId: created.tripId,
      addedAt: created.addedAt
    };
  }

  async deleteLoadingOrderTrips(loadingOrderId: string): Promise<void> {
    await db.delete(loadingOrderTrips).where(eq(loadingOrderTrips.loadingOrderId, loadingOrderId));
  }

  // Movements
  // Batch-load event and trip relations for a list of movements in a fixed
  // number of queries (avoids the N+1 pattern of one query per movement).
  private async attachMovementRelations<T extends { id: string }>(
    movementsData: T[]
  ): Promise<(T & { events: any[]; trips: any[] })[]> {
    if (movementsData.length === 0) return movementsData as any;

    const ids = movementsData.map((m) => m.id);

    const eventRelations = await db
      .select({
        movementId: movementEvents.movementId,
        event: events,
      })
      .from(movementEvents)
      .leftJoin(events, eq(movementEvents.eventId, events.id))
      .where(inArray(movementEvents.movementId, ids));

    const tripRelations = await db
      .select({
        movementId: movementTrips.movementId,
        trip: trips,
      })
      .from(movementTrips)
      .leftJoin(trips, eq(movementTrips.tripId, trips.id))
      .where(inArray(movementTrips.movementId, ids));

    const eventsByMovement = new Map<string, any[]>();
    for (const r of eventRelations) {
      if (!r.event) continue;
      const arr = eventsByMovement.get(r.movementId) ?? [];
      arr.push(r.event);
      eventsByMovement.set(r.movementId, arr);
    }

    const tripsByMovement = new Map<string, any[]>();
    for (const r of tripRelations) {
      if (!r.trip) continue;
      const arr = tripsByMovement.get(r.movementId) ?? [];
      arr.push(r.trip);
      tripsByMovement.set(r.movementId, arr);
    }

    // Batch-load loading orders and material requests referenced by these movements
    const loadingOrderIds = Array.from(
      new Set(movementsData.map((m) => (m as any).loadingOrderId).filter(Boolean))
    ) as string[];
    const requestIds = Array.from(
      new Set(movementsData.map((m) => (m as any).requestId).filter(Boolean))
    ) as string[];

    const loadingOrderRows = loadingOrderIds.length
      ? await db
          .select({
            id: loadingOrders.id,
            orderNumber: loadingOrders.orderNumber,
            eventId: loadingOrders.eventId,
            status: loadingOrders.status,
          })
          .from(loadingOrders)
          .where(inArray(loadingOrders.id, loadingOrderIds))
      : [];

    const requestRows = requestIds.length
      ? await db
          .select({
            id: materialRequests.id,
            area: materialRequests.area,
            eventId: materialRequests.eventId,
            status: materialRequests.status,
            eventName: events.name,
          })
          .from(materialRequests)
          .leftJoin(events, eq(materialRequests.eventId, events.id))
          .where(inArray(materialRequests.id, requestIds))
      : [];

    const loadingOrderById = new Map(loadingOrderRows.map((r) => [r.id, r]));
    const requestById = new Map(
      requestRows.map((r) => [
        r.id,
        {
          id: r.id,
          area: r.area,
          eventId: r.eventId,
          status: r.status,
          event: r.eventName ? { id: r.eventId, name: r.eventName } : undefined,
        },
      ])
    );

    // Batch-load requests from junction table (new multi-request support)
    const junctionRequestRows = ids.length
      ? await db
          .select({
            movementId: movementRequests.movementId,
            id: materialRequests.id,
            area: materialRequests.area,
            eventId: materialRequests.eventId,
            status: materialRequests.status,
            eventName: events.name,
          })
          .from(movementRequests)
          .leftJoin(materialRequests, eq(movementRequests.requestId, materialRequests.id))
          .leftJoin(events, eq(materialRequests.eventId, events.id))
          .where(inArray(movementRequests.movementId, ids))
      : [];

    const junctionRequestsByMovement = new Map<string, any[]>();
    for (const r of junctionRequestRows) {
      if (!r.id) continue;
      const arr = junctionRequestsByMovement.get(r.movementId) ?? [];
      arr.push({
        id: r.id,
        area: r.area,
        eventId: r.eventId,
        status: r.status,
        event: r.eventName ? { id: r.eventId, name: r.eventName } : undefined,
      });
      junctionRequestsByMovement.set(r.movementId, arr);
    }

    // ── Batch aggregate: loaded items stats ──────────────────────────────
    const loadedStatsRows = ids.length
      ? await db
          .select({
            movementId: movementItems.movementId,
            itemCount: sql<string>`COUNT(*)`,
            totalUnits: sql<string>`COALESCE(SUM(${movementItems.quantity}), 0)`,
          })
          .from(movementItems)
          .where(inArray(movementItems.movementId, ids))
          .groupBy(movementItems.movementId)
      : [];

    // ── Batch aggregate: evidence counts ────────────────────────────────
    const evidenceStatsRows = ids.length
      ? await db
          .select({
            movementId: movementAttachments.movementId,
            evidenceCount: sql<string>`COUNT(*)`,
          })
          .from(movementAttachments)
          .where(
            and(
              inArray(movementAttachments.movementId, ids),
              sql`${movementAttachments.deletedAt} IS NULL`
            )
          )
          .groupBy(movementAttachments.movementId)
      : [];

    // ── Batch aggregate: expected from requests (junction table) ─────────
    // NOTE: kit items (productId IS NULL, kitId IS NOT NULL) require BOM
    // expansion that can't be done in SQL. We detect their presence so we
    // can suppress the misleading "expected" when kits are involved.
    const expectedFromRequestRows = ids.length
      ? await db
          .select({
            movementId: movementRequests.movementId,
            itemCount: sql<string>`COUNT(DISTINCT CASE WHEN ${requestItems.productId} IS NOT NULL THEN ${requestItems.id} END)`,
            totalUnits: sql<string>`COALESCE(SUM(CASE WHEN ${requestItems.productId} IS NOT NULL AND (${requestItems.approvedQuantity} IS NOT NULL) THEN ${requestItems.approvedQuantity} WHEN ${requestItems.productId} IS NOT NULL THEN ${requestItems.quantity} ELSE 0 END), 0)`,
            hasKitItems: sql<string>`(COUNT(CASE WHEN ${requestItems.kitId} IS NOT NULL THEN 1 END) > 0)::text`,
          })
          .from(movementRequests)
          .innerJoin(requestItems, eq(movementRequests.requestId, requestItems.requestId))
          .where(
            and(
              inArray(movementRequests.movementId, ids),
              sql`${requestItems.approvalStatus} != 'rejected'`
            )
          )
          .groupBy(movementRequests.movementId)
      : [];

    // ── Batch aggregate: expected from loading orders ─────────────────────
    const loIdsForExpected = Array.from(
      new Set(movementsData.map((m) => (m as any).loadingOrderId).filter(Boolean))
    ) as string[];
    const expectedFromLORows = loIdsForExpected.length
      ? await db
          .select({
            loadingOrderId: loadingOrderItems.loadingOrderId,
            itemCount: sql<string>`COUNT(*)`,
            totalUnits: sql<string>`COALESCE(SUM(${loadingOrderItems.consolidatedQuantity}), 0)`,
          })
          .from(loadingOrderItems)
          .where(inArray(loadingOrderItems.loadingOrderId, loIdsForExpected))
          .groupBy(loadingOrderItems.loadingOrderId)
      : [];

    const loadedStatsByMovement = new Map(loadedStatsRows.map((s) => [s.movementId, s]));
    const evidenceStatsByMovement = new Map(evidenceStatsRows.map((s) => [s.movementId, s]));
    const expectedFromRequestsByMovement = new Map(expectedFromRequestRows.map((s) => [s.movementId, s]));
    const expectedFromLOByLOId = new Map(expectedFromLORows.map((s) => [s.loadingOrderId, s]));

    return movementsData.map((m) => {
      // Prefer junction table requests; fall back to legacy requestId column
      const junctionReqs = junctionRequestsByMovement.get(m.id) ?? [];
      const legacyRequest = (m as any).requestId
        ? requestById.get((m as any).requestId) ?? undefined
        : undefined;
      const requests = junctionReqs.length > 0
        ? junctionReqs
        : legacyRequest ? [legacyRequest] : [];

      const loadedStat = loadedStatsByMovement.get(m.id);
      const evidenceStat = evidenceStatsByMovement.get(m.id);
      // Loading order takes priority over requests (matches movement-details.tsx behavior).
      // When requests contain kit items, BOM expansion can't be done in SQL so
      // the product-only sum underestimates expected — we flag it so the UI can
      // compensate (show max(loaded, expected) instead of raw expected).
      const requestStat = expectedFromRequestsByMovement.get(m.id);
      const requestHasKits = requestStat?.hasKitItems === "true";
      const expectedStat =
        ((m as any).loadingOrderId
          ? expectedFromLOByLOId.get((m as any).loadingOrderId)
          : undefined) ??
        requestStat;

      const _stats = {
        itemsLoaded: Number(loadedStat?.itemCount ?? 0),
        unitsLoaded: Number(loadedStat?.totalUnits ?? 0),
        itemsExpected: Number(expectedStat?.itemCount ?? 0),
        unitsExpected: Number(expectedStat?.totalUnits ?? 0),
        evidenceCount: Number(evidenceStat?.evidenceCount ?? 0),
        hasKitItems: requestHasKits && !(m as any).loadingOrderId,
      };

      return {
        ...m,
        events: eventsByMovement.get(m.id) ?? [],
        trips: tripsByMovement.get(m.id) ?? [],
        loadingOrder: (m as any).loadingOrderId
          ? loadingOrderById.get((m as any).loadingOrderId) ?? undefined
          : undefined,
        request: requests[0] ?? undefined,
        requests,
        _stats,
      };
    });
  }

  async getMovements(eventId?: string): Promise<Movement[]> {
    // When scoped to an event, first resolve the movement ids linked to it via
    // the movement_events junction (same semantics as the JS `m.events` filter),
    // then load only those instead of every movement in the system.
    let movementsData;
    if (eventId) {
      const linked = await db
        .select({ movementId: movementEvents.movementId })
        .from(movementEvents)
        .where(eq(movementEvents.eventId, eventId));
      const ids = linked.map((l) => l.movementId);
      if (ids.length === 0) return [];
      movementsData = await db
        .select()
        .from(movements)
        .where(inArray(movements.id, ids))
        .orderBy(desc(movements.createdAt));
    } else {
      movementsData = await db
        .select()
        .from(movements)
        .orderBy(desc(movements.createdAt));
    }

    return (await this.attachMovementRelations(movementsData)) as any;
  }

  async getMovement(id: string): Promise<Movement | undefined> {
    const movementData = await db.query.movements.findFirst({
      where: eq(movements.id, id),
      with: {
        movementTypeConfig: {
          with: {
            group: true
          }
        }
      }
    });
    
    if (!movementData) return undefined;
    
    // Get associated events
    const eventRelations = await db
      .select({
        event: events,
      })
      .from(movementEvents)
      .leftJoin(events, eq(movementEvents.eventId, events.id))
      .where(eq(movementEvents.movementId, movementData.id));
    
    // Get associated trips
    const tripRelations = await db
      .select({
        trip: trips,
      })
      .from(movementTrips)
      .leftJoin(trips, eq(movementTrips.tripId, trips.id))
      .where(eq(movementTrips.movementId, movementData.id));
    
    // Loading order link (if any)
    let loadingOrder: any = undefined;
    if (movementData.loadingOrderId) {
      const [lo] = await db
        .select({
          id: loadingOrders.id,
          orderNumber: loadingOrders.orderNumber,
          eventId: loadingOrders.eventId,
          status: loadingOrders.status,
        })
        .from(loadingOrders)
        .where(eq(loadingOrders.id, movementData.loadingOrderId));
      loadingOrder = lo || undefined;
    }

    // Load requests from junction table (new multi-request support)
    const junctionReqRows = await db
      .select({
        id: materialRequests.id,
        area: materialRequests.area,
        eventId: materialRequests.eventId,
        status: materialRequests.status,
        eventName: events.name,
      })
      .from(movementRequests)
      .leftJoin(materialRequests, eq(movementRequests.requestId, materialRequests.id))
      .leftJoin(events, eq(materialRequests.eventId, events.id))
      .where(eq(movementRequests.movementId, movementData.id));

    let requests: any[] = junctionReqRows
      .filter(r => r.id)
      .map(r => ({
        id: r.id,
        area: r.area,
        eventId: r.eventId,
        status: r.status,
        event: r.eventName ? { id: r.eventId, name: r.eventName } : undefined,
      }));

    // Fallback: legacy requestId column on movements table
    if (requests.length === 0 && movementData.requestId) {
      const [rq] = await db
        .select({
          id: materialRequests.id,
          area: materialRequests.area,
          eventId: materialRequests.eventId,
          status: materialRequests.status,
          eventName: events.name,
        })
        .from(materialRequests)
        .leftJoin(events, eq(materialRequests.eventId, events.id))
        .where(eq(materialRequests.id, movementData.requestId));
      if (rq) {
        requests = [{
          id: rq.id,
          area: rq.area,
          eventId: rq.eventId,
          status: rq.status,
          event: rq.eventName ? { id: rq.eventId, name: rq.eventName } : undefined,
        }];
      }
    }

    return {
      ...movementData,
      events: eventRelations.map(r => r.event).filter(Boolean),
      trips: tripRelations.map(r => r.trip).filter(Boolean),
      loadingOrder,
      request: requests[0] ?? undefined,
      requests,
    } as any;
  }

  async getMovementsByLoadingOrder(loadingOrderId: string): Promise<Movement[]> {
    // Get all movements for this loading order
    const movementsData = await db
      .select()
      .from(movements)
      .where(eq(movements.loadingOrderId, loadingOrderId))
      .orderBy(desc(movements.createdAt));

    return (await this.attachMovementRelations(movementsData)) as any;
  }

  async createMovement(movement: InsertMovement): Promise<Movement> {
    const [created] = await db.insert(movements).values(movement as any).returning();
    return created;
  }

  async createMovementWithEvents(movementData: InsertMovementWithEvents): Promise<Movement> {
    const { eventIds, tripIds, requestIds, ...movementInsert } = movementData as any;
    
    // Check if movement type requires approval
    let finalStatus = movementInsert.status || "created";
    
    if (movementInsert.movementTypeConfigId) {
      const typeConfig = await db.query.movementTypesConfig.findFirst({
        where: eq(movementTypesConfig.id, movementInsert.movementTypeConfigId)
      });
      
      if (typeConfig?.requiresApproval) {
        finalStatus = "pending_approval";
      }
    }
    
    // The movement and its junction rows are one unit: a failure partway
    // through used to leave a movement with no events/trips/requests attached,
    // which reads as a valid but silently incomplete record.
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(movements).values({
        ...movementInsert,
        status: finalStatus
      } as any).returning();

      // Create the junction records for events
      if (eventIds && eventIds.length > 0) {
        await tx.insert(movementEvents).values(
          eventIds.map((eventId: string) => ({
            movementId: created.id,
            eventId
          }))
        );
      }

      // Create the junction records for trips
      if (tripIds && tripIds.length > 0) {
        await tx.insert(movementTrips).values(
          tripIds.map((tripId: string) => ({
            movementId: created.id,
            tripId
          }))
        );
      }

      // Create the junction records for requests (multi-request support)
      if (requestIds && requestIds.length > 0) {
        await tx.insert(movementRequests).values(
          requestIds.map((requestId: string) => ({
            movementId: created.id,
            requestId
          }))
        );
      }

      return created;
    });
  }

  async updateMovementRequests(movementId: string, requestIds: string[]): Promise<void> {
    // Delete-then-insert: without a transaction a failing insert would leave
    // the movement with its request links wiped and nothing put back.
    await db.transaction(async (tx) => {
      await tx.delete(movementRequests).where(eq(movementRequests.movementId, movementId));
      if (requestIds.length > 0) {
        await tx.insert(movementRequests).values(
          requestIds.map((requestId) => ({ movementId, requestId }))
        );
      }
    });
  }

  async updateMovement(id: string, movement: Partial<InsertMovement>): Promise<Movement> {
    const [updated] = await db.update(movements).set({...movement, updatedAt: sql`now()`}).where(eq(movements.id, id)).returning();
    return updated;
  }

  // Movement Approvals
  async listPendingMovements(): Promise<Movement[]> {
    const movementsData = await db.query.movements.findMany({
      where: eq(movements.status, "pending_approval"),
      with: {
        movementTypeConfig: {
          with: {
            group: true
          }
        }
      },
      orderBy: [desc(movements.createdAt)]
    });

    return (await this.attachMovementRelations(movementsData)) as any;
  }

  async approveMovement(id: string, approvedBy: string): Promise<Movement> {
    const [updated] = await db.update(movements)
      .set({
        status: "created",
        approvedBy,
        approvedAt: new Date(),
        updatedAt: sql`now()`
      })
      .where(eq(movements.id, id))
      .returning();
    return updated;
  }

  async rejectMovement(id: string, rejectedBy: string, rejectionReason: string): Promise<Movement> {
    const [updated] = await db.update(movements)
      .set({
        status: "cancelled",
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason,
        updatedAt: sql`now()`
      })
      .where(eq(movements.id, id))
      .returning();
    return updated;
  }

  // Movement Items
  async getMovementItems(movementId: string): Promise<MovementItem[]> {
    return await db.select().from(movementItems).where(eq(movementItems.movementId, movementId));
  }

  async createMovementItem(item: InsertMovementItem): Promise<MovementItem> {
    const [created] = await db.insert(movementItems).values(item).returning();
    return created;
  }

  async decrementMovementItemQuantity(id: string): Promise<MovementItem | null> {
    // Get current item
    const [item] = await db.select().from(movementItems).where(eq(movementItems.id, id));
    if (!item) {
      return null;
    }

    // If quantity is 1, delete the item
    if (item.quantity <= 1) {
      await db.delete(movementItems).where(eq(movementItems.id, id));
      return null;
    }

    // Otherwise, decrement quantity by 1
    const [updated] = await db
      .update(movementItems)
      .set({ quantity: item.quantity - 1 })
      .where(eq(movementItems.id, id))
      .returning();
    
    return updated;
  }

  async deleteMovementItem(id: string): Promise<void> {
    await db.delete(movementItems).where(eq(movementItems.id, id));
  }

  // Manual cascade: if one of these fails midway the children are gone but the
  // parent survives (or the reverse), leaving orphan rows behind.
  async deleteMovement(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(movementAuditLogs).where(eq(movementAuditLogs.movementId, id));
      await tx.delete(movementItems).where(eq(movementItems.movementId, id));
      await tx.delete(movementEvents).where(eq(movementEvents.movementId, id));
      await tx.delete(movementTrips).where(eq(movementTrips.movementId, id));
      await tx.delete(movements).where(eq(movements.id, id));
    });
  }

  async getRecentSuppliers(limit: number = 10): Promise<string[]> {
    const recent = await db
      .select({ ownerName: movementItems.ownerName })
      .from(movementItems)
      .where(
        and(
          sql`${movementItems.ownerName} IS NOT NULL`,
          sql`${movementItems.ownerType} IS NOT NULL`,
          sql`${movementItems.ownerType} != 'proprio'`
        )
      )
      .groupBy(movementItems.ownerName)
      .orderBy(sql`MAX(${movementItems.processedAt}) DESC NULLS LAST`)
      .limit(limit);
    
    return recent
      .map(r => r.ownerName)
      .filter((name): name is string => name !== null);
  }

  // Movement Audit Logs
  async createMovementAuditLog(log: InsertMovementAuditLog): Promise<MovementAuditLog> {
    const [created] = await db.insert(movementAuditLogs).values(log).returning();
    return created;
  }

  async getMovementAuditLogs(movementId: string): Promise<MovementAuditLog[]> {
    return await db
      .select()
      .from(movementAuditLogs)
      .where(eq(movementAuditLogs.movementId, movementId))
      .orderBy(desc(movementAuditLogs.occurredAt));
  }

  // Movement Attachments
  async getMovementAttachments(movementId: string): Promise<MovementAttachment[]> {
    return await db
      .select()
      .from(movementAttachments)
      .where(
        and(
          eq(movementAttachments.movementId, movementId),
          sql`${movementAttachments.deletedAt} IS NULL`
        )
      )
      .orderBy(desc(movementAttachments.createdAt));
  }

  async createMovementAttachment(data: InsertMovementAttachment): Promise<MovementAttachment> {
    const [created] = await db.insert(movementAttachments).values(data).returning();
    return created;
  }

  async softDeleteMovementAttachment(id: string, movementId: string): Promise<void> {
    await db
      .update(movementAttachments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(movementAttachments.id, id),
          eq(movementAttachments.movementId, movementId)
        )
      );
  }

  // Inventory Movements
  async getInventoryMovements(): Promise<InventoryMovement[]> {
    return await db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt));
  }

  async createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement> {
    const [created] = await db.insert(inventoryMovements).values(movement).returning();
    return created;
  }

  // Returns
  async getReturns(): Promise<Return[]> {
    return await db.select().from(returns).orderBy(desc(returns.createdAt));
  }

  async getReturn(id: string): Promise<Return | undefined> {
    const [returnItem] = await db.select().from(returns).where(eq(returns.id, id));
    return returnItem || undefined;
  }

  async createReturn(returnItem: InsertReturn): Promise<Return> {
    const [created] = await db.insert(returns).values(returnItem).returning();
    return created;
  }

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  // Session Store
  public sessionStore: session.Store;

  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true 
    });
  }

  // Users
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersForMentionLookup(): Promise<Pick<User, "id" | "username" | "name">[]> {
    return await db
      .select({ id: users.id, username: users.username, name: users.name })
      .from(users)
      .where(and(eq(users.active, true), eq(users.approvalStatus, "approved")))
      .orderBy(users.name);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set({ ...user, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updated;
  }

  // Password Reset Tokens
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [created] = await db.insert(passwordResetTokens).values(token).returning();
    return created;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken || undefined;
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db.delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < NOW()`);
  }

  // Roles
  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(desc(roles.createdAt));
  }

  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role || undefined;
  }

  async createRole(role: InsertRole): Promise<Role> {
    const [created] = await db.insert(roles).values(role).returning();
    return created;
  }

  async updateRole(id: string, role: Partial<InsertRole>): Promise<Role> {
    const [updated] = await db.update(roles).set(role).where(eq(roles.id, id)).returning();
    return updated;
  }

  async deleteRole(id: string): Promise<void> {
    await db.delete(roles).where(eq(roles.id, id));
  }

  // Permissions
  async getPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions);
  }

  async getPermission(id: string): Promise<Permission | undefined> {
    const [permission] = await db.select().from(permissions).where(eq(permissions.id, id));
    return permission || undefined;
  }

  async createPermission(permission: InsertPermission): Promise<Permission> {
    const [created] = await db.insert(permissions).values(permission).returning();
    return created;
  }

  async updatePermission(id: string, permission: Partial<InsertPermission>): Promise<Permission> {
    const [updated] = await db.update(permissions).set(permission).where(eq(permissions.id, id)).returning();
    return updated;
  }

  // User Roles
  async getUserRoles(userId: string): Promise<UserRole[]> {
    const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    // Collapse duplicate (userId, roleId) rows — the table has no unique
    // constraint, so historically the seed accumulated repeats.
    const seen = new Set<string>();
    return rows.filter((r) => (seen.has(r.roleId) ? false : (seen.add(r.roleId), true)));
  }

  async assignUserRole(userRole: InsertUserRole): Promise<UserRole> {
    // Don't create a second row for a role the user already has.
    const [existing] = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userRole.userId), eq(userRoles.roleId, userRole.roleId)))
      .limit(1);
    if (existing) return existing;

    const [created] = await db.insert(userRoles).values(userRole).returning();
    return created;
  }

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await db.delete(userRoles).where(
      and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId))
    );
  }

  // Role Permissions
  async getRolePermissions(roleId: string): Promise<RolePermission[]> {
    return await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  }

  async assignRolePermission(rolePermission: InsertRolePermission): Promise<RolePermission> {
    const [created] = await db.insert(rolePermissions).values(rolePermission).returning();
    return created;
  }

  async updateRolePermission(id: string, rolePermission: Partial<InsertRolePermission>): Promise<RolePermission> {
    const [updated] = await db.update(rolePermissions).set(rolePermission).where(eq(rolePermissions.id, id)).returning();
    return updated;
  }

  async removeRolePermission(roleId: string, permissionId: string): Promise<void> {
    await db.delete(rolePermissions).where(
      and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))
    );
  }

  // Comments
  async getComments(entityType: string, entityId: string): Promise<Comment[]> {
    return await db.query.comments.findMany({
      where: and(
        eq(comments.entityType, entityType as any),
        eq(comments.entityId, entityId)
      ),
      with: {
        author: true
      },
      orderBy: [desc(comments.createdAt)]
    });
  }

  async getComment(id: string): Promise<Comment | undefined> {
    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, id),
      with: {
        author: true
      }
    });
    return comment || undefined;
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [created] = await db.insert(comments).values(comment).returning();
    return created;
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      )
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
    return result[0]?.count || 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationAsRead(id: string): Promise<Notification> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
  }

  // Notification Settings
  async getNotificationSettings(userId: string): Promise<NotificationSettings | undefined> {
    const [settings] = await db.select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId));
    return settings || undefined;
  }

  async createNotificationSettings(settings: InsertNotificationSettings): Promise<NotificationSettings> {
    const [created] = await db.insert(notificationSettings).values(settings).returning();
    return created;
  }

  async updateNotificationSettings(userId: string, settings: Partial<InsertNotificationSettings>): Promise<NotificationSettings> {
    const [updated] = await db.update(notificationSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(notificationSettings.userId, userId))
      .returning();
    return updated;
  }

  // AI Optimization
  async createOptimizationRun(run: InsertOptimizationRun): Promise<OptimizationRun> {
    const [created] = await db.insert(optimizationRuns).values(run as any).returning();
    return created;
  }

  async getOptimizationRun(id: string): Promise<OptimizationRun | undefined> {
    const [run] = await db.select().from(optimizationRuns).where(eq(optimizationRuns.id, id));
    return run || undefined;
  }

  async updateOptimizationRun(id: string, data: Partial<InsertOptimizationRun> & {executionTimeMs?: number; errorMessage?: string; completedAt?: Date}): Promise<OptimizationRun> {
    const [updated] = await db
      .update(optimizationRuns)
      .set(data as any)
      .where(eq(optimizationRuns.id, id))
      .returning();
    return updated;
  }

  async createLoadingOptimization(optimization: InsertLoadingOptimization): Promise<LoadingOptimization> {
    const [created] = await db.insert(loadingOptimizations).values(optimization as any).returning();
    return created;
  }

  async getLoadingOptimizationsByLoadingOrder(loadingOrderId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT lo.*, optrun.created_at as run_created_at, vt.name as vehicle_type_name
      FROM loading_optimizations lo
      JOIN optimization_runs optrun ON lo.optimization_run_id = optrun.id
      JOIN vehicle_types vt ON lo.vehicle_type_id = vt.id
      WHERE lo.loading_order_id = ${loadingOrderId}
      ORDER BY optrun.created_at DESC
    `);
    return result.rows;
  }

  async createRouteOptimization(optimization: InsertRouteOptimization): Promise<RouteOptimization> {
    const [created] = await db.insert(routeOptimizations).values(optimization as any).returning();
    return created;
  }

  async getRouteOptimizationsByTrip(tripId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT ro.*, optrun.created_at as run_created_at
      FROM route_optimizations ro
      JOIN optimization_runs optrun ON ro.optimization_run_id = optrun.id
      WHERE ro.trip_id = ${tripId}
      ORDER BY optrun.created_at DESC
    `);
    return result.rows;
  }
  
  // Movement Groups (Phase 1)
  async getMovementGroups(): Promise<MovementGroup[]> {
    return await db.select()
      .from(movementGroups)
      .orderBy(movementGroups.displayOrder, movementGroups.name);
  }
  
  async getMovementGroup(id: string): Promise<MovementGroup | undefined> {
    const [group] = await db.select()
      .from(movementGroups)
      .where(eq(movementGroups.id, id));
    return group || undefined;
  }
  
  async createMovementGroup(group: InsertMovementGroup): Promise<MovementGroup> {
    const [created] = await db.insert(movementGroups).values(group).returning();
    return created;
  }
  
  async updateMovementGroup(id: string, group: Partial<InsertMovementGroup>): Promise<MovementGroup> {
    const [updated] = await db.update(movementGroups)
      .set({ ...group, updatedAt: new Date() })
      .where(eq(movementGroups.id, id))
      .returning();
    return updated;
  }
  
  async deleteMovementGroup(id: string): Promise<void> {
    await db.delete(movementGroups).where(eq(movementGroups.id, id));
  }
  
  // Movement Types Config (Phase 1)
  async getMovementTypesConfig(filters?: { groupId?: string; nature?: string; active?: boolean }): Promise<MovementTypeConfig[]> {
    let query = db.select().from(movementTypesConfig);
    
    const conditions = [];
    if (filters?.groupId) {
      conditions.push(eq(movementTypesConfig.groupId, filters.groupId));
    }
    if (filters?.nature) {
      conditions.push(eq(movementTypesConfig.nature, filters.nature as any));
    }
    if (filters?.active !== undefined) {
      conditions.push(eq(movementTypesConfig.active, filters.active));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(movementTypesConfig.code);
  }
  
  async getMovementTypeConfig(id: string): Promise<MovementTypeConfig | undefined> {
    const [typeConfig] = await db.select()
      .from(movementTypesConfig)
      .where(eq(movementTypesConfig.id, id));
    return typeConfig || undefined;
  }
  
  async createMovementTypeConfig(typeConfig: InsertMovementTypeConfig): Promise<MovementTypeConfig> {
    const [created] = await db.insert(movementTypesConfig).values(typeConfig as any).returning();
    return created;
  }
  
  async updateMovementTypeConfig(id: string, typeConfig: Partial<InsertMovementTypeConfig>): Promise<MovementTypeConfig> {
    const [updated] = await db.update(movementTypesConfig)
      .set({ ...typeConfig, updatedAt: new Date() } as any)
      .where(eq(movementTypesConfig.id, id))
      .returning();
    return updated;
  }
  
  async deleteMovementTypeConfig(id: string): Promise<void> {
    await db.delete(movementTypesConfig).where(eq(movementTypesConfig.id, id));
  }
  
  // Supplier tracking (Phase 1)
  async getRecentSuppliersBySku(sku: string, months: number = 3): Promise<Array<{ name: string; frequency: number; lastUsed: Date }>> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    
    const result = await db.execute(sql`
      SELECT 
        supplier_name as name,
        COUNT(*) as frequency,
        MAX(processed_at) as last_used
      FROM movement_items
      WHERE product_id IN (
        SELECT id FROM products WHERE sku = ${sku}
      )
      AND supplier_name IS NOT NULL
      AND processed_at >= ${cutoffDate.toISOString()}
      GROUP BY supplier_name
      ORDER BY frequency DESC, last_used DESC
      LIMIT 10
    `);
    
    return result.rows.map((row: any) => ({
      name: row.name,
      frequency: parseInt(row.frequency),
      lastUsed: new Date(row.last_used)
    }));
  }

  // Inventory Aggregation (Phase 1)
  async getInventoryOverview(filters: {
    search?: string;
    periodPreset?: 'week' | 'month' | 'quarter' | 'year';
    periodStart?: Date;
    periodEnd?: Date;
    location?: string;
    category?: string;
    ownerType?: string;
    ownerName?: string;
    status?: string;
    groupBy: 'product' | 'location' | 'owner' | 'status' | 'category';
  }): Promise<Array<{
    // Grouping key
    groupKey: string;
    groupLabel: string;
    // Aggregated data
    products: Array<{
      productId: string;
      sku: string;
      name: string;
      category: string | null;
      imageUrl: string | null;
      inbound: number;
      outbound: number;
      balance: number;
      lastMovementDate: Date | null;
      movements: Array<{
        id: string;
        date: Date;
        type: string;
        quantity: number;
        direction: 'in' | 'out';
        location: string | null;
        ownerType: string | null;
        ownerName: string | null;
      }>;
    }>;
    // Summary
    totalInbound: number;
    totalOutbound: number;
    totalBalance: number;
  }>> {
    // Calculate date range based on preset
    let startDate = filters.periodStart;
    let endDate = filters.periodEnd || new Date();
    
    if (filters.periodPreset) {
      const now = new Date();
      endDate = now;
      switch (filters.periodPreset) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case 'year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
      }
    }

    // Build SQL query for inventory aggregation (with enriched movement details)
    const groupByField = filters.groupBy === 'product' ? 'p.id' :
                        filters.groupBy === 'location' ? 'mi.location' :
                        filters.groupBy === 'owner' ? `COALESCE(mi.owner_type || ' - ' || mi.owner_name, mi.owner_type, 'Não especificado')` :
                        filters.groupBy === 'status' ? 'm.status' :
                        'p.category';

    const groupLabelField = filters.groupBy === 'product' ? 'p.name' :
                           filters.groupBy === 'location' ? `COALESCE(mi.location, 'Sem localização')` :
                           filters.groupBy === 'owner' ? `COALESCE(mi.owner_type || ' - ' || mi.owner_name, mi.owner_type, 'Não especificado')` :
                           filters.groupBy === 'status' ? 'm.status' :
                           `COALESCE(p.category, 'Sem categoria')`;

    // Build WHERE conditions (using direct string interpolation with proper escaping)
    const whereConditions = [];
    
    if (filters.search) {
      const searchTerm = filters.search.replace(/'/g, "''"); // Escape single quotes
      whereConditions.push(`(p.sku ILIKE '%${searchTerm}%' OR p.name ILIKE '%${searchTerm}%' OR p.barcode ILIKE '%${searchTerm}%')`);
    }
    
    if (startDate) {
      whereConditions.push(`m.started_at >= '${startDate.toISOString()}'`);
    }
    
    if (endDate) {
      whereConditions.push(`m.started_at <= '${endDate.toISOString()}'`);
    }
    
    if (filters.location) {
      const location = filters.location.replace(/'/g, "''");
      whereConditions.push(`mi.location = '${location}'`);
    }
    
    if (filters.category) {
      const category = filters.category.replace(/'/g, "''");
      whereConditions.push(`p.category = '${category}'`);
    }
    
    if (filters.ownerType) {
      const ownerType = filters.ownerType.replace(/'/g, "''");
      whereConditions.push(`mi.owner_type = '${ownerType}'`);
    }
    
    if (filters.ownerName) {
      const ownerName = filters.ownerName.replace(/'/g, "''");
      whereConditions.push(`mi.owner_name = '${ownerName}'`);
    }
    
    if (filters.status) {
      const status = filters.status.replace(/'/g, "''");
      whereConditions.push(`m.status = '${status}'`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query to get aggregated inventory data
    const query = sql.raw(`
      WITH movement_directions AS (
        SELECT 
          mi.product_id,
          p.sku,
          p.name,
          p.category,
          p.image_url,
          mi.location,
          mi.owner_type,
          mi.owner_name,
          m.status as movement_status,
          m.id as movement_id,
          m.started_at as movement_date,
          m.vehicle_plate,
          m.notes as movement_notes,
          mtc.nature as movement_nature,
          mtc.name as type_name,
          evt.event_name,
          mi.quantity,
          CASE 
            WHEN mtc.nature = 'inbound' THEN mi.quantity
            ELSE 0
          END as inbound_qty,
          CASE 
            WHEN mtc.nature = 'outbound' THEN mi.quantity
            ELSE 0
          END as outbound_qty,
          ${groupByField} as group_key,
          ${groupLabelField} as group_label
        FROM movement_items mi
        INNER JOIN products p ON mi.product_id = p.id
        INNER JOIN movements m ON mi.movement_id = m.id
        LEFT JOIN movement_types_config mtc ON m.movement_type_config_id = mtc.id
        LEFT JOIN LATERAL (
          SELECT e.name as event_name
          FROM movement_events me2
          JOIN events e ON e.id = me2.event_id
          WHERE me2.movement_id = m.id
          ORDER BY me2.created_at ASC
          LIMIT 1
        ) evt ON true
        ${whereClause}
      )
      SELECT 
        group_key,
        group_label,
        product_id,
        sku,
        name,
        category,
        image_url,
        SUM(inbound_qty) as total_inbound,
        SUM(outbound_qty) as total_outbound,
        SUM(inbound_qty) - SUM(outbound_qty) as balance,
        MAX(movement_date) as last_movement_date,
        json_agg(
          json_build_object(
            'id', movement_id,
            'date', movement_date,
            'nature', movement_nature,
            'typeName', type_name,
            'quantity', quantity,
            'direction', CASE WHEN movement_nature = 'inbound' THEN 'in' ELSE 'out' END,
            'location', location,
            'ownerType', owner_type,
            'ownerName', owner_name,
            'status', movement_status,
            'vehiclePlate', vehicle_plate,
            'notes', movement_notes,
            'eventName', event_name
          ) ORDER BY movement_date DESC
        ) as movements
      FROM movement_directions
      GROUP BY group_key, group_label, product_id, sku, name, category, image_url
      ORDER BY group_label, name
    `);

    const result = await db.execute(query);

    // Group results by groupKey
    const grouped = new Map<string, any>();
    
    for (const row of result.rows as any[]) {
      const key = row.group_key || 'ungrouped';
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          groupKey: key,
          groupLabel: row.group_label || 'Não especificado',
          products: [],
          totalInbound: 0,
          totalOutbound: 0,
          totalBalance: 0
        });
      }
      
      const group = grouped.get(key);
      const inbound = parseInt(row.total_inbound) || 0;
      const outbound = parseInt(row.total_outbound) || 0;
      const balance = parseInt(row.balance) || 0;
      
      group.products.push({
        productId: row.product_id,
        sku: row.sku,
        name: row.name,
        category: row.category,
        imageUrl: row.image_url,
        inbound,
        outbound,
        balance,
        lastMovementDate: row.last_movement_date ? new Date(row.last_movement_date) : null,
        movements: Array.isArray(row.movements) ? row.movements : []
      });
      
      group.totalInbound += inbound;
      group.totalOutbound += outbound;
      group.totalBalance += balance;
    }
    
    return Array.from(grouped.values());
  }
}

export const storage = new DatabaseStorage();

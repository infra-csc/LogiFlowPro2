import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
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
  getMaterialRequests(): Promise<MaterialRequest[]>;
  getMaterialRequest(id: string): Promise<MaterialRequest | undefined>;
  createMaterialRequest(request: InsertMaterialRequest): Promise<MaterialRequest>;
  updateMaterialRequest(id: string, request: Partial<InsertMaterialRequest>): Promise<MaterialRequest>;

  // Request Items
  getRequestItems(requestId: string): Promise<RequestItem[]>;
  createRequestItem(item: InsertRequestItem): Promise<RequestItem>;
  deleteRequestItem(id: string): Promise<void>;
  deleteMaterialRequest(id: string): Promise<void>;
  
  // Request Approvals
  approveRequestAll(requestId: string, approverName: string, comments?: string): Promise<void>;
  approveRequestPartial(requestId: string, approverName: string, itemApprovals: Array<{itemId: string, status: string, approvedQuantity?: number, rejectionReason?: string}>, comments?: string): Promise<void>;
  rejectRequestAll(requestId: string, approverName: string, reason: string): Promise<void>;

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

  // Drivers
  getDrivers(): Promise<Driver[]>;
  getDriver(id: string): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriver(id: string, driver: Partial<InsertDriver>): Promise<Driver>;

  // Docks
  getDocks(): Promise<Dock[]>;
  getDock(id: string): Promise<Dock | undefined>;
  createDock(dock: InsertDock): Promise<Dock>;
  updateDock(id: string, dock: Partial<InsertDock>): Promise<Dock>;

  // Trips
  getTrips(): Promise<Trip[]>;
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
  getLoadingOrders(): Promise<LoadingOrder[]>;
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
  deleteLoadingOrderItems(loadingOrderId: string): Promise<void>;

  // Loading Order Trips (junction table)
  getLoadingOrderTrips(loadingOrderId: string): Promise<{id: string; tripId: string; addedAt: Date}[]>;
  createLoadingOrderTrip(loadingOrderId: string, tripId: string): Promise<{id: string; tripId: string; addedAt: Date}>;
  deleteLoadingOrderTrips(loadingOrderId: string): Promise<void>;

  // Movements
  getMovements(): Promise<Movement[]>;
  getMovement(id: string): Promise<Movement | undefined>;
  getMovementsByLoadingOrder(loadingOrderId: string): Promise<Movement[]>;
  createMovement(movement: InsertMovement): Promise<Movement>;
  createMovementWithEvents(movement: InsertMovementWithEvents): Promise<Movement>;
  updateMovement(id: string, movement: Partial<InsertMovement>): Promise<Movement>;

  // Movement Items
  getMovementItems(movementId: string): Promise<MovementItem[]>;
  createMovementItem(item: InsertMovementItem): Promise<MovementItem>;
  decrementMovementItemQuantity(id: string): Promise<MovementItem | null>;
  deleteMovementItem(id: string): Promise<void>;
  getRecentSuppliers(limit?: number): Promise<string[]>;

  // Movement Audit Logs
  createMovementAuditLog(log: InsertMovementAuditLog): Promise<MovementAuditLog>;
  getMovementAuditLogs(movementId: string): Promise<MovementAuditLog[]>;

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
  async getMaterialRequests(): Promise<MaterialRequest[]> {
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

  async createRequestItem(item: InsertRequestItem): Promise<RequestItem> {
    const [created] = await db.insert(requestItems).values(item).returning();
    return created;
  }

  async deleteRequestItem(id: string): Promise<void> {
    await db.delete(requestItems).where(eq(requestItems.id, id));
  }

  async deleteMaterialRequest(id: string): Promise<void> {
    await db.delete(materialRequests).where(eq(materialRequests.id, id));
  }

  // Request Approvals
  async approveRequestAll(requestId: string, approverName: string, comments?: string): Promise<void> {
    // Get all items for this request
    const items = await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
    
    // Approve all items
    for (const item of items) {
      await db
        .update(requestItems)
        .set({
          approvalStatus: "approved",
          approvedQuantity: item.quantity,
          rejectionReason: null,
        })
        .where(eq(requestItems.id, item.id));
    }
    
    // Update the request itself
    await db
      .update(materialRequests)
      .set({
        status: "approved",
        approvedBy: approverName,
        approvedAt: new Date(),
        notes: comments ? `${comments}\n---\nAprovação completa` : "Aprovação completa",
      })
      .where(eq(materialRequests.id, requestId));
  }

  async approveRequestPartial(
    requestId: string,
    approverName: string,
    itemApprovals: Array<{itemId: string, status: string, approvedQuantity?: number, rejectionReason?: string}>,
    comments?: string
  ): Promise<void> {
    // Update each item based on approvals
    for (const approval of itemApprovals) {
      await db
        .update(requestItems)
        .set({
          approvalStatus: approval.status as any,
          approvedQuantity: approval.approvedQuantity,
          rejectionReason: approval.rejectionReason || null,
        })
        .where(eq(requestItems.id, approval.itemId));
    }
    
    // Check if all items are approved or rejected
    const items = await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
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
    
    // Update the request
    await db
      .update(materialRequests)
      .set({
        status: requestStatus as any,
        approvedBy: approverName,
        approvedAt: new Date(),
        notes: comments ? `${comments}\n---\nAprovação parcial` : "Aprovação parcial",
      })
      .where(eq(materialRequests.id, requestId));
  }

  async rejectRequestAll(requestId: string, approverName: string, reason: string): Promise<void> {
    // Get all items for this request
    const items = await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
    
    // Reject all items
    for (const item of items) {
      await db
        .update(requestItems)
        .set({
          approvalStatus: "rejected",
          approvedQuantity: 0,
          rejectionReason: reason,
        })
        .where(eq(requestItems.id, item.id));
    }
    
    // Update the request itself
    await db
      .update(materialRequests)
      .set({
        status: "rejected",
        approvedBy: approverName,
        approvedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(materialRequests.id, requestId));
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

  // Trips
  async getTrips(): Promise<Trip[]> {
    return await db.query.trips.findMany({
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
  async getLoadingOrders(): Promise<any[]> {
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
      })
      .from(loadingOrders)
      .leftJoin(events, eq(loadingOrders.eventId, events.id))
      .orderBy(desc(loadingOrders.createdAt));
    
    return results;
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

  async deleteLoadingOrderItems(loadingOrderId: string): Promise<void> {
    await db.delete(loadingOrderItems).where(eq(loadingOrderItems.loadingOrderId, loadingOrderId));
  }

  // Loading Order Trips (junction table)
  async getLoadingOrderTrips(loadingOrderId: string): Promise<{id: string; tripId: string; addedAt: Date}[]> {
    const results = await db.select().from(loadingOrderTrips).where(eq(loadingOrderTrips.loadingOrderId, loadingOrderId));
    return results.map(r => ({
      id: r.id,
      tripId: r.tripId,
      addedAt: r.addedAt
    }));
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
  async getMovements(): Promise<Movement[]> {
    // Get all movements with their relations
    const movementsData = await db
      .select()
      .from(movements)
      .orderBy(desc(movements.createdAt));
    
    // For each movement, get its associated events and trips
    const movementsWithRelations = await Promise.all(
      movementsData.map(async (movement) => {
        const eventRelations = await db
          .select({
            event: events,
          })
          .from(movementEvents)
          .leftJoin(events, eq(movementEvents.eventId, events.id))
          .where(eq(movementEvents.movementId, movement.id));
        
        const tripRelations = await db
          .select({
            trip: trips,
          })
          .from(movementTrips)
          .leftJoin(trips, eq(movementTrips.tripId, trips.id))
          .where(eq(movementTrips.movementId, movement.id));
        
        return {
          ...movement,
          events: eventRelations.map(r => r.event).filter(Boolean),
          trips: tripRelations.map(r => r.trip).filter(Boolean),
        };
      })
    );
    
    return movementsWithRelations as any;
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
    
    return {
      ...movementData,
      events: eventRelations.map(r => r.event).filter(Boolean),
      trips: tripRelations.map(r => r.trip).filter(Boolean),
    } as any;
  }

  async getMovementsByLoadingOrder(loadingOrderId: string): Promise<Movement[]> {
    // Get all movements for this loading order
    const movementsData = await db
      .select()
      .from(movements)
      .where(eq(movements.loadingOrderId, loadingOrderId))
      .orderBy(desc(movements.createdAt));
    
    // For each movement, get its associated events and trips
    const movementsWithRelations = await Promise.all(
      movementsData.map(async (movement) => {
        const eventRelations = await db
          .select({
            event: events,
          })
          .from(movementEvents)
          .leftJoin(events, eq(movementEvents.eventId, events.id))
          .where(eq(movementEvents.movementId, movement.id));
        
        const tripRelations = await db
          .select({
            trip: trips,
          })
          .from(movementTrips)
          .leftJoin(trips, eq(movementTrips.tripId, trips.id))
          .where(eq(movementTrips.movementId, movement.id));
        
        return {
          ...movement,
          events: eventRelations.map(r => r.event).filter(Boolean),
          trips: tripRelations.map(r => r.trip).filter(Boolean),
        };
      })
    );
    
    return movementsWithRelations as any;
  }

  async createMovement(movement: InsertMovement): Promise<Movement> {
    const [created] = await db.insert(movements).values(movement as any).returning();
    return created;
  }

  async createMovementWithEvents(movementData: InsertMovementWithEvents): Promise<Movement> {
    const { eventIds, tripIds, ...movementInsert } = movementData;
    
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
    
    // Create the movement with the determined status
    const [created] = await db.insert(movements).values({
      ...movementInsert,
      status: finalStatus
    } as any).returning();
    
    // Create the junction records for events
    if (eventIds && eventIds.length > 0) {
      await db.insert(movementEvents).values(
        eventIds.map(eventId => ({
          movementId: created.id,
          eventId
        }))
      );
    }
    
    // Create the junction records for trips
    if (tripIds && tripIds.length > 0) {
      await db.insert(movementTrips).values(
        tripIds.map(tripId => ({
          movementId: created.id,
          tripId
        }))
      );
    }
    
    return created;
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

    const movementsWithRelations = await Promise.all(
      movementsData.map(async (movement) => {
        const eventRelations = await db
          .select({
            event: events,
          })
          .from(movementEvents)
          .leftJoin(events, eq(movementEvents.eventId, events.id))
          .where(eq(movementEvents.movementId, movement.id));
        
        const tripRelations = await db
          .select({
            trip: trips,
          })
          .from(movementTrips)
          .leftJoin(trips, eq(movementTrips.tripId, trips.id))
          .where(eq(movementTrips.movementId, movement.id));
        
        return {
          ...movement,
          events: eventRelations.map(r => r.event).filter(Boolean),
          trips: tripRelations.map(r => r.trip).filter(Boolean),
        };
      })
    );
    
    return movementsWithRelations as any;
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

  async getRecentSuppliers(limit: number = 10): Promise<string[]> {
    const recent = await db
      .selectDistinct({ ownerName: movementItems.ownerName })
      .from(movementItems)
      .where(
        and(
          sql`${movementItems.ownerName} IS NOT NULL`,
          sql`${movementItems.ownerType} IS NOT NULL`,
          sql`${movementItems.ownerType} != 'proprio'`
        )
      )
      .orderBy(desc(movementItems.processedAt))
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
    return await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  }

  async assignUserRole(userRole: InsertUserRole): Promise<UserRole> {
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
}

export const storage = new DatabaseStorage();

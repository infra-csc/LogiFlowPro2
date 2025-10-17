import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import {
  events,
  kits,
  bomLines,
  products,
  materialRequests,
  requestItems,
  vehicles,
  drivers,
  docks,
  trips,
  tripItems,
  inventoryMovements,
  returns,
  auditLogs,
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
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
  type InventoryMovement,
  type InsertInventoryMovement,
  type Return,
  type InsertReturn,
  type AuditLog,
  type InsertAuditLog,
  type User,
  type InsertUser,
  type Role,
  type InsertRole,
  type Permission,
  type InsertPermission,
  type UserRole,
  type InsertUserRole,
  type RolePermission,
  type InsertRolePermission,
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

  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
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

  // Material Requests
  async getMaterialRequests(): Promise<MaterialRequest[]> {
    return await db.select().from(materialRequests).orderBy(desc(materialRequests.createdAt));
  }

  async getMaterialRequest(id: string): Promise<MaterialRequest | undefined> {
    const [request] = await db.select().from(materialRequests).where(eq(materialRequests.id, id));
    return request || undefined;
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
    return await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
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
    return await db.select().from(trips).orderBy(desc(trips.createdAt));
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip || undefined;
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
}

export const storage = new DatabaseStorage();

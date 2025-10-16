import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
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
    const [created] = await db.insert(kits).values(kit).returning();
    return created;
  }

  async updateKit(id: string, kit: Partial<InsertKit>): Promise<Kit> {
    const [updated] = await db.update(kits).set(kit).where(eq(kits.id, id)).returning();
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
}

export const storage = new DatabaseStorage();

import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  insertEventSchema,
  insertKitSchema,
  insertBomLineSchema,
  insertProductSchema,
  insertMaterialRequestSchema,
  insertRequestItemSchema,
  insertVehicleTypeSchema,
  insertVehicleSchema,
  insertDriverSchema,
  insertDockSchema,
  insertTripSchema,
  insertTripItemSchema,
  insertTripEventSchema,
  insertTripDestinationSchema,
  insertLoadingOrderSchema,
  insertMovementSchema,
  insertMovementWithEventsSchema,
  insertMovementItemSchema,
  insertInventoryMovementSchema,
  insertReturnSchema,
  insertUserSchema,
  insertRoleSchema,
  insertPermissionSchema,
  insertUserRoleSchema,
  insertRolePermissionSchema,
  movements,
} from "@shared/schema";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";

async function initializeDefaultPermissions() {
  try {
    const permissions = await storage.getPermissions();
    
    // Define default permissions for each page
    const defaultPermissions = [
      { page: "dashboard", displayName: "Dashboard" },
      { page: "events", displayName: "Eventos" },
      { page: "requests", displayName: "Requisição de Materiais" },
      { page: "inventory", displayName: "Estoque" },
      { page: "trips", displayName: "Planejamento de Viagens" },
      { page: "returns", displayName: "Devoluções" },
      { page: "products", displayName: "Produtos" },
      { page: "kits", displayName: "Kits & BOM" },
      { page: "config_users", displayName: "Usuários" },
      { page: "config_roles", displayName: "Papéis e Permissões" },
      { page: "config_vehicles", displayName: "Veículos" },
      { page: "config_drivers", displayName: "Motoristas" },
      { page: "config_docks", displayName: "Docas" },
    ];

    // Create missing permissions
    for (const perm of defaultPermissions) {
      const exists = permissions.find((p) => p.page === perm.page);
      if (!exists) {
        await storage.createPermission({
          page: perm.page,
          displayName: perm.displayName,
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        });
      }
    }
  } catch (error) {
    console.error("Error initializing default permissions:", error);
  }
}

// Configure multer for in-memory file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication first
  setupAuth(app);

  // Initialize default permissions
  await initializeDefaultPermissions();
  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const events = await storage.getEvents();
      const trips = await storage.getTrips();
      const products = await storage.getProducts();

      const activeEvents = events.filter(e => e.status === "in_progress").length;
      const upcomingTrips = trips.filter(t => t.status === "planned" || t.status === "loading").length;
      const lowStockItems = products.filter(p => 
        p.minimumStock && p.currentStock !== null && p.currentStock < p.minimumStock
      ).length;

      res.json({
        activeEvents,
        upcomingTrips,
        lowStockItems,
        conflictsCount: 0, // TODO: Implement conflict detection
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/recent-events", async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events.slice(0, 5));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent events" });
    }
  });

  // Events
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      console.log("Received event data:", JSON.stringify(req.body, null, 2));
      const data = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(data);
      res.status(201).json(event);
    } catch (error) {
      console.error("Event validation error:", error);
      res.status(400).json({ error: "Invalid event data", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/events/bulk", async (req, res) => {
    try {
      const { events: eventsData } = req.body;
      
      console.log("[BULK UPLOAD] Received bulk upload request with", eventsData?.length || 0, "events");
      
      if (!Array.isArray(eventsData)) {
        console.log("[BULK UPLOAD ERROR] Expected array, received:", typeof eventsData);
        return res.status(400).json({ error: "Expected an array of events" });
      }

      const results = {
        success: [] as any[],
        errors: [] as any[]
      };

      for (let i = 0; i < eventsData.length; i++) {
        try {
          const eventData = eventsData[i];
          console.log(`[BULK UPLOAD] Processing event ${i + 1}:`, JSON.stringify(eventData, null, 2));
          
          // Convert ISO date strings to Date objects
          const convertedData = {
            ...eventData,
            setupDate: eventData.setupDate ? new Date(eventData.setupDate) : undefined,
            eventDate: eventData.eventDate ? new Date(eventData.eventDate) : undefined,
            teardownDate: eventData.teardownDate ? new Date(eventData.teardownDate) : undefined,
            requestWindowStart: eventData.requestWindowStart ? new Date(eventData.requestWindowStart) : undefined,
            requestWindowEnd: eventData.requestWindowEnd ? new Date(eventData.requestWindowEnd) : undefined,
          };
          
          console.log(`[BULK UPLOAD] Converted data for event ${i + 1}:`, JSON.stringify(convertedData, null, 2));
          
          const data = insertEventSchema.parse(convertedData);
          const event = await storage.createEvent(data);
          console.log(`[BULK UPLOAD] Successfully created event ${i + 1}:`, event.id);
          results.success.push({ row: i + 1, event });
        } catch (error: any) {
          console.error(`[BULK UPLOAD ERROR] Failed to process event ${i + 1}:`, error);
          console.error(`[BULK UPLOAD ERROR] Error details:`, error.message);
          if (error.issues) {
            console.error(`[BULK UPLOAD ERROR] Validation issues:`, JSON.stringify(error.issues, null, 2));
          }
          results.errors.push({ 
            row: i + 1, 
            data: eventsData[i], 
            error: error.issues ? JSON.stringify(error.issues) : (error.message || "Erro ao processar evento")
          });
        }
      }

      console.log(`[BULK UPLOAD] Finished. Success: ${results.success.length}, Errors: ${results.errors.length}`);
      
      res.status(results.errors.length > 0 ? 207 : 201).json({
        message: `${results.success.length} eventos importados com sucesso, ${results.errors.length} erros`,
        success: results.success,
        errors: results.errors
      });
    } catch (error) {
      console.error("[BULK UPLOAD ERROR] Unexpected error:", error);
      res.status(400).json({ error: "Erro ao processar importação em lote" });
    }
  });

  app.patch("/api/events/:id", async (req, res) => {
    try {
      const data = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(req.params.id, data);
      res.json(event);
    } catch (error) {
      res.status(400).json({ error: "Invalid event data" });
    }
  });

  // Kits
  app.get("/api/kits", async (req, res) => {
    try {
      const kits = await storage.getKits();
      res.json(kits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kits" });
    }
  });

  app.get("/api/kits/:id", async (req, res) => {
    try {
      const kit = await storage.getKit(req.params.id);
      if (!kit) {
        return res.status(404).json({ error: "Kit not found" });
      }
      res.json(kit);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kit" });
    }
  });

  app.post("/api/kits", async (req, res) => {
    try {
      const { kit: kitData, bomLines: bomLinesData } = req.body;
      const validatedKit = insertKitSchema.parse(kitData);
      const kit = await storage.createKit(validatedKit);

      if (bomLinesData && Array.isArray(bomLinesData)) {
        for (const line of bomLinesData) {
          const validatedLine = insertBomLineSchema.parse({ ...line, kitId: kit.id });
          await storage.createBomLine(validatedLine);
        }
      }

      res.status(201).json(kit);
    } catch (error) {
      res.status(400).json({ error: "Invalid kit data" });
    }
  });

  app.patch("/api/kits/:id", async (req, res) => {
    try {
      // Support both { kit, bomLines } and flat body for backward compatibility
      const raw = req.body;
      const kitData = raw.kit ?? raw;
      const bomLinesData = raw.bomLines;
      
      const data = insertKitSchema.partial().parse(kitData);
      const kit = await storage.updateKit(req.params.id, data);

      // Update BOM lines if provided
      if (bomLinesData && Array.isArray(bomLinesData)) {
        // Delete existing BOM lines
        await storage.deleteBomLinesByKit(req.params.id);
        
        // Create new BOM lines
        for (const line of bomLinesData) {
          const validatedLine = insertBomLineSchema.parse({ ...line, kitId: req.params.id });
          await storage.createBomLine(validatedLine);
        }
      }

      res.json(kit);
    } catch (error) {
      res.status(400).json({ error: "Invalid kit data" });
    }
  });

  app.get("/api/kits/:id/bom", async (req, res) => {
    try {
      const bomLines = await storage.getBomLinesByKit(req.params.id);
      res.json(bomLines);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch BOM lines" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.post("/api/products/bulk", async (req, res) => {
    try {
      const { products: productsData } = req.body;
      
      if (!Array.isArray(productsData)) {
        return res.status(400).json({ error: "Expected an array of products" });
      }

      const results = {
        success: [] as any[],
        errors: [] as any[]
      };

      for (let i = 0; i < productsData.length; i++) {
        try {
          const data = insertProductSchema.parse(productsData[i]);
          const product = await storage.createProduct(data);
          results.success.push({ row: i + 1, product });
        } catch (error: any) {
          results.errors.push({ 
            row: i + 1, 
            data: productsData[i], 
            error: error.message || "Erro ao processar produto" 
          });
        }
      }

      res.status(results.errors.length > 0 ? 207 : 201).json({
        message: `${results.success.length} produtos importados com sucesso, ${results.errors.length} erros`,
        success: results.success,
        errors: results.errors
      });
    } catch (error) {
      res.status(400).json({ error: "Erro ao processar importação em lote" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const data = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, data);
      res.json(product);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  // Material Requests
  app.get("/api/requests", async (req, res) => {
    try {
      const requests = await storage.getMaterialRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  });

  app.get("/api/requests/:id", async (req, res) => {
    try {
      const request = await storage.getMaterialRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch request" });
    }
  });

  app.post("/api/requests", async (req, res) => {
    try {
      const data = insertMaterialRequestSchema.parse(req.body);
      
      // Validate request window if event has it configured
      const event = await storage.getEvent(data.eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      // Check if event has request window configured
      if (event.requestWindowStart && event.requestWindowEnd) {
        const now = new Date();
        const windowStart = new Date(event.requestWindowStart);
        const windowEnd = new Date(event.requestWindowEnd);
        
        if (now < windowStart) {
          return res.status(400).json({ 
            error: "Requisições para este evento ainda não estão permitidas",
            windowStart: windowStart.toISOString(),
            windowEnd: windowEnd.toISOString()
          });
        }
        
        if (now > windowEnd) {
          return res.status(400).json({ 
            error: "O período de requisição para este evento já foi encerrado",
            windowStart: windowStart.toISOString(),
            windowEnd: windowEnd.toISOString()
          });
        }
      }
      
      const request = await storage.createMaterialRequest(data);
      res.status(201).json(request);
    } catch (error) {
      res.status(400).json({ error: "Invalid request data" });
    }
  });

  app.patch("/api/requests/:id", async (req, res) => {
    try {
      const data = insertMaterialRequestSchema.partial().parse(req.body);
      
      // If status is being changed to pending_approval, validate request window and set submittedAt
      const updateData: any = { ...data };
      if (data.status === "pending_approval") {
        // Get the current request to find its event
        const currentRequest = await storage.getMaterialRequest(req.params.id);
        if (!currentRequest) {
          return res.status(404).json({ error: "Request not found" });
        }
        
        // Validate request window if event has it configured
        const event = await storage.getEvent(currentRequest.eventId);
        if (!event) {
          return res.status(404).json({ error: "Event not found" });
        }
        
        // Check if event has request window configured
        if (event.requestWindowStart && event.requestWindowEnd) {
          const now = new Date();
          const windowStart = new Date(event.requestWindowStart);
          const windowEnd = new Date(event.requestWindowEnd);
          
          if (now < windowStart) {
            return res.status(400).json({ 
              error: "Requisições para este evento ainda não estão permitidas",
              windowStart: windowStart.toISOString(),
              windowEnd: windowEnd.toISOString()
            });
          }
          
          if (now > windowEnd) {
            return res.status(400).json({ 
              error: "O período de requisição para este evento já foi encerrado",
              windowStart: windowStart.toISOString(),
              windowEnd: windowEnd.toISOString()
            });
          }
        }
        
        updateData.submittedAt = new Date();
      }
      
      const request = await storage.updateMaterialRequest(req.params.id, updateData);
      res.json(request);
    } catch (error) {
      res.status(400).json({ error: "Invalid request data" });
    }
  });

  app.delete("/api/requests/:id", async (req, res) => {
    try {
      await storage.deleteMaterialRequest(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete request" });
    }
  });

  // Request Items
  app.get("/api/requests/:id/items", async (req, res) => {
    try {
      const items = await storage.getRequestItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch request items" });
    }
  });

  app.post("/api/requests/:id/items", async (req, res) => {
    try {
      const data = insertRequestItemSchema.parse(req.body);
      // Force requestId to match the URL parameter
      const item = await storage.createRequestItem({
        ...data,
        requestId: req.params.id
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: "Invalid item data" });
    }
  });

  app.delete("/api/request-items/:id", async (req, res) => {
    try {
      await storage.deleteRequestItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // Request Approvals
  app.post("/api/requests/:id/approve-all", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { comments } = req.body;
      const userName = req.user?.name || "Unknown";
      
      await storage.approveRequestAll(req.params.id, userName, comments);
      res.json({ message: "Request approved successfully" });
    } catch (error) {
      console.error("Error approving request:", error);
      res.status(500).json({ error: "Failed to approve request" });
    }
  });

  app.post("/api/requests/:id/approve-partial", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { itemApprovals, comments } = req.body;
      const userName = req.user?.name || "Unknown";
      
      await storage.approveRequestPartial(req.params.id, userName, itemApprovals, comments);
      res.json({ message: "Request processed successfully" });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.post("/api/requests/:id/reject-all", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { reason } = req.body;
      const userName = req.user?.name || "Unknown";
      
      await storage.rejectRequestAll(req.params.id, userName, reason);
      res.json({ message: "Request rejected successfully" });
    } catch (error) {
      console.error("Error rejecting request:", error);
      res.status(500).json({ error: "Failed to reject request" });
    }
  });

  // Vehicle Types
  app.get("/api/vehicle-types", async (req, res) => {
    try {
      const vehicleTypes = await storage.getVehicleTypes();
      res.json(vehicleTypes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicle types" });
    }
  });

  app.post("/api/vehicle-types", async (req, res) => {
    try {
      const data = insertVehicleTypeSchema.parse(req.body);
      const vehicleType = await storage.createVehicleType(data);
      res.status(201).json(vehicleType);
    } catch (error) {
      res.status(400).json({ error: "Invalid vehicle type data" });
    }
  });

  app.patch("/api/vehicle-types/:id", async (req, res) => {
    try {
      const data = insertVehicleTypeSchema.partial().parse(req.body);
      const vehicleType = await storage.updateVehicleType(req.params.id, data);
      res.json(vehicleType);
    } catch (error) {
      res.status(400).json({ error: "Invalid vehicle type data" });
    }
  });

  // Vehicles
  app.get("/api/vehicles", async (req, res) => {
    try {
      const vehicles = await storage.getVehicles();
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.post("/api/vehicles", async (req, res) => {
    try {
      const data = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(data);
      res.status(201).json(vehicle);
    } catch (error) {
      res.status(400).json({ error: "Invalid vehicle data" });
    }
  });

  // Drivers
  app.get("/api/drivers", async (req, res) => {
    try {
      const drivers = await storage.getDrivers();
      res.json(drivers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  app.post("/api/drivers", async (req, res) => {
    try {
      const data = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(data);
      res.status(201).json(driver);
    } catch (error) {
      res.status(400).json({ error: "Invalid driver data" });
    }
  });

  // Docks
  app.get("/api/docks", async (req, res) => {
    try {
      const docks = await storage.getDocks();
      res.json(docks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch docks" });
    }
  });

  app.post("/api/docks", async (req, res) => {
    try {
      const data = insertDockSchema.parse(req.body);
      const dock = await storage.createDock(data);
      res.status(201).json(dock);
    } catch (error) {
      res.status(400).json({ error: "Invalid dock data" });
    }
  });

  // Trips
  app.get("/api/trips", async (req, res) => {
    try {
      const trips = await storage.getTrips();
      res.json(trips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  });

  app.get("/api/trips/:id", async (req, res) => {
    try {
      const trip = await storage.getTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      res.json(trip);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trip" });
    }
  });

  app.post("/api/trips", async (req, res) => {
    try {
      const data = insertTripSchema.parse(req.body);
      const trip = await storage.createTrip(data);
      res.status(201).json(trip);
    } catch (error) {
      res.status(400).json({ error: "Invalid trip data" });
    }
  });

  app.patch("/api/trips/:id", async (req, res) => {
    try {
      const data = insertTripSchema.partial().parse(req.body);
      const trip = await storage.updateTrip(req.params.id, data);
      res.json(trip);
    } catch (error) {
      res.status(400).json({ error: "Invalid trip data" });
    }
  });

  // Loading Orders
  app.get("/api/loading-orders", async (req, res) => {
    try {
      const orders = await storage.getLoadingOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loading orders" });
    }
  });

  app.get("/api/loading-orders/:id", async (req, res) => {
    try {
      const order = await storage.getLoadingOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Loading order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loading order" });
    }
  });

  app.get("/api/loading-orders/:id/requests", async (req, res) => {
    try {
      const requests = await storage.getLoadingOrderRequests(req.params.id);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loading order requests" });
    }
  });

  app.get("/api/loading-orders/:id/items", async (req, res) => {
    try {
      const items = await storage.getLoadingOrderItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loading order items" });
    }
  });

  app.post("/api/loading-orders/:id/items", async (req, res) => {
    try {
      const loadingOrderId = req.params.id;
      const { insertLoadingOrderItemSchema } = await import("@shared/schema");
      
      // Validate the request body
      const itemData = insertLoadingOrderItemSchema.parse({
        loadingOrderId,
        ...req.body,
      });
      
      const item = await storage.createLoadingOrderItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating loading order item:", error);
      res.status(400).json({ error: "Invalid loading order item data" });
    }
  });

  app.post("/api/loading-orders", async (req, res) => {
    try {
      const { consolidateLoadingOrderItems } = await import("./loadingOrderUtils");
      
      const orderData = insertLoadingOrderSchema.parse(req.body);
      const requestIds: string[] = req.body.requestIds || [];

      const order = await storage.createLoadingOrder(orderData);

      for (const requestId of requestIds) {
        await storage.createLoadingOrderRequest({
          loadingOrderId: order.id,
          requestId
        });
      }

      const consolidatedItems = await consolidateLoadingOrderItems(requestIds, storage);

      for (const item of consolidatedItems) {
        await storage.createLoadingOrderItem({
          loadingOrderId: order.id,
          productId: item.productId,
          consolidatedQuantity: item.consolidatedQuantity,
          sourceRequests: item.sourceRequests,
          pickedQuantity: 0,
          loadedQuantity: 0
        });
      }

      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating loading order:", error);
      res.status(400).json({ error: "Invalid loading order data" });
    }
  });

  app.patch("/api/loading-orders/:id", async (req, res) => {
    try {
      const data = insertLoadingOrderSchema.partial().parse(req.body);
      const order = await storage.updateLoadingOrder(req.params.id, data);
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid loading order data" });
    }
  });

  app.post("/api/loading-orders/:id/approve", async (req, res) => {
    try {
      const order = await storage.getLoadingOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Loading order not found" });
      }
      
      if (order.status !== "ready") {
        return res.status(400).json({ error: "Only ready orders can be approved" });
      }

      const approved = await storage.approveLoadingOrder(req.params.id);
      res.json(approved);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve loading order" });
    }
  });

  app.post("/api/loading-orders/:id/disapprove", async (req, res) => {
    try {
      const order = await storage.getLoadingOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Loading order not found" });
      }
      
      if (order.status !== "approved") {
        return res.status(400).json({ error: "Only approved orders can be disapproved" });
      }

      const disapproved = await storage.disapproveLoadingOrder(req.params.id);
      res.json(disapproved);
    } catch (error) {
      res.status(500).json({ error: "Failed to disapprove loading order" });
    }
  });

  app.post("/api/loading-orders/:id/mark-ready", async (req, res) => {
    try {
      const order = await storage.getLoadingOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Loading order not found" });
      }
      
      if (order.status !== "draft") {
        return res.status(400).json({ error: "Only draft orders can be marked as ready" });
      }

      const ready = await storage.markLoadingOrderAsReady(req.params.id);
      res.json(ready);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark loading order as ready" });
    }
  });

  app.get("/api/loading-orders/:id/movements", async (req, res) => {
    try {
      const movements = await storage.getMovementsByLoadingOrder(req.params.id);
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movements for loading order" });
    }
  });

  // Movements
  app.get("/api/movements", async (req, res) => {
    try {
      const movements = await storage.getMovements();
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movements" });
    }
  });

  app.get("/api/movements/:id", async (req, res) => {
    try {
      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }
      res.json(movement);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movement" });
    }
  });

  app.get("/api/movements/:id/items", async (req, res) => {
    try {
      const items = await storage.getMovementItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movement items" });
    }
  });

  app.post("/api/movements", async (req, res) => {
    try {
      const data = insertMovementWithEventsSchema.parse(req.body);
      
      // Validate loading order if provided
      if (data.loadingOrderId) {
        const order = await storage.getLoadingOrder(data.loadingOrderId);
        if (!order) {
          return res.status(404).json({ error: "Loading order not found" });
        }
        if (order.status !== "approved" && order.status !== "in_progress") {
          return res.status(400).json({ error: "Loading order must be approved" });
        }
      }
      
      // Validate events exist
      if (data.eventIds && data.eventIds.length > 0) {
        for (const eventId of data.eventIds) {
          const event = await storage.getEvent(eventId);
          if (!event) {
            return res.status(404).json({ error: `Event not found: ${eventId}` });
          }
        }
      }
      
      // Generate movement number (MVT-YYYYMMDD-XXX)
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const existingToday = await db.select().from(movements)
        .where(sql`${movements.movementNumber} LIKE ${`MVT-${dateStr}-%`}`)
        .execute();
      const sequence = String(existingToday.length + 1).padStart(3, '0');
      const movementNumber = `MVT-${dateStr}-${sequence}`;
      
      // Get current user
      const createdBy = req.user?.name || "System";
      
      const movement = await storage.createMovementWithEvents({
        ...data,
        movementNumber,
        createdBy,
      } as any);
      res.status(201).json(movement);
    } catch (error) {
      console.error("Movement creation error:", error);
      res.status(400).json({ error: "Invalid movement data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/movements/:id", async (req, res) => {
    try {
      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }

      const data = insertMovementSchema.partial().parse(req.body);
      
      // Validate status transitions
      if (data.status && data.status !== movement.status) {
        const validTransitions: Record<string, string[]> = {
          created: ["in_progress", "cancelled"],
          in_progress: ["paused", "completed", "cancelled"],
          paused: ["in_progress", "cancelled"],
          completed: [],
          cancelled: [],
        };

        const allowedStatuses = validTransitions[movement.status] || [];
        if (!allowedStatuses.includes(data.status)) {
          return res.status(400).json({
            error: `Cannot transition from ${movement.status} to ${data.status}`,
          });
        }

        // Set timestamps based on status
        if (data.status === "in_progress" && !movement.startedAt) {
          (data as any).startedAt = new Date();
        }
        if (data.status === "completed") {
          (data as any).completedAt = new Date();
        }
      }
      
      const updated = await storage.updateMovement(req.params.id, data);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid movement data" });
    }
  });

  app.post("/api/movements/:id/items", async (req, res) => {
    try {
      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }
      
      // Only allow adding items if movement is in progress
      if (movement.status !== "in_progress") {
        return res.status(400).json({
          error: "Items can only be added to movements in progress",
        });
      }

      const data = insertMovementItemSchema.parse(req.body);
      
      // Enforce movementId matches the URL parameter to prevent data integrity violations
      if (data.movementId && data.movementId !== req.params.id) {
        return res.status(400).json({
          error: "Movement ID in body must match the URL parameter",
        });
      }
      
      // Override movementId to ensure it matches the URL param
      const itemData = { ...data, movementId: req.params.id };
      const item = await storage.createMovementItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: "Invalid movement item data" });
    }
  });

  app.patch("/api/movements/:id/items/:itemId/decrement", async (req, res) => {
    try {
      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }
      
      // Only allow modifying items if movement is in progress
      if (movement.status !== "in_progress") {
        return res.status(400).json({
          error: "Items can only be modified in movements in progress",
        });
      }

      const updatedItem = await storage.decrementMovementItemQuantity(req.params.itemId);
      if (!updatedItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(updatedItem);
    } catch (error) {
      res.status(400).json({ error: "Failed to decrement item quantity" });
    }
  });

  app.delete("/api/movements/:id/items/:itemId", async (req, res) => {
    try {
      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }
      
      // Only allow removing items if movement is in progress
      if (movement.status !== "in_progress") {
        return res.status(400).json({
          error: "Items can only be removed from movements in progress",
        });
      }

      await storage.deleteMovementItem(req.params.itemId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to remove movement item" });
    }
  });

  // Returns
  app.get("/api/returns", async (req, res) => {
    try {
      const returns = await storage.getReturns();
      res.json(returns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch returns" });
    }
  });

  app.post("/api/returns", async (req, res) => {
    try {
      const data = insertReturnSchema.parse(req.body);
      const returnItem = await storage.createReturn(data);
      res.status(201).json(returnItem);
    } catch (error) {
      res.status(400).json({ error: "Invalid return data" });
    }
  });

  // Users
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      // Hash password before storing
      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({ ...data, password: hashedPassword });
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const data = insertUserSchema.partial().parse(req.body);
      // Hash password if it's being updated
      if (data.password) {
        const { hashPassword } = await import("./auth");
        data.password = await hashPassword(data.password);
      }
      const user = await storage.updateUser(req.params.id, data);
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  // Password Reset
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({ message: "Se o email existe, um link de recuperação foi enviado" });
      }

      // Generate secure random token
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      
      // Token expires in 1 hour
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
        usedAt: null
      });

      // TODO: Send email with reset link
      // For now, log the token (in production, this would be sent via email)
      console.log(`Password reset token for ${email}: ${token}`);
      console.log(`Reset link: ${req.protocol}://${req.get('host')}/reset-password?token=${token}`);

      res.json({ message: "Se o email existe, um link de recuperação foi enviado" });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ error: "Erro ao solicitar recuperação de senha" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token e nova senha são obrigatórios" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ error: "Token inválido" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ error: "Token já foi utilizado" });
      }

      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ error: "Token expirado" });
      }

      // Hash the new password
      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await storage.updateUser(resetToken.userId, { password: hashedPassword });

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(token);

      res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Erro ao resetar senha" });
    }
  });

  // Roles
  app.get("/api/roles", async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", async (req, res) => {
    try {
      const data = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(data);
      res.status(201).json(role);
    } catch (error) {
      res.status(400).json({ error: "Invalid role data" });
    }
  });

  app.patch("/api/roles/:id", async (req, res) => {
    try {
      const data = insertRoleSchema.partial().parse(req.body);
      const role = await storage.updateRole(req.params.id, data);
      res.json(role);
    } catch (error) {
      res.status(400).json({ error: "Invalid role data" });
    }
  });

  app.delete("/api/roles/:id", async (req, res) => {
    try {
      await storage.deleteRole(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // Permissions
  app.get("/api/permissions", async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.post("/api/permissions", async (req, res) => {
    try {
      const data = insertPermissionSchema.parse(req.body);
      const permission = await storage.createPermission(data);
      res.status(201).json(permission);
    } catch (error) {
      res.status(400).json({ error: "Invalid permission data" });
    }
  });

  // User Roles
  app.get("/api/users/:userId/roles", async (req, res) => {
    try {
      const userRoles = await storage.getUserRoles(req.params.userId);
      res.json(userRoles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user roles" });
    }
  });

  app.post("/api/users/:userId/roles", async (req, res) => {
    try {
      const data = insertUserRoleSchema.parse({
        userId: req.params.userId,
        roleId: req.body.roleId
      });
      const userRole = await storage.assignUserRole(data);
      res.status(201).json(userRole);
    } catch (error) {
      res.status(400).json({ error: "Invalid user role data" });
    }
  });

  app.delete("/api/users/:userId/roles/:roleId", async (req, res) => {
    try {
      await storage.removeUserRole(req.params.userId, req.params.roleId);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ error: "Failed to remove user role" });
    }
  });

  // Role Permissions
  app.get("/api/roles/:roleId/permissions", async (req, res) => {
    try {
      const rolePermissions = await storage.getRolePermissions(req.params.roleId);
      res.json(rolePermissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role permissions" });
    }
  });

  app.post("/api/roles/:roleId/permissions", async (req, res) => {
    try {
      const data = insertRolePermissionSchema.parse({
        roleId: req.params.roleId,
        permissionId: req.body.permissionId,
        canView: req.body.canView,
        canCreate: req.body.canCreate,
        canEdit: req.body.canEdit,
        canDelete: req.body.canDelete
      });
      const rolePermission = await storage.assignRolePermission(data);
      res.status(201).json(rolePermission);
    } catch (error) {
      res.status(400).json({ error: "Invalid role permission data" });
    }
  });

  app.patch("/api/role-permissions/:id", async (req, res) => {
    try {
      const data = insertRolePermissionSchema.partial().parse(req.body);
      const rolePermission = await storage.updateRolePermission(req.params.id, data);
      res.json(rolePermission);
    } catch (error) {
      res.status(400).json({ error: "Invalid role permission data" });
    }
  });

  app.delete("/api/roles/:roleId/permissions/:permissionId", async (req, res) => {
    try {
      await storage.removeRolePermission(req.params.roleId, req.params.permissionId);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ error: "Failed to remove role permission" });
    }
  });

  // Object Storage - From blueprint: javascript_object_storage
  // Direct upload endpoint (accepts file via multipart/form-data)
  app.post("/api/objects/upload", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.uploadObjectEntity(
        req.file.buffer,
        req.file.originalname
      );
      res.json({ url: objectPath });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Serve uploaded objects from local filesystem
  app.get("/objects/uploads/:filename", async (req, res) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const filename = req.params.filename;
      const filePath = path.join(process.cwd(), 'uploads', filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Send file
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Update product image
  app.put("/api/products/:id/image", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.body.imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }

    try {
      // Update product with image URL (no ACL needed for local storage)
      const product = await storage.updateProduct(req.params.id, {
        imageUrl: req.body.imageUrl,
      });

      res.status(200).json({ objectPath: req.body.imageUrl, product });
    } catch (error) {
      console.error("Error setting product image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update kit image
  app.put("/api/kits/:id/image", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!req.body.imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }

    try {
      // Update kit with image URL (no ACL needed for local storage)
      const kit = await storage.updateKit(req.params.id, {
        imageUrl: req.body.imageUrl,
      });

      res.status(200).json({ objectPath: req.body.imageUrl, kit });
    } catch (error) {
      console.error("Error setting kit image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

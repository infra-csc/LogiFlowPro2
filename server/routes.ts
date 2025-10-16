import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertEventSchema,
  insertKitSchema,
  insertBomLineSchema,
  insertProductSchema,
  insertMaterialRequestSchema,
  insertRequestItemSchema,
  insertVehicleSchema,
  insertDriverSchema,
  insertDockSchema,
  insertTripSchema,
  insertTripItemSchema,
  insertInventoryMovementSchema,
  insertReturnSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const { kit: kitData } = req.body;
      const data = insertKitSchema.partial().parse(kitData);
      const kit = await storage.updateKit(req.params.id, data);
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
      const request = await storage.createMaterialRequest(data);
      res.status(201).json(request);
    } catch (error) {
      res.status(400).json({ error: "Invalid request data" });
    }
  });

  app.patch("/api/requests/:id", async (req, res) => {
    try {
      const data = insertMaterialRequestSchema.partial().parse(req.body);
      const request = await storage.updateMaterialRequest(req.params.id, data);
      res.json(request);
    } catch (error) {
      res.status(400).json({ error: "Invalid request data" });
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

  const httpServer = createServer(app);
  return httpServer;
}

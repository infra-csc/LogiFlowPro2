import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { registerOptimizationRoutes } from "./routes-optimization";
import { registerReportsRoutes } from "./routes-reports";
import {
  insertEventSchema,
  insertKitSchema,
  insertBomLineSchema,
  insertSupplierSchema,
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
  insertMovementAuditLogSchema,
  insertInventoryMovementSchema,
  insertReturnSchema,
  insertUserSchema,
  insertRoleSchema,
  insertPermissionSchema,
  insertUserRoleSchema,
  insertRolePermissionSchema,
  insertCommentSchema,
  insertNotificationSchema,
  insertNotificationSettingsSchema,
  insertMovementGroupSchema,
  insertMovementTypeConfigSchema,
  movements,
} from "@shared/schema";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { checkOwnership, canEditResource, isAdmin } from "./ownership";

// Legacy function - now replaced by POST /api/permissions/populate endpoint
// Keeping minimal initialization for backward compatibility
async function initializeDefaultPermissions() {
  try {
    // Check if any permissions exist
    const permissions = await storage.getPermissions();
    
    if (permissions.length === 0) {
      // Only create basic dashboard permission if nothing exists
      // Admin should use the "Atualizar Permissões" button to populate all
      await storage.createPermission({
        page: "dashboard",
        displayName: "Dashboard",
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      });
      console.log("⚠️  Initial dashboard permission created. Please use 'Atualizar Permissões' button in Roles page to populate all permissions.");
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

  // Suppliers
  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.get("/api/suppliers/:id", async (req, res) => {
    try {
      const supplier = await storage.getSupplier(req.params.id);
      if (!supplier) {
        return res.status(404).json({ error: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch supplier" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(data);
      res.status(201).json(supplier);
    } catch (error) {
      res.status(400).json({ error: "Invalid supplier data" });
    }
  });

  app.patch("/api/suppliers/:id", async (req, res) => {
    try {
      const data = insertSupplierSchema.partial().parse(req.body);
      const supplier = await storage.updateSupplier(req.params.id, data);
      res.json(supplier);
    } catch (error) {
      res.status(400).json({ error: "Invalid supplier data" });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      if (!(await isAdmin(req.user))) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Apenas administradores podem excluir fornecedores"
        });
      }
      await storage.deleteSupplier(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: "Failed to delete supplier" });
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

  // Product Variants - specific routes MUST come before generic :id route
  app.get("/api/products/by-sku/:sku", async (req, res) => {
    try {
      const product = await storage.getProductBySku(req.params.sku);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product by SKU:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.get("/api/products/target/:sku", async (req, res) => {
    try {
      const result = await storage.getTargetProduct(req.params.sku);
      if (!result) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error resolving target product:", error);
      res.status(500).json({ error: "Failed to resolve product" });
    }
  });

  app.get("/api/suppliers/recent", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const suppliers = await storage.getRecentSuppliers(limit);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching recent suppliers:", error);
      res.status(500).json({ error: "Failed to fetch recent suppliers" });
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
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const data = insertMaterialRequestSchema.parse(req.body);
      
      // Set requestedBy to current user
      const requestData = {
        ...data,
        requestedBy: req.user!.id
      };
      
      // Validate request window if event has it configured
      const event = await storage.getEvent(requestData.eventId);
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
      
      const request = await storage.createMaterialRequest(requestData);
      res.status(201).json(request);
    } catch (error) {
      res.status(400).json({ error: "Invalid request data" });
    }
  });

  app.patch("/api/requests/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      // Get the current request to check ownership
      const currentRequest = await storage.getMaterialRequest(req.params.id);
      if (!currentRequest) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Check ownership - owner or admin can edit; status-changing actions
      // (approve/reject) have their own dedicated routes with separate auth
      if (!(await canEditResource(req.user, currentRequest.requestedBy))) {
        return res.status(403).json({ 
          error: "Acesso negado",
          message: "Apenas o criador pode editar esta requisição"
        });
      }

      const data = insertMaterialRequestSchema.partial().parse(req.body);

      // Block privileged status transitions on this generic edit route.
      // Only the owner self-submitting (draft -> pending_approval) is allowed.
      // Approve/reject must go through their dedicated routes.
      const ALLOWED_STATUSES_HERE = new Set(["draft", "pending_approval"]);
      if (data.status !== undefined && !ALLOWED_STATUSES_HERE.has(data.status)) {
        return res.status(403).json({
          error: "Transição de status não permitida",
          message: "Use as rotas de aprovação/rejeição para alterar este status"
        });
      }

      // If status is being changed to pending_approval, validate request window and set submittedAt
      const updateData: any = { ...data };
      if (data.status === "pending_approval") {
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
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      // Get the current request to check ownership
      const currentRequest = await storage.getMaterialRequest(req.params.id);
      if (!currentRequest) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Check ownership (only owner can delete their draft requests)
      if (!(await canEditResource(req.user, currentRequest.requestedBy))) {
        return res.status(403).json({ 
          error: "Acesso negado",
          message: "Apenas o criador pode excluir esta requisição"
        });
      }

      await storage.deleteMaterialRequest(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete request" });
    }
  });

  app.post("/api/requests/:id/duplicate", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { eventId, area, notes } = req.body;
      
      if (!eventId || !area) {
        return res.status(400).json({ error: "Event and area are required" });
      }

      // Fetch original request
      const originalRequest = await storage.getMaterialRequest(req.params.id);
      if (!originalRequest) {
        return res.status(404).json({ error: "Original request not found" });
      }

      // Fetch event to validate request window
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Validate request window if it exists
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

      // Create new request
      const newRequest = await storage.createMaterialRequest({
        eventId,
        area,
        notes,
        status: "draft",
        requestedBy: req.user?.id || "sistema",
      });

      // Fetch original items
      const originalItems = await storage.getRequestItems(req.params.id);

      // Copy items without approval data
      for (const item of originalItems) {
        await storage.createRequestItem({
          requestId: newRequest.id,
          productId: item.productId || undefined,
          kitId: item.kitId || undefined,
          quantity: item.quantity,
          notes: item.notes || undefined,
          approvalStatus: "pending",
          kitParameters: item.kitParameters as any,
        });
      }

      res.status(201).json(newRequest);
    } catch (error) {
      console.error("Error duplicating request:", error);
      res.status(500).json({ error: "Failed to duplicate request" });
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
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const parentRequest = await storage.getMaterialRequest(req.params.id);
      if (!parentRequest) {
        return res.status(404).json({ error: "Requisição não encontrada" });
      }

      if (!(await canEditResource(req.user, parentRequest.requestedBy))) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Apenas o criador da requisição pode adicionar itens"
        });
      }

      const data = insertRequestItemSchema.parse(req.body);
      // Force requestId to match the URL parameter
      const item = await storage.createRequestItem({
        ...data,
        requestId: req.params.id
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating request item:", error);
      res.status(400).json({ error: "Invalid item data" });
    }
  });

  app.delete("/api/request-items/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      // Get item -> parent request -> check ownership of the parent request
      const item = await storage.getRequestItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item não encontrado" });
      }

      const parentRequest = await storage.getMaterialRequest(item.requestId);
      if (!parentRequest) {
        return res.status(404).json({ error: "Requisição não encontrada" });
      }

      if (!(await canEditResource(req.user, parentRequest.requestedBy))) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Apenas o criador da requisição pode excluir seus itens"
        });
      }

      await storage.deleteRequestItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting request item:", error);
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
      console.error("Driver creation error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid driver data", details: error.errors });
      } else {
        res.status(400).json({ error: "Invalid driver data" });
      }
    }
  });

  app.patch("/api/drivers/:id", async (req, res) => {
    try {
      const data = insertDriverSchema.partial().parse(req.body);
      const driver = await storage.updateDriver(req.params.id, data);
      res.json(driver);
    } catch (error) {
      console.error("Driver update error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid driver data", details: error.errors });
      } else {
        res.status(400).json({ error: "Invalid driver data" });
      }
    }
  });

  app.delete("/api/drivers/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      if (!(await isAdmin(req.user))) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Apenas administradores podem excluir motoristas"
        });
      }
      await storage.deleteDriver(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting driver:", error);
      res.status(500).json({ error: "Failed to delete driver" });
    }
  });

  // Upload CNH image
  app.post("/api/drivers/:id/cnh-upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const driverId = req.params.id;
      const file = req.file;
      const fileName = `cnh_${driverId}_${Date.now()}.${file.originalname.split(".").pop()}`;

      // Upload to object storage
      const objectStorageService = new ObjectStorageService();
      const url = await objectStorageService.uploadObjectEntity(file.buffer, fileName);

      // Update driver with CNH image URL
      const driver = await storage.updateDriver(driverId, { cnhImageUrl: url });

      res.json({ url, driver });
    } catch (error) {
      console.error("CNH upload error:", error);
      res.status(500).json({ error: "Failed to upload CNH image" });
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
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const { destinations, ...tripData } = req.body;
      const data = insertTripSchema.parse(tripData);
      
      // Set createdBy to current user
      const tripDataWithOwner = {
        ...data,
        createdBy: req.user!.id
      };
      
      const trip = await storage.createTrip(tripDataWithOwner);
      
      // Save destinations if provided
      if (destinations && Array.isArray(destinations) && destinations.length > 0) {
        for (const dest of destinations) {
          await storage.createTripDestination({
            tripId: trip.id,
            location: dest.location,
            arrivalDateTime: new Date(dest.arrivalDateTime)
          });
        }
      }
      
      res.status(201).json(trip);
    } catch (error) {
      console.error("[CREATE TRIP ERROR]", error);
      res.status(400).json({ error: "Invalid trip data" });
    }
  });

  app.patch("/api/trips/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      // Get the current trip to check ownership
      const currentTrip = await storage.getTrip(req.params.id);
      if (!currentTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Check ownership (only owner can edit their trips)
      if (!(await canEditResource(req.user, currentTrip.createdBy))) {
        return res.status(403).json({ 
          error: "Acesso negado",
          message: "Apenas o criador pode editar esta viagem"
        });
      }

      const { destinations, ...tripData } = req.body;
      const data = insertTripSchema.partial().parse(tripData);
      const trip = await storage.updateTrip(req.params.id, data);
      
      // Update destinations if provided
      if (destinations !== undefined) {
        // Delete existing destinations
        await storage.deleteTripDestinations(req.params.id);
        
        // Add new destinations
        if (Array.isArray(destinations) && destinations.length > 0) {
          for (const dest of destinations) {
            await storage.createTripDestination({
              tripId: req.params.id,
              location: dest.location,
              arrivalDateTime: new Date(dest.arrivalDateTime)
            });
          }
        }
      }
      
      res.json(trip);
    } catch (error) {
      console.error("[UPDATE TRIP ERROR]", error);
      res.status(400).json({ error: "Invalid trip data" });
    }
  });

  app.post("/api/trips/bulk", async (req, res) => {
    try {
      const { trips: tripsData } = req.body;
      
      console.log("[BULK UPLOAD TRIPS] Received bulk upload request with", tripsData?.length || 0, "trips");
      
      if (!Array.isArray(tripsData)) {
        console.log("[BULK UPLOAD TRIPS ERROR] Expected array, received:", typeof tripsData);
        return res.status(400).json({ error: "Expected an array of trips" });
      }

      const results = {
        success: [] as any[],
        errors: [] as any[]
      };

      // Get all events and vehicle types for lookup
      const allEvents = await storage.getEvents();
      const allVehicleTypes = await storage.getVehicleTypes();

      const eventMap = new Map(allEvents.map(e => [e.name.trim().toLowerCase(), e.id]));
      const vehicleTypeMap = new Map(allVehicleTypes.map(vt => [vt.name.trim().toLowerCase(), vt.id]));

      // Status mapping from Portuguese to English
      const statusMap: Record<string, string> = {
        'planejada': 'planned',
        'carregando': 'loading',
        'carregada': 'loaded',
        'em trânsito': 'in_transit',
        'no destino': 'at_destination',
        'descarregando': 'unloading',
        'concluída': 'completed'
      };

      for (let i = 0; i < tripsData.length; i++) {
        try {
          const tripData = tripsData[i];
          console.log(`[BULK UPLOAD TRIPS] Processing trip ${i + 1}:`, JSON.stringify(tripData, null, 2));
          
          // Find event ID by name
          const eventId = tripData.eventName ? eventMap.get(tripData.eventName.trim().toLowerCase()) : undefined;
          if (!eventId) {
            throw new Error(`Evento não encontrado: ${tripData.eventName}`);
          }

          // Find vehicle type ID by name
          const vehicleTypeId = tripData.vehicleTypeName ? vehicleTypeMap.get(tripData.vehicleTypeName.trim().toLowerCase()) : undefined;
          if (!vehicleTypeId) {
            throw new Error(`Tipo de veículo não encontrado: ${tripData.vehicleTypeName}`);
          }

          // Map status
          const status = tripData.status ? statusMap[tripData.status.trim().toLowerCase()] || 'planned' : 'planned';

          // Convert ISO date strings to Date objects
          const convertedData = {
            description: tripData.description || null,
            eventId,
            vehicleTypeId,
            loadingLocation: tripData.loadingLocation || null,
            loadingStartTime: tripData.loadingStartTime ? new Date(tripData.loadingStartTime) : null,
            loadingEndTime: tripData.loadingEndTime ? new Date(tripData.loadingEndTime) : null,
            departureDateTime: tripData.departureDateTime ? new Date(tripData.departureDateTime) : null,
            unloadingLocation: tripData.unloadingLocation || null,
            unloadingStartTime: tripData.unloadingStartTime ? new Date(tripData.unloadingStartTime) : null,
            unloadingEndTime: tripData.unloadingEndTime ? new Date(tripData.unloadingEndTime) : null,
            status,
            notes: tripData.notes || null
          };
          
          console.log(`[BULK UPLOAD TRIPS] Converted data for trip ${i + 1}:`, JSON.stringify(convertedData, null, 2));
          
          const data = insertTripSchema.parse(convertedData);
          const trip = await storage.createTrip(data);
          console.log(`[BULK UPLOAD TRIPS] Successfully created trip ${i + 1}:`, trip.id);
          results.success.push({ row: i + 1, trip });
        } catch (error: any) {
          console.error(`[BULK UPLOAD TRIPS ERROR] Failed to process trip ${i + 1}:`, error);
          console.error(`[BULK UPLOAD TRIPS ERROR] Error details:`, error.message);
          if (error.issues) {
            console.error(`[BULK UPLOAD TRIPS ERROR] Validation issues:`, JSON.stringify(error.issues, null, 2));
          }
          results.errors.push({ 
            row: i + 1, 
            data: tripsData[i], 
            error: error.issues ? JSON.stringify(error.issues) : (error.message || "Erro ao processar viagem")
          });
        }
      }

      console.log(`[BULK UPLOAD TRIPS] Finished. Success: ${results.success.length}, Errors: ${results.errors.length}`);
      
      res.status(results.errors.length > 0 ? 207 : 201).json({
        message: `${results.success.length} viagens importadas com sucesso, ${results.errors.length} erros`,
        success: results.success,
        errors: results.errors
      });
    } catch (error) {
      console.error("[BULK UPLOAD TRIPS ERROR] Unexpected error:", error);
      res.status(400).json({ error: "Erro ao processar importação em lote" });
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

  // Loading Order Trips routes
  app.get("/api/loading-orders/:id/trips", async (req, res) => {
    try {
      const trips = await storage.getLoadingOrderTrips(req.params.id);
      res.json(trips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loading order trips" });
    }
  });

  app.post("/api/loading-orders/:id/trips", async (req, res) => {
    try {
      const loadingOrderId = req.params.id;
      const { tripId } = req.body;
      
      if (!tripId) {
        return res.status(400).json({ error: "tripId is required" });
      }
      
      const trip = await storage.createLoadingOrderTrip(loadingOrderId, tripId);
      res.status(201).json(trip);
    } catch (error) {
      console.error("Error adding trip to loading order:", error);
      res.status(400).json({ error: "Failed to add trip to loading order" });
    }
  });

  app.delete("/api/loading-orders/:id/trips", async (req, res) => {
    try {
      await storage.deleteLoadingOrderTrips(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete loading order trips" });
    }
  });

  app.post("/api/loading-orders", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const { consolidateLoadingOrderItems } = await import("./loadingOrderUtils");
      
      const orderData = insertLoadingOrderSchema.parse(req.body);
      const requestIds: string[] = req.body.requestIds || [];

      // Set createdBy to current user
      const orderDataWithOwner = {
        ...orderData,
        createdBy: req.user!.id
      };

      const order = await storage.createLoadingOrder(orderDataWithOwner);

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

  // Check if loading order can be edited
  app.get("/api/loading-orders/:id/can-edit", async (req, res) => {
    try {
      const order = await storage.getLoadingOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Loading order not found" });
      }

      // Cannot edit completed or cancelled orders
      if (order.status === "completed" || order.status === "cancelled") {
        return res.json({ 
          canEdit: false, 
          reason: "Ordens concluídas ou canceladas não podem ser editadas" 
        });
      }

      // Check for movements in progress
      const { db } = await import("./db");
      const { movements } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const activeMovements = await db.select()
        .from(movements)
        .where(
          and(
            eq(movements.loadingOrderId, req.params.id),
            eq(movements.status, "in_progress")
          )
        );

      if (activeMovements.length > 0) {
        return res.json({ 
          canEdit: false, 
          reason: `Existem ${activeMovements.length} movimentação(ões) em andamento vinculadas a esta ordem`,
          activeMovements: activeMovements.map((m: any) => ({
            id: m.id,
            movementNumber: m.movementNumber,
            status: m.status
          }))
        });
      }

      res.json({ canEdit: true });
    } catch (error) {
      console.error("Error checking if loading order can be edited:", error);
      res.status(500).json({ error: "Failed to check edit permission" });
    }
  });

  app.patch("/api/loading-orders/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const order = await storage.getLoadingOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Loading order not found" });
      }

      // Check ownership (only owner can edit their orders)
      if (!(await canEditResource(req.user, order.createdBy))) {
        return res.status(403).json({ 
          error: "Acesso negado",
          message: "Apenas o criador pode editar esta ordem"
        });
      }

      // Cannot edit completed or cancelled orders
      if (order.status === "completed" || order.status === "cancelled") {
        return res.status(400).json({ 
          error: "Ordens concluídas ou canceladas não podem ser editadas" 
        });
      }

      // Check for movements in progress
      const { db } = await import("./db");
      const { movements } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const activeMovements = await db.select()
        .from(movements)
        .where(
          and(
            eq(movements.loadingOrderId, req.params.id),
            eq(movements.status, "in_progress")
          )
        );

      if (activeMovements.length > 0) {
        return res.status(400).json({ 
          error: `Não é possível editar. Existem ${activeMovements.length} movimentação(ões) em andamento vinculadas a esta ordem`
        });
      }

      const data = insertLoadingOrderSchema.partial().parse(req.body);
      const updatedOrder = await storage.updateLoadingOrder(req.params.id, data);
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating loading order:", error);
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
      console.error("Failed to fetch movements:", error);
      res.status(500).json({ error: "Failed to fetch movements" });
    }
  });

  // Movement Approvals - Must come BEFORE /api/movements/:id
  app.get("/api/movements/pending-approval", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const pendingMovements = await storage.listPendingMovements();
      res.json(pendingMovements);
    } catch (error) {
      console.error("Failed to fetch pending movements:", error);
      res.status(500).json({ error: "Failed to fetch pending movements" });
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
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

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
      
      // Validate trips exist
      if (data.tripIds && data.tripIds.length > 0) {
        for (const tripId of data.tripIds) {
          const trip = await storage.getTrip(tripId);
          if (!trip) {
            return res.status(404).json({ error: `Trip not found: ${tripId}` });
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
      
      // Set createdBy to current user ID
      const createdBy = req.user!.id;
      
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
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }

      // Check ownership (only owner can edit their movements in created status)
      if (movement.status === "created" && !(await canEditResource(req.user, movement.createdBy))) {
        return res.status(403).json({ 
          error: "Acesso negado",
          message: "Apenas o criador pode editar esta movimentação"
        });
      }

      const data = insertMovementSchema.partial().parse(req.body);
      const previousStatus = movement.status;
      
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
      
      // Create audit log if status changed
      if (data.status && data.status !== previousStatus) {
        await storage.createMovementAuditLog({
          movementId: req.params.id,
          action: "status_changed",
          actorId: req.user?.id || null,
          actorName: req.user?.name || "Sistema",
          context: {
            previousStatus,
            newStatus: data.status,
          },
        });
      }
      
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

      // Get product details for audit log
      const product = await storage.getProduct(item.productId);

      // Create audit log for item addition
      await storage.createMovementAuditLog({
        movementId: req.params.id,
        action: "item_added",
        actorId: req.user?.id || null,
        actorName: req.user?.name || "Sistema",
        metadata: {
          productId: item.productId,
          productName: product?.name || "Unknown",
          quantity: item.quantity,
          sku: product?.sku || "",
          ownerName: item.ownerName || undefined,
          ownerType: item.ownerType || undefined,
        },
      });

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

      // Get item details before deletion for audit log
      const movementItems = await storage.getMovementItems(req.params.id);
      const itemToDelete = movementItems.find(item => item.id === req.params.itemId);
      
      if (itemToDelete) {
        // Get product details
        const product = await storage.getProduct(itemToDelete.productId);
        
        // Create audit log for item removal
        await storage.createMovementAuditLog({
          movementId: req.params.id,
          action: "item_removed",
          actorId: req.user?.id || null,
          actorName: req.user?.name || "Sistema",
          metadata: {
            productId: itemToDelete.productId,
            productName: product?.name || "Unknown",
            quantity: itemToDelete.quantity,
            sku: product?.sku || "",
            ownerName: itemToDelete.ownerName || undefined,
            ownerType: itemToDelete.ownerType || undefined,
          },
        });
      }

      await storage.deleteMovementItem(req.params.itemId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to remove movement item" });
    }
  });

  // Movement Audit Logs
  app.get("/api/movements/:id/audit-logs", async (req, res) => {
    try {
      const logs = await storage.getMovementAuditLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Update Movement Status
  app.patch("/api/movements/:id/status", async (req, res) => {
    try {
      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }

      // Validate status with Zod
      const statusSchema = z.object({ 
        status: z.enum(["created", "pending_approval", "in_progress", "paused", "completed", "cancelled"]) 
      });
      const { status } = statusSchema.parse(req.body);

      const previousStatus = movement.status;
      
      // Update movement status
      const updated = await storage.updateMovement(req.params.id, { status });

      // Create audit log for status change
      await storage.createMovementAuditLog({
        movementId: req.params.id,
        action: "status_changed",
        actorId: req.user?.id || null,
        actorName: req.user?.name || "Sistema",
        context: {
          previousStatus,
          newStatus: status,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error("Failed to update movement status:", error);
      res.status(500).json({ error: "Failed to update movement status" });
    }
  });

  app.post("/api/movements/:id/approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }

      if (movement.status !== "pending_approval") {
        return res.status(400).json({
          error: "Only pending movements can be approved",
        });
      }

      const approved = await storage.approveMovement(req.params.id, req.user.id);
      
      // Log audit trail
      await storage.createAuditLog({
        entityType: "movement",
        entityId: req.params.id,
        action: "approve",
        userId: req.user.id,
        reason: "Movement approved",
      });

      res.json(approved);
    } catch (error) {
      console.error("Failed to approve movement:", error);
      res.status(500).json({ error: "Failed to approve movement" });
    }
  });

  app.post("/api/movements/:id/reject", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { reason } = req.body;
      if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
        return res.status(400).json({
          error: "Rejection reason is required",
        });
      }

      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }

      if (movement.status !== "pending_approval") {
        return res.status(400).json({
          error: "Only pending movements can be rejected",
        });
      }

      const rejected = await storage.rejectMovement(
        req.params.id,
        req.user.id,
        reason.trim()
      );
      
      // Log audit trail
      await storage.createAuditLog({
        entityType: "movement",
        entityId: req.params.id,
        action: "reject",
        userId: req.user.id,
        reason: `Movement rejected: ${reason.trim()}`,
      });

      res.json(rejected);
    } catch (error) {
      console.error("Failed to reject movement:", error);
      res.status(500).json({ error: "Failed to reject movement" });
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

  // Populate/Update all system permissions
  app.post("/api/permissions/populate", async (req, res) => {
    try {
      const allPermissions = [
        // Operações
        { page: 'dashboard', displayName: 'Dashboard', category: 'Operações' },
        { page: 'events', displayName: 'Eventos', category: 'Operações' },
        { page: 'requests', displayName: 'Requisições de Materiais', category: 'Operações' },
        { page: 'request-details', displayName: 'Detalhes de Requisição', category: 'Operações' },
        { page: 'loading-orders', displayName: 'Ordens de Carregamento', category: 'Operações' },
        { page: 'loading-order-details', displayName: 'Detalhes de Ordem', category: 'Operações' },
        { page: 'movements', displayName: 'Movimentações', category: 'Operações' },
        { page: 'movement-details', displayName: 'Detalhes de Movimentação', category: 'Operações' },
        { page: 'trips', displayName: 'Viagens', category: 'Operações' },
        
        // Estoque
        { page: 'inventory', displayName: 'Posição de Estoque', category: 'Estoque' },
        { page: 'inventory-views', displayName: 'Visões de Estoque', category: 'Estoque' },
        { page: 'products', displayName: 'Produtos', category: 'Estoque' },
        { page: 'kits', displayName: 'Kits', category: 'Estoque' },
        { page: 'product-variants', displayName: 'Variantes de Produtos', category: 'Estoque' },
        { page: 'suppliers', displayName: 'Fornecedores', category: 'Estoque' },
        
        // Aprovações
        { page: 'approvals', displayName: 'Aprovações de Requisições', category: 'Aprovações' },
        { page: 'approval-detail', displayName: 'Detalhes de Aprovação', category: 'Aprovações' },
        { page: 'movement-approvals', displayName: 'Aprovações de Movimentações', category: 'Aprovações' },
        
        // Relatórios
        { page: 'stock-simulation', displayName: 'Simulação de Estoque', category: 'Relatórios' },
        { page: 'stock-position-simulation', displayName: 'Simulação de Posição', category: 'Relatórios' },
        { page: 'returns', displayName: 'Devoluções e Avarias', category: 'Relatórios' },
        
        // Uploads e Importações
        { page: 'event-upload', displayName: 'Upload de Eventos', category: 'Importações' },
        { page: 'product-upload', displayName: 'Upload de Produtos', category: 'Importações' },
        { page: 'trip-upload', displayName: 'Upload de Viagens', category: 'Importações' },
        
        // Configurações
        { page: 'config', displayName: 'Configurações Gerais', category: 'Configurações' },
        { page: 'users', displayName: 'Usuários', category: 'Configurações' },
        { page: 'roles', displayName: 'Papéis e Permissões', category: 'Configurações' },
        { page: 'docks', displayName: 'Docas', category: 'Configurações' },
        { page: 'drivers', displayName: 'Motoristas', category: 'Configurações' },
        { page: 'vehicle-types', displayName: 'Tipos de Veículos', category: 'Configurações' },
        { page: 'movement-groups', displayName: 'Grupos de Movimentação', category: 'Configurações' },
        { page: 'movement-types-config', displayName: 'Tipos de Movimentação', category: 'Configurações' },
        { page: 'product-statuses', displayName: 'Status de Produtos', category: 'Configurações' },
        { page: 'locations', displayName: 'Localizações', category: 'Configurações' },
        
        // Notificações
        { page: 'notification-settings', displayName: 'Configurações de Notificações', category: 'Notificações' },
        
        // Autenticação (páginas públicas - não exigem permissão, mas listadas para completude)
        { page: 'auth-page', displayName: 'Login/Registro', category: 'Autenticação' },
        { page: 'forgot-password', displayName: 'Esqueci Senha', category: 'Autenticação' },
        { page: 'reset-password', displayName: 'Redefinir Senha', category: 'Autenticação' },
      ];

      const existing = await storage.getPermissions();
      let createdCount = 0;
      let updatedCount = 0;

      for (const perm of allPermissions) {
        const exists = existing.find((p) => p.page === perm.page);
        
        if (exists) {
          // Update display name if changed
          if (exists.displayName !== perm.displayName) {
            await storage.updatePermission(exists.id, { displayName: perm.displayName });
            updatedCount++;
          }
        } else {
          // Create new permission
          await storage.createPermission({
            page: perm.page,
            displayName: perm.displayName,
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
          });
          createdCount++;
        }
      }

      res.json({
        success: true,
        created: createdCount,
        updated: updatedCount,
        total: allPermissions.length,
      });
    } catch (error) {
      console.error("Error populating permissions:", error);
      res.status(500).json({ error: "Failed to populate permissions" });
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

  // Comments
  // Get comments for an entity
  app.get("/api/comments/:entityType/:entityId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { entityType, entityId } = req.params;
      const comments = await storage.getComments(entityType, entityId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Create a comment with @mentions
  app.post("/api/comments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = req.user as any;
      const data = insertCommentSchema.parse(req.body);

      // Parse @mentions from content (format: @username)
      const mentionRegex = /@(\w+)/g;
      const matches = Array.from(data.content.matchAll(mentionRegex)).map(match => match[1]);
      const mentionedUsernames = Array.from(new Set(matches));

      // Get mentioned users
      const mentionedUserIds: string[] = [];
      for (const username of mentionedUsernames) {
        const mentionedUser = await storage.getUserByUsername(username);
        if (mentionedUser) {
          mentionedUserIds.push(mentionedUser.id);
        }
      }

      // Create comment
      const comment = await storage.createComment({
        ...data,
        authorId: user.id,
        mentions: mentionedUserIds,
      });

      // Create notifications for mentioned users
      for (const mentionedUserId of mentionedUserIds) {
        const mentionedUser = await storage.getUser(mentionedUserId);
        if (!mentionedUser) continue;

        // Build action URL based on entity type
        let actionUrl = "";
        let entityName = "";
        
        switch (data.entityType) {
          case "event":
            actionUrl = `/events/${data.entityId}`;
            const event = await storage.getEvent(data.entityId);
            entityName = event?.name || "evento";
            break;
          case "material_request":
            actionUrl = `/requests/${data.entityId}`;
            entityName = "requisição de material";
            break;
          case "trip":
            actionUrl = `/trips/${data.entityId}`;
            const trip = await storage.getTrip(data.entityId);
            entityName = trip?.description || "viagem";
            break;
          case "loading_order":
            actionUrl = `/loading-orders/${data.entityId}`;
            entityName = "ordem de carregamento";
            break;
          case "movement":
            actionUrl = `/movements/${data.entityId}`;
            const movement = await storage.getMovement(data.entityId);
            entityName = movement?.name || "movimentação";
            break;
        }

        // Create notification
        await storage.createNotification({
          userId: mentionedUserId,
          type: "mention",
          title: `${user.name} mencionou você`,
          message: `${user.name} mencionou você em um comentário em ${entityName}`,
          entityType: data.entityType as any,
          entityId: data.entityId,
          commentId: comment.id,
          actionUrl,
        });
      }

      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Notifications
  // Get all notifications for current user
  app.get("/api/notifications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = req.user as any;
      const notifications = await storage.getNotifications(user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notifications for current user
  app.get("/api/notifications/unread", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = req.user as any;
      const notifications = await storage.getUnreadNotifications(user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread/count", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = req.user as any;
      const count = await storage.getUnreadNotificationCount(user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ error: "Failed to fetch unread notification count" });
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/read-all", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = req.user as any;
      await storage.markAllNotificationsAsRead(user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Notification Settings
  // Get notification settings for current user
  app.get("/api/notification-settings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = req.user as any;
      let settings = await storage.getNotificationSettings(user.id);
      
      // Create default settings if they don't exist
      if (!settings) {
        settings = await storage.createNotificationSettings({
          userId: user.id,
          emailOnMention: true,
          emailOnCommentReply: false,
          emailOnStatusChange: false,
          emailOnApprovalRequest: true,
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching notification settings:", error);
      res.status(500).json({ error: "Failed to fetch notification settings" });
    }
  });

  // Update notification settings
  app.patch("/api/notification-settings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = req.user as any;
      const data = insertNotificationSettingsSchema.partial().parse(req.body);
      
      // Check if settings exist
      let settings = await storage.getNotificationSettings(user.id);
      
      if (!settings) {
        // Create new settings if they don't exist
        settings = await storage.createNotificationSettings({
          userId: user.id,
          emailOnMention: data.emailOnMention ?? true,
          emailOnCommentReply: data.emailOnCommentReply ?? false,
          emailOnStatusChange: data.emailOnStatusChange ?? false,
          emailOnApprovalRequest: data.emailOnApprovalRequest ?? true,
        });
      } else {
        // Update existing settings
        settings = await storage.updateNotificationSettings(user.id, data);
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({ error: "Failed to update notification settings" });
    }
  });

  // Get all users for @mention autocomplete
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const users = await storage.getUsers();
      // Return only necessary fields for autocomplete
      const simplifiedUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
      }));
      res.json(simplifiedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // ========== PHASE 1: Movement Groups & Types Config ==========
  
  // Movement Groups
  app.get("/api/movement-groups", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const groups = await storage.getMovementGroups();
      res.json(groups);
    } catch (error) {
      console.error("Error fetching movement groups:", error);
      res.status(500).json({ error: "Failed to fetch movement groups" });
    }
  });

  app.get("/api/movement-groups/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const group = await storage.getMovementGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ error: "Movement group not found" });
      }
      res.json(group);
    } catch (error) {
      console.error("Error fetching movement group:", error);
      res.status(500).json({ error: "Failed to fetch movement group" });
    }
  });

  app.post("/api/movement-groups", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const data = insertMovementGroupSchema.parse(req.body);
      const group = await storage.createMovementGroup(data);
      res.json(group);
    } catch (error) {
      console.error("Error creating movement group:", error);
      res.status(500).json({ error: "Failed to create movement group" });
    }
  });

  app.patch("/api/movement-groups/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const data = insertMovementGroupSchema.partial().parse(req.body);
      const group = await storage.updateMovementGroup(req.params.id, data);
      res.json(group);
    } catch (error) {
      console.error("Error updating movement group:", error);
      res.status(500).json({ error: "Failed to update movement group" });
    }
  });

  app.delete("/api/movement-groups/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      await storage.deleteMovementGroup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting movement group:", error);
      res.status(500).json({ error: "Failed to delete movement group" });
    }
  });

  // Movement Types Config
  app.get("/api/movement-types-config", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const filters: any = {};
      if (req.query.groupId) filters.groupId = req.query.groupId as string;
      if (req.query.nature) filters.nature = req.query.nature as string;
      if (req.query.active !== undefined) filters.active = req.query.active === 'true';
      
      const types = await storage.getMovementTypesConfig(filters);
      res.json(types);
    } catch (error) {
      console.error("Error fetching movement types config:", error);
      res.status(500).json({ error: "Failed to fetch movement types config" });
    }
  });

  app.get("/api/movement-types-config/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const typeConfig = await storage.getMovementTypeConfig(req.params.id);
      if (!typeConfig) {
        return res.status(404).json({ error: "Movement type config not found" });
      }
      res.json(typeConfig);
    } catch (error) {
      console.error("Error fetching movement type config:", error);
      res.status(500).json({ error: "Failed to fetch movement type config" });
    }
  });

  app.post("/api/movement-types-config", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const data = insertMovementTypeConfigSchema.parse(req.body);
      const typeConfig = await storage.createMovementTypeConfig(data);
      res.json(typeConfig);
    } catch (error) {
      console.error("Error creating movement type config:", error);
      res.status(500).json({ error: "Failed to create movement type config" });
    }
  });

  app.patch("/api/movement-types-config/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const data = insertMovementTypeConfigSchema.partial().parse(req.body);
      const typeConfig = await storage.updateMovementTypeConfig(req.params.id, data);
      res.json(typeConfig);
    } catch (error) {
      console.error("Error updating movement type config:", error);
      res.status(500).json({ error: "Failed to update movement type config" });
    }
  });

  app.delete("/api/movement-types-config/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      await storage.deleteMovementTypeConfig(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting movement type config:", error);
      res.status(500).json({ error: "Failed to delete movement type config" });
    }
  });

  // Supplier tracking
  app.get("/api/products/:sku/recent-suppliers", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const months = req.query.months ? parseInt(req.query.months as string) : 3;
      const suppliers = await storage.getRecentSuppliersBySku(req.params.sku, months);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching recent suppliers:", error);
      res.status(500).json({ error: "Failed to fetch recent suppliers" });
    }
  });

  // Inventory Overview - Aggregated stock views with filtering
  app.get("/api/inventory/overview", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const filters = {
        search: req.query.search as string | undefined,
        periodPreset: req.query.periodPreset as 'week' | 'month' | 'quarter' | 'year' | undefined,
        periodStart: req.query.periodStart ? new Date(req.query.periodStart as string) : undefined,
        periodEnd: req.query.periodEnd ? new Date(req.query.periodEnd as string) : undefined,
        location: req.query.location as string | undefined,
        category: req.query.category as string | undefined,
        ownerType: req.query.ownerType as string | undefined,
        ownerName: req.query.ownerName as string | undefined,
        status: req.query.status as string | undefined,
        groupBy: (req.query.groupBy as string || 'product') as 'product' | 'location' | 'owner' | 'status' | 'category'
      };

      const overview = await storage.getInventoryOverview(filters);
      res.json(overview);
    } catch (error) {
      console.error("Error fetching inventory overview:", error);
      res.status(500).json({ error: "Failed to fetch inventory overview" });
    }
  });

  // Register AI Optimization routes
  registerOptimizationRoutes(app);

  // Register Reports routes
  registerReportsRoutes(app);

  // ===== PROTOTYPES: Product Statuses & Locations =====

  // Product Statuses
  app.get("/api/product-statuses", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { db } = await import("./db");
      const { productStatuses } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const statuses = await db.select().from(productStatuses).orderBy(desc(productStatuses.displayOrder));
      res.json(statuses);
    } catch (error) {
      console.error("Error fetching product statuses:", error);
      res.status(500).json({ error: "Failed to fetch product statuses" });
    }
  });

  app.post("/api/product-statuses", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { db } = await import("./db");
      const { productStatuses } = await import("@shared/schema");
      const [created] = await db.insert(productStatuses).values(req.body).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating product status:", error);
      res.status(400).json({ error: "Failed to create product status" });
    }
  });

  app.patch("/api/product-statuses/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { db } = await import("./db");
      const { productStatuses } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [updated] = await db
        .update(productStatuses)
        .set(req.body)
        .where(eq(productStatuses.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating product status:", error);
      res.status(400).json({ error: "Failed to update product status" });
    }
  });

  // Locations
  app.get("/api/locations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { db } = await import("./db");
      const { locations } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const locs = await db.select().from(locations).orderBy(desc(locations.createdAt));
      res.json(locs);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  app.post("/api/locations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { db } = await import("./db");
      const { locations } = await import("@shared/schema");
      const [created] = await db.insert(locations).values(req.body).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating location:", error);
      res.status(400).json({ error: "Failed to create location" });
    }
  });

  app.patch("/api/locations/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { db } = await import("./db");
      const { locations } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [updated] = await db
        .update(locations)
        .set(req.body)
        .where(eq(locations.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(400).json({ error: "Failed to update location" });
    }
  });

  // User Management
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        active: users.active,
        approvalStatus: users.approvalStatus,
        approvedBy: users.approvedBy,
        approvedAt: users.approvedAt,
        rejectedBy: users.rejectedBy,
        rejectedAt: users.rejectedAt,
        rejectionReason: users.rejectionReason,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      }).from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id/approve", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const userId = req.params.id;
      const approverId = (req.user as any).id;

      const [updated] = await db
        .update(users)
        .set({
          approvalStatus: 'approved',
          approvedBy: approverId,
          approvedAt: new Date(),
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        } as any)
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          username: users.username,
          name: users.name,
          email: users.email,
          active: users.active,
          approvalStatus: users.approvalStatus,
          approvedBy: users.approvedBy,
          approvedAt: users.approvedAt,
          createdAt: users.createdAt,
        });

      res.json(updated);
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({ error: "Failed to approve user" });
    }
  });

  app.patch("/api/users/:id/reject", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const userId = req.params.id;
      const rejecterId = (req.user as any).id;
      const { reason } = req.body;

      const [updated] = await db
        .update(users)
        .set({
          approvalStatus: 'rejected',
          rejectedBy: rejecterId,
          rejectedAt: new Date(),
          rejectionReason: reason || null,
          approvedBy: null,
          approvedAt: null,
        } as any)
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          username: users.username,
          name: users.name,
          email: users.email,
          active: users.active,
          approvalStatus: users.approvalStatus,
          rejectedBy: users.rejectedBy,
          rejectedAt: users.rejectedAt,
          rejectionReason: users.rejectionReason,
          createdAt: users.createdAt,
        });

      res.json(updated);
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ error: "Failed to reject user" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

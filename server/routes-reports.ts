import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq, inArray, and, or, gte, lte } from "drizzle-orm";
import { materialRequests, requestItems, products, events } from "@shared/schema";

interface StockSimulationParams {
  eventIds?: string[];
  requestIds?: string[];
  startDate?: string;
  endDate?: string;
  productCategory?: string;
  requestStatus?: string[];
}

interface ProductSimulation {
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  totalNeed: number;
  currentStock: number;
  balance: number;
  status: 'FALTA' | 'CRÍTICO' | 'ADEQUADO';
  eventBreakdown: Array<{
    eventId: string;
    eventName: string;
    eventDate: Date;
    quantity: number;
  }>;
  requestBreakdown: Array<{
    requestId: string;
    requestArea: string;
    eventId: string;
    eventName: string;
    eventDate: Date;
    quantity: number;
  }>;
}

interface SimulationResult {
  generatedAt: Date;
  filters: StockSimulationParams;
  summary: {
    totalProducts: number;
    productsShortage: number;
    productsCritical: number;
    productsAdequate: number;
  };
  consideredRequests: Array<{
    id: string;
    area: string;
    eventId: string;
    eventName: string;
    status: string;
  }>;
  products: ProductSimulation[];
}

export function registerReportsRoutes(app: Express) {
  // Stock Simulation Report
  app.post("/api/reports/stock-simulation", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const params: StockSimulationParams = req.body;
      const {
        eventIds,
        requestIds,
        startDate,
        endDate,
        requestStatus = ['approved', 'pending_approval']
      } = params;

      // Build query conditions
      const conditions: any[] = [];

      if (eventIds && eventIds.length > 0) {
        conditions.push(inArray(materialRequests.eventId, eventIds));
      }

      if (requestIds && requestIds.length > 0) {
        conditions.push(inArray(materialRequests.id, requestIds));
      }

      if (requestStatus && requestStatus.length > 0) {
        conditions.push(inArray(materialRequests.status, requestStatus as any));
      }

      // Get relevant material requests
      const requests = await db
        .select({
          id: materialRequests.id,
          eventId: materialRequests.eventId,
          area: materialRequests.area,
          status: materialRequests.status,
        })
        .from(materialRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      if (requests.length === 0) {
        return res.json({
          generatedAt: new Date(),
          filters: params,
          summary: {
            totalProducts: 0,
            productsShortage: 0,
            productsCritical: 0,
            productsAdequate: 0,
          },
          consideredRequests: [],
          products: [],
        });
      }

      const requestIdsList = requests.map(r => r.id);

      // Get all request items for these requests
      const items = await db
        .select({
          requestId: requestItems.requestId,
          productId: requestItems.productId,
          quantity: requestItems.quantity,
          approvalStatus: requestItems.approvalStatus,
          approvedQuantity: requestItems.approvedQuantity,
        })
        .from(requestItems)
        .where(
          and(
            inArray(requestItems.requestId, requestIdsList),
            sql`${requestItems.productId} IS NOT NULL`
          )
        );

      // Get event details
      const eventIdsSet = new Set<string>();
      requests.forEach(r => eventIdsSet.add(r.eventId));
      const eventIdsList = Array.from(eventIdsSet);
      
      // Build event filter conditions
      const eventConditions: any[] = [inArray(events.id, eventIdsList)];
      
      if (startDate) {
        eventConditions.push(gte(events.eventDate, new Date(startDate)));
      }
      
      if (endDate) {
        eventConditions.push(lte(events.eventDate, new Date(endDate)));
      }
      
      const eventsData = await db
        .select({
          id: events.id,
          name: events.name,
          eventDate: events.eventDate,
        })
        .from(events)
        .where(and(...eventConditions));

      const eventsMap = new Map(eventsData.map(e => [e.id, e]));

      // Get all unique product IDs
      const productIdsSet = new Set<string>();
      items.forEach(i => i.productId && productIdsSet.add(i.productId));
      const productIds = Array.from(productIdsSet);

      // Get product details with stock levels
      const productsData = await db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          unit: products.unit,
          currentStock: products.currentStock,
          minimumStock: products.minimumStock,
        })
        .from(products)
        .where(inArray(products.id, productIds));

      const productsMap = new Map(productsData.map(p => [p.id, p]));

      // Aggregate by product
      const productAggregation = new Map<string, {
        totalNeed: number;
        requestBreakdown: Array<{
          requestId: string;
          requestArea: string;
          eventId: string;
          eventName: string;
          eventDate: Date;
          quantity: number;
        }>;
      }>();

      for (const item of items) {
        if (!item.productId) continue;

        const request = requests.find(r => r.id === item.requestId);
        if (!request) continue;

        const event = eventsMap.get(request.eventId);
        // Skip if event was filtered out by date range
        if (!event) continue;
        
        // Skip if product was filtered out by category
        const product = productsMap.get(item.productId);
        if (!product) continue;

        // Determine quantity to use based on approval status
        let quantityToUse = 0;
        if (item.approvalStatus === 'approved' && item.approvedQuantity !== null) {
          quantityToUse = item.approvedQuantity;
        } else if (item.approvalStatus === 'pending' || item.approvalStatus === 'approved') {
          quantityToUse = item.quantity;
        }
        // rejected items don't count

        if (quantityToUse === 0) continue;

        if (!productAggregation.has(item.productId)) {
          productAggregation.set(item.productId, {
            totalNeed: 0,
            requestBreakdown: [],
          });
        }

        const agg = productAggregation.get(item.productId)!;
        agg.totalNeed += quantityToUse;
        agg.requestBreakdown.push({
          requestId: request.id,
          requestArea: request.area,
          eventId: event.id,
          eventName: event.name,
          eventDate: event.eventDate,
          quantity: quantityToUse,
        });
      }

      // Build final product simulations
      const productSimulations: ProductSimulation[] = [];

      productAggregation.forEach((aggregation, productId) => {
        const product = productsMap.get(productId);
        if (!product) return;

        const currentStock = product.currentStock || 0;
        const balance = currentStock - aggregation.totalNeed;
        
        let status: 'FALTA' | 'CRÍTICO' | 'ADEQUADO';
        if (balance < 0) {
          status = 'FALTA';
        } else if (currentStock > 0 && balance <= currentStock * 0.1) {
          status = 'CRÍTICO';
        } else {
          status = 'ADEQUADO';
        }

        // Create eventBreakdown by aggregating requestBreakdown by event
        const eventMap = new Map<string, {
          eventId: string;
          eventName: string;
          eventDate: Date;
          quantity: number;
        }>();

        aggregation.requestBreakdown.forEach(rb => {
          if (!eventMap.has(rb.eventId)) {
            eventMap.set(rb.eventId, {
              eventId: rb.eventId,
              eventName: rb.eventName,
              eventDate: rb.eventDate,
              quantity: 0,
            });
          }
          const eventEntry = eventMap.get(rb.eventId)!;
          eventEntry.quantity += rb.quantity;
        });

        const eventBreakdown = Array.from(eventMap.values()).sort(
          (a, b) => a.eventDate.getTime() - b.eventDate.getTime()
        );

        productSimulations.push({
          productId: product.id,
          productSku: product.sku,
          productName: product.name,
          unit: product.unit,
          totalNeed: aggregation.totalNeed,
          currentStock,
          balance,
          status,
          eventBreakdown,
          requestBreakdown: aggregation.requestBreakdown.sort(
            (a, b) => a.eventDate.getTime() - b.eventDate.getTime()
          ),
        });
      });

      // Sort: FALTA first, then CRÍTICO, then ADEQUADO
      productSimulations.sort((a: ProductSimulation, b: ProductSimulation) => {
        const statusOrder: Record<string, number> = { FALTA: 0, CRÍTICO: 1, ADEQUADO: 2 };
        const orderDiff = statusOrder[a.status] - statusOrder[b.status];
        if (orderDiff !== 0) return orderDiff;
        return a.productName.localeCompare(b.productName);
      });

      // Calculate summary
      const summary = {
        totalProducts: productSimulations.length,
        productsShortage: productSimulations.filter(p => p.status === 'FALTA').length,
        productsCritical: productSimulations.filter(p => p.status === 'CRÍTICO').length,
        productsAdequate: productSimulations.filter(p => p.status === 'ADEQUADO').length,
      };

      // Build list of considered requests
      const consideredRequests = requests
        .filter(r => eventsMap.has(r.eventId))
        .map(r => {
          const event = eventsMap.get(r.eventId)!;
          return {
            id: r.id,
            area: r.area,
            eventId: r.eventId,
            eventName: event.name,
            status: r.status,
          };
        })
        .sort((a, b) => a.eventName.localeCompare(b.eventName));

      const result: SimulationResult = {
        generatedAt: new Date(),
        filters: params,
        summary,
        consideredRequests,
        products: productSimulations,
      };

      res.json(result);
    } catch (error: any) {
      console.error("Stock simulation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get events for simulation filters
  app.get("/api/reports/simulation-events", async (req: Request, res: Response) => {
    try {
      const allEvents = await storage.getEvents();
      
      // Filter future or ongoing events
      const now = new Date();
      const relevantEvents = allEvents.filter(e => 
        new Date(e.eventDate) >= now || e.status === 'in_progress'
      );

      res.json(relevantEvents);
    } catch (error: any) {
      console.error("Get simulation events error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get material requests for simulation filters
  app.get("/api/reports/simulation-requests", async (req: Request, res: Response) => {
    try {
      const { eventIds } = req.query;
      
      let conditions: any[] = [];
      if (eventIds && typeof eventIds === 'string') {
        const ids = eventIds.split(',');
        conditions.push(inArray(materialRequests.eventId, ids));
      }

      const requests = await db
        .select({
          id: materialRequests.id,
          eventId: materialRequests.eventId,
          area: materialRequests.area,
          status: materialRequests.status,
          createdAt: materialRequests.createdAt,
        })
        .from(materialRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(materialRequests.createdAt);

      res.json(requests);
    } catch (error: any) {
      console.error("Get simulation requests error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}

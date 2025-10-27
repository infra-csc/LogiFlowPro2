import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq, inArray, and, or, gte, lte } from "drizzle-orm";
import { 
  materialRequests, 
  requestItems, 
  products, 
  events, 
  loadingOrders,
  loadingOrderItems,
  loadingOrderTrips,
  trips
} from "@shared/schema";

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

  // Period-based Stock Position Simulation Report
  app.post("/api/reports/stock-position-simulation", async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        startDate,
        endDate,
        eventIds,
        orderStatus
      } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Start date and end date are required" });
      }

      // Build query conditions for loading orders
      const conditions: any[] = [];

      if (eventIds && eventIds.length > 0) {
        conditions.push(inArray(loadingOrders.eventId, eventIds));
      }

      if (orderStatus && orderStatus.length > 0) {
        conditions.push(inArray(loadingOrders.status, orderStatus as any));
      }

      // Get loading orders with their items, trips, and events
      const orders = await db
        .select({
          orderId: loadingOrders.id,
          orderNumber: loadingOrders.orderNumber,
          orderStatus: loadingOrders.status,
          loadingDate: loadingOrders.loadingDate,
          unloadingDate: loadingOrders.unloadingDate,
          eventId: loadingOrders.eventId,
          eventName: events.name,
          eventDate: events.eventDate,
        })
        .from(loadingOrders)
        .leftJoin(events, eq(loadingOrders.eventId, events.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Get all trips for these orders
      const orderIds = orders.map(o => o.orderId);
      const orderTripsData = orderIds.length > 0 ? await db
        .select({
          orderId: loadingOrderTrips.loadingOrderId,
          tripId: trips.id,
          loadingLocation: trips.loadingLocation,
          unloadingLocation: trips.unloadingLocation,
          loadingStartTime: trips.loadingStartTime,
          unloadingEndTime: trips.unloadingEndTime,
        })
        .from(loadingOrderTrips)
        .leftJoin(trips, eq(loadingOrderTrips.tripId, trips.id))
        .where(inArray(loadingOrderTrips.loadingOrderId, orderIds)) : [];

      // Get all items for these orders
      const orderItemsData = orderIds.length > 0 ? await db
        .select({
          orderId: loadingOrderItems.loadingOrderId,
          productId: loadingOrderItems.productId,
          quantity: loadingOrderItems.consolidatedQuantity,
          productSku: products.sku,
          productName: products.name,
          productStock: products.currentStock,
        })
        .from(loadingOrderItems)
        .leftJoin(products, eq(loadingOrderItems.productId, products.id))
        .where(inArray(loadingOrderItems.loadingOrderId, orderIds)) : [];

      // Calculate period availability for each order
      const ordersWithPeriods = orders.map(order => {
        // Get trips for this order
        const orderTrips = orderTripsData.filter(t => t.orderId === order.orderId);
        
        let periodStart: Date | null = null;
        let periodEnd: Date | null = null;
        let hasMultipleTrips = false;
        let periodDetail = "";

        if (orderTrips.length > 0) {
          // Case 1: Order with attached trips
          orderTrips.forEach(trip => {
            if (trip.loadingStartTime) {
              if (!periodStart || trip.loadingStartTime < periodStart) {
                periodStart = trip.loadingStartTime;
              }
            }
            if (trip.unloadingEndTime) {
              if (!periodEnd || trip.unloadingEndTime > periodEnd) {
                periodEnd = trip.unloadingEndTime;
              }
            }
          });

          hasMultipleTrips = orderTrips.length > 1;
          periodDetail = hasMultipleTrips
            ? `Múltiplas viagens: ${orderTrips.length} viagens`
            : `Viagem única`;

        } else if (order.loadingDate && order.unloadingDate) {
          // Case 2: Order with own period
          periodStart = order.loadingDate;
          periodEnd = order.unloadingDate;
          periodDetail = `Período da ordem`;
        }

        return {
          ...order,
          periodStart,
          periodEnd,
          hasMultipleTrips,
          periodDetail,
          daysUnavailable: periodStart && periodEnd
            ? Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
            : 0
        };
      });

      // Filter orders that overlap with the requested period
      const filterStart = new Date(startDate);
      const filterEnd = new Date(endDate);
      const relevantOrders = ordersWithPeriods.filter(order => {
        if (!order.periodStart || !order.periodEnd) return false;
        
        // Check if periods overlap
        return order.periodStart <= filterEnd && order.periodEnd >= filterStart;
      });

      // Aggregate by product
      const productMap = new Map<string, {
        productId: string;
        productSku: string;
        productName: string;
        currentStock: number;
        allocatedQuantity: number;
        ordersDetails: any[];
      }>();

      relevantOrders.forEach(order => {
        const items = orderItemsData.filter(item => item.orderId === order.orderId);
        
        items.forEach(item => {
          if (!item.productId) return;

          if (!productMap.has(item.productId)) {
            productMap.set(item.productId, {
              productId: item.productId,
              productSku: item.productSku || '',
              productName: item.productName || '',
              currentStock: item.productStock || 0,
              allocatedQuantity: 0,
              ordersDetails: []
            });
          }

          const product = productMap.get(item.productId)!;
          product.allocatedQuantity += item.quantity || 0;
          product.ordersDetails.push({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            eventName: order.eventName,
            quantity: item.quantity,
            periodStart: order.periodStart,
            periodEnd: order.periodEnd,
            periodDetail: order.periodDetail,
            hasMultipleTrips: order.hasMultipleTrips,
            status: order.orderStatus,
            daysUnavailable: order.daysUnavailable
          });
        });
      });

      // Calculate final results
      const productsResults = Array.from(productMap.values()).map(product => {
        const availableStock = product.currentStock - product.allocatedQuantity;
        const utilization = product.currentStock > 0
          ? (product.allocatedQuantity / product.currentStock) * 100
          : 0;

        let status: 'DISPONÍVEL' | 'PARCIAL' | 'TOTALMENTE_ALOCADO';
        if (utilization >= 100) {
          status = 'TOTALMENTE_ALOCADO';
        } else if (utilization >= 80) {
          status = 'PARCIAL';
        } else {
          status = 'DISPONÍVEL';
        }

        // Find overall period (earliest start to latest end)
        let earliestStart: Date | null = null;
        let latestEnd: Date | null = null;
        product.ordersDetails.forEach(order => {
          if (order.periodStart && (!earliestStart || order.periodStart < earliestStart)) {
            earliestStart = order.periodStart;
          }
          if (order.periodEnd && (!latestEnd || order.periodEnd > latestEnd)) {
            latestEnd = order.periodEnd;
          }
        });

        return {
          productId: product.productId,
          productSku: product.productSku,
          productName: product.productName,
          currentStock: product.currentStock,
          allocatedQuantity: product.allocatedQuantity,
          availableStock,
          utilization: Math.round(utilization * 10) / 10,
          status,
          allocationPeriod: earliestStart && latestEnd ? {
            start: earliestStart,
            end: latestEnd,
            days: Math.ceil(((latestEnd as Date).getTime() - (earliestStart as Date).getTime()) / (1000 * 60 * 60 * 24))
          } : null,
          ordersDetails: product.ordersDetails
        };
      });

      // Calculate summary
      const summary = {
        totalProducts: productsResults.length,
        availableProducts: productsResults.filter(p => p.status === 'DISPONÍVEL').length,
        partialProducts: productsResults.filter(p => p.status === 'PARCIAL').length,
        fullyAllocatedProducts: productsResults.filter(p => p.status === 'TOTALMENTE_ALOCADO').length
      };

      // Validation errors and warnings
      const errors = ordersWithPeriods
        .filter(order => !order.periodStart || !order.periodEnd)
        .map(order => ({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          message: 'Ordem sem período definido (sem viagens e sem datas próprias)'
        }));

      const warnings = ordersWithPeriods
        .filter(order => order.hasMultipleTrips)
        .map(order => ({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          message: order.periodDetail
        }));

      res.json({
        generatedAt: new Date(),
        filters: { startDate, endDate, eventIds, orderStatus },
        summary,
        products: productsResults,
        errors,
        warnings
      });

    } catch (error: any) {
      console.error("Stock position simulation error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}

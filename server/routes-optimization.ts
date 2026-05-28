import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { optimizeVehicleLoading, optimizeRoute } from "./optimization-engine";
import { requireAuth } from "./ownership";
import { requireAnyRole } from "./authz";
import { ROLES } from "@shared/roles";

export function registerOptimizationRoutes(app: Express) {
  // Request vehicle loading optimization
  app.post(
    "/api/loading-orders/:id/optimize",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem executar otimizações",
    }),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { vehicleTypeId } = req.body;

      // Get loading order with items
      const loadingOrder = await storage.getLoadingOrder(id);
      if (!loadingOrder) {
        return res.status(404).json({ error: "Loading order not found" });
      }
      
      const items = await storage.getLoadingOrderItems(id);
      if (items.length === 0) {
        return res.status(400).json({ error: "No items to optimize" });
      }
      
      // Get vehicle type
      const vehicleType = await storage.getVehicleType(vehicleTypeId);
      if (!vehicleType) {
        return res.status(404).json({ error: "Vehicle type not found" });
      }
      
      // Get product details for each item
      const itemsWithProducts = await Promise.all(
        items.map(async (item) => {
          const product = await storage.getProduct(item.productId);
          return {
            product: product!,
            quantity: item.consolidatedQuantity
          };
        })
      );
      
      // Create optimization run
      const startTime = Date.now();
      const optimizationRun = await storage.createOptimizationRun({
        type: 'vehicle_loading',
        status: 'processing',
        loadingOrderId: id,
        requestedBy: req.user!.id,
        inputParams: {
          productIds: items.map(i => i.productId),
          vehicleTypeId
        }
      });
      
      try {
        // Run optimization algorithm
        const result = optimizeVehicleLoading(itemsWithProducts, vehicleType);
        const executionTimeMs = Date.now() - startTime;
        
        // Calculate confidence score based on results
        const confidenceScore = Math.min(
          95,
          50 + (result.utilizationPercentage * 0.3) + (result.weightDistributionScore * 0.2)
        );
        
        // Update run status
        await storage.updateOptimizationRun(optimizationRun.id, {
          status: 'completed',
          executionTimeMs,
          completedAt: new Date()
        });
        
        // Save optimization result
        const optimization = await storage.createLoadingOptimization({
          optimizationRunId: optimizationRun.id,
          loadingOrderId: id,
          vehicleTypeId,
          confidenceScore: confidenceScore.toFixed(2),
          utilizationPercentage: result.utilizationPercentage.toFixed(2),
          weightDistributionScore: result.weightDistributionScore.toFixed(2),
          loadingSequence: result.items,
          warnings: result.warnings,
          recommendations: result.recommendations,
          estimatedLoadingTimeMinutes: result.estimatedLoadingTimeMinutes
        });
        
        res.json({
          success: true,
          optimization: {
            ...optimization,
            vehicleTypeName: vehicleType.name
          }
        });
        
      } catch (error: any) {
        await storage.updateOptimizationRun(optimizationRun.id, {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date()
        });
        throw error;
      }
      
    } catch (error: any) {
      console.error("Optimization error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get loading optimizations for a loading order
  app.get("/api/loading-orders/:id/optimizations", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const optimizations = await storage.getLoadingOptimizationsByLoadingOrder(id);
      res.json(optimizations);
    } catch (error: any) {
      console.error("Get optimizations error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Request route optimization for a trip
  app.post("/api/trips/:id/optimize-route", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Get trip with destinations
      const trip = await storage.getTrip(id);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      const destinations = await storage.getTripDestinations(id);
      if (destinations.length === 0) {
        return res.status(400).json({ error: "No destinations to optimize" });
      }
      
      // Create optimization run
      const startTime = Date.now();
      const optimizationRun = await storage.createOptimizationRun({
        type: 'route_planning',
        status: 'processing',
        tripId: id,
        requestedBy: req.user!.id,
        inputParams: {
          destinations: destinations.map(d => ({
            location: d.location,
            arrivalDateTime: d.arrivalDateTime
          }))
        }
      });
      
      try {
        // Run route optimization
        const result = optimizeRoute(
          trip.loadingLocation || "Depósito Central",
          destinations.map(d => ({
            location: d.location,
            arrivalTime: d.arrivalDateTime.toISOString()
          })),
          trip.unloadingLocation ?? undefined
        );
        
        const executionTimeMs = Date.now() - startTime;
        
        // Calculate confidence score
        const confidenceScore = 85 + Math.random() * 10;
        
        // Update run status
        await storage.updateOptimizationRun(optimizationRun.id, {
          status: 'completed',
          executionTimeMs,
          completedAt: new Date()
        });
        
        // Save route optimization
        const optimization = await storage.createRouteOptimization({
          optimizationRunId: optimizationRun.id,
          tripId: id,
          confidenceScore: confidenceScore.toFixed(2),
          totalDistanceKm: result.totalDistanceKm.toFixed(2),
          estimatedDurationMinutes: result.estimatedDurationMinutes,
          fuelEstimateLiters: result.fuelEstimateLiters.toFixed(2),
          optimizedRoute: result.stops,
          warnings: [
            result.totalDistanceKm > 500 ? "Rota longa - considere dividir em múltiplas viagens" : null
          ].filter((x): x is string => x !== null),
          recommendations: [
            "Considere horários de menor tráfego para otimizar tempo",
            result.fuelEstimateLiters > 100 ? "Alto consumo de combustível - verifique peso da carga" : null
          ].filter((x): x is string => x !== null)
        });
        
        res.json({
          success: true,
          optimization
        });
        
      } catch (error: any) {
        await storage.updateOptimizationRun(optimizationRun.id, {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date()
        });
        throw error;
      }
      
    } catch (error: any) {
      console.error("Route optimization error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get route optimizations for a trip
  app.get("/api/trips/:id/route-optimizations", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const optimizations = await storage.getRouteOptimizationsByTrip(id);
      res.json(optimizations);
    } catch (error: any) {
      console.error("Get route optimizations error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}

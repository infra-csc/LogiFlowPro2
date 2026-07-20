import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { registerOptimizationRoutes } from "./routes-optimization";
import { registerReportsRoutes } from "./routes-reports";
import { registerStockProjectionRoutes } from "./routes-stock-projection";
import { registerRequestTemplateRoutes } from "./routes-request-templates";
import {
  insertEventSchema,
  insertKitSchema,
  insertBomLineSchema,
  insertSupplierSchema,
  insertProductSchema,
  insertMaterialRequestSchema,
  insertRequestItemSchema,
  requestAreaTemplateItems,
  requestAreaTemplates,
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
import { checkOwnership, canEditResource, isAdmin, requireAuth } from "./ownership";
import { requireAdmin, requireAnyRole } from "./authz";
import { resolveUploadPath, isInlineSafe } from "./uploadPath";
import { ROLES } from "@shared/roles";

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
    fileSize: 50 * 1024 * 1024, // 50MB limit (suporta vídeos)
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication first
  setupAuth(app);

  // Initialize default permissions
  await initializeDefaultPermissions();
  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
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

  app.get("/api/dashboard/recent-events", requireAuth, async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events.slice(0, 5));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent events" });
    }
  });

  // Dashboard summary — operational control tower aggregation
  app.get("/api/dashboard/summary", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in15days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const [allEvents, allTrips, allProducts, allRequests, allLoadingOrders, allMovements] =
        await Promise.all([
          storage.getEvents(),
          storage.getTrips(),
          storage.getProducts(),
          storage.getMaterialRequests(),
          storage.getLoadingOrders(),
          storage.getMovements(),
        ]);

      // ── KPIs ──
      const upcomingEvents = allEvents.filter((e) => {
        if (!e.eventDate) return false;
        const d = new Date(e.eventDate);
        return d >= now && d <= in15days;
      }).length;

      const pendingRequests = allRequests.filter(
        (r) => r.status === "pending_approval"
      ).length;

      const actionableOrders = allLoadingOrders.filter((lo) =>
        ["draft", "ready", "approved", "in_progress"].includes(lo.status)
      ).length;

      const activeMovements = allMovements.filter((m) =>
        ["in_progress", "paused"].includes(m.status)
      ).length;

      const lowStockItems = allProducts.filter(
        (p) =>
          p.minimumStock != null &&
          p.currentStock != null &&
          p.currentStock < p.minimumStock
      ).length;

      const upcomingTrips = allTrips.filter((t) => {
        if (!t.loadingStartTime) return false;
        const d = new Date(t.loadingStartTime);
        return (
          d >= now &&
          d <= in7days &&
          ["planned", "loading"].includes(t.status)
        );
      }).length;

      // ── Alerts ──
      const alerts: any[] = [];

      const zeroStock = allProducts.filter(
        (p) =>
          (p.currentStock ?? 0) === 0 &&
          p.minimumStock != null &&
          p.minimumStock > 0
      );
      if (zeroStock.length > 0) {
        alerts.push({
          id: "zero-stock",
          type: "stock",
          severity: "critical",
          message: `${zeroStock.length} produto${zeroStock.length > 1 ? "s" : ""} com estoque zerado`,
          href: "/reports/stock-projection",
        });
      }

      const lowStockList = allProducts.filter(
        (p) =>
          p.minimumStock != null &&
          p.currentStock != null &&
          p.currentStock > 0 &&
          p.currentStock < p.minimumStock
      );
      if (lowStockList.length > 0) {
        alerts.push({
          id: "low-stock",
          type: "stock",
          severity: "warning",
          message: `${lowStockList.length} produto${lowStockList.length > 1 ? "s" : ""} abaixo do estoque mínimo`,
          href: "/reports/stock-projection",
        });
      }

      const readyOrders = allLoadingOrders.filter((lo) => lo.status === "ready");
      if (readyOrders.length > 0) {
        alerts.push({
          id: "ready-orders",
          type: "loading",
          severity: "info",
          message: `${readyOrders.length} ordem${readyOrders.length > 1 ? "ns" : ""} de carregamento aguardando aprovação`,
          href: "/loading-orders",
        });
      }

      const pausedMovements = allMovements.filter((m) => m.status === "paused");
      if (pausedMovements.length > 0) {
        alerts.push({
          id: "paused-movements",
          type: "movement",
          severity: "warning",
          message: `${pausedMovements.length} movimentação${pausedMovements.length > 1 ? "ões" : ""} pausada${pausedMovements.length > 1 ? "s" : ""}`,
          href: "/movements",
        });
      }

      const tripsNoDriver = allTrips.filter(
        (t) => !t.driverId && ["planned", "loading"].includes(t.status)
      );
      if (tripsNoDriver.length > 0) {
        alerts.push({
          id: "trips-no-driver",
          type: "trips",
          severity: "warning",
          message: `${tripsNoDriver.length} viagem${tripsNoDriver.length > 1 ? "ns" : ""} planejada${tripsNoDriver.length > 1 ? "s" : ""} sem motorista`,
          href: "/trips",
        });
      }

      const urgentEvents = allEvents.filter((e) => {
        if (!e.eventDate) return false;
        const d = new Date(e.eventDate);
        return d >= now && d <= in3days;
      });
      for (const ev of urgentEvents.slice(0, 3)) {
        const daysLeft = Math.max(
          1,
          Math.ceil(
            (new Date(ev.eventDate!).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
        alerts.push({
          id: `event-urgent-${ev.id}`,
          type: "event",
          severity: daysLeft <= 1 ? "critical" : "warning",
          message: `${ev.name} ocorre em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`,
          entityName: ev.name,
          href: "/events",
        });
      }

      // ── Pending approvals ──
      const pendingApprovals = [
        ...(allRequests as any[])
          .filter((r) => r.status === "pending_approval")
          .slice(0, 5)
          .map((r) => ({
            id: r.id,
            type: "request" as const,
            name: r.area ? `${r.area}` : `Requisição #${String(r.id).slice(0, 6)}`,
            eventName: r.event?.name ?? undefined,
            requesterName: r.requestedByUser?.name ?? undefined,
            createdAt: r.createdAt,
            href: `/approvals`,
          })),
        ...(allMovements as any[])
          .filter((m) => m.status === "pending_approval")
          .slice(0, 3)
          .map((m) => ({
            id: m.id,
            type: "movement" as const,
            name: m.name || `Movimentação #${String(m.id).slice(0, 6)}`,
            eventName: m.events?.[0]?.name ?? undefined,
            requesterName: undefined,
            createdAt: m.createdAt,
            href: `/movements/${m.id}`,
          })),
      ].slice(0, 6);

      // ── Active operations ──
      const activeMovementsList = (allMovements as any[])
        .filter((m) => ["in_progress", "paused"].includes(m.status))
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          name: m.name || `Movimentação #${String(m.id).slice(0, 6)}`,
          status: m.status,
          eventName: m.events?.[0]?.name ?? undefined,
          href: `/movements/${m.id}`,
        }));

      const activeLoadingOrdersList = (allLoadingOrders as any[])
        .filter((lo) =>
          ["in_progress", "approved", "ready"].includes(lo.status)
        )
        .slice(0, 5)
        .map((lo) => ({
          id: lo.id,
          name: lo.orderNumber || `Ordem #${String(lo.id).slice(0, 6)}`,
          status: lo.status,
          eventName: lo.event?.name ?? undefined,
          loadedItems: lo.loadedItems ?? 0,
          totalItems: lo.totalItems ?? 0,
          href: `/loading-orders/${lo.id}`,
        }));

      const inProgressTrips = (allTrips as any[])
        .filter((t) =>
          ["loading", "loaded", "in_transit", "at_destination", "unloading"].includes(
            t.status
          )
        )
        .concat(
          (allTrips as any[]).filter(
            (t) =>
              t.status === "planned" &&
              t.loadingStartTime &&
              new Date(t.loadingStartTime) <= in7days
          )
        )
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          description: t.description ?? "",
          status: t.status,
          eventName: t.event?.name ?? undefined,
          driverName: t.driver?.name ?? undefined,
          vehicleTypeName: t.vehicleType?.name ?? undefined,
          loadingStartTime: t.loadingStartTime ?? undefined,
          href: "/trips",
        }));

      // ── Upcoming schedule (next 7 days) ──
      const schedule: any[] = [];
      for (const ev of allEvents) {
        if (ev.eventDate) {
          const d = new Date(ev.eventDate);
          if (d >= now && d <= in7days) {
            schedule.push({
              date: ev.eventDate,
              type: "event",
              name: ev.name,
              status: ev.status,
              href: "/events",
            });
          }
        }
      }
      for (const t of allTrips as any[]) {
        if (t.loadingStartTime) {
          const d = new Date(t.loadingStartTime);
          if (d >= now && d <= in7days) {
            schedule.push({
              date: t.loadingStartTime,
              type: "trip_loading",
              name: t.description || t.event?.name || "Carregamento",
              status: t.status,
              href: "/trips",
            });
          }
        }
        if (t.unloadingStartTime) {
          const d = new Date(t.unloadingStartTime);
          if (d >= now && d <= in7days) {
            schedule.push({
              date: t.unloadingStartTime,
              type: "trip_unloading",
              name: t.description || t.event?.name || "Descarregamento",
              status: t.status,
              href: "/trips",
            });
          }
        }
      }
      schedule.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // ── Critical stock ──
      const criticalStock = allProducts
        .filter(
          (p) =>
            p.minimumStock != null &&
            p.currentStock != null &&
            p.currentStock < p.minimumStock
        )
        .slice(0, 8)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          currentStock: p.currentStock ?? 0,
          minimumStock: p.minimumStock ?? 0,
          unit: p.unit || "un",
          href: "/products",
        }));

      res.json({
        kpis: {
          upcomingEvents,
          pendingRequests,
          actionableOrders,
          activeMovements,
          lowStockItems,
          upcomingTrips,
        },
        alerts,
        pendingApprovals,
        activeOperations: {
          movements: activeMovementsList,
          loadingOrders: activeLoadingOrdersList,
          trips: inProgressTrips,
        },
        upcomingSchedule: schedule.slice(0, 20),
        criticalStock,
      });
    } catch (error) {
      console.error("Dashboard summary error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  // Calendar
  app.get("/api/calendar/operational", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, types, statuses, eventId } = req.query;

      const now = new Date();
      const start = startDate
        ? new Date(startDate as string)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endDate
        ? new Date(endDate as string)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Limit to 90-day range
      const maxEnd = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
      const effectiveEnd = end > maxEnd ? maxEnd : end;

      const typeFilter = types ? (types as string).split(",").filter(Boolean) : [];
      const statusFilter = statuses ? (statuses as string).split(",").filter(Boolean) : [];
      const eventFilter = eventId as string | undefined;

      const [allEvents, allTrips, allLoadingOrders, allMovements] = await Promise.all([
        storage.getEvents(),
        storage.getTrips(),
        storage.getLoadingOrders(),
        storage.getMovements(),
      ]);

      interface CalItem {
        id: string;
        type: string;
        title: string;
        subtitle?: string;
        start: string;
        end?: string;
        status: string;
        severity?: string;
        entityId: string;
        route: string;
        metadata?: Record<string, unknown>;
      }

      const items: CalItem[] = [];

      const inRange = (d: Date | null | undefined): boolean => {
        if (!d) return false;
        return d >= start && d <= effectiveEnd;
      };
      const wantType = (t: string): boolean =>
        !typeFilter.length || typeFilter.includes(t);
      const wantStatus = (s: string): boolean =>
        !statusFilter.length || statusFilter.includes(s);

      // ── Events ─────────────────────────────────────────
      for (const ev of allEvents as any[]) {
        if (eventFilter && ev.id !== eventFilter) continue;
        const eventDate = ev.eventDate ? new Date(ev.eventDate) : null;
        const setupDate = ev.setupDate ? new Date(ev.setupDate) : null;
        const teardownDate = ev.teardownDate ? new Date(ev.teardownDate) : null;
        const winStart = ev.requestWindowStart ? new Date(ev.requestWindowStart) : null;
        const winEnd = ev.requestWindowEnd ? new Date(ev.requestWindowEnd) : null;

        if (wantType("event") && wantStatus(ev.status) && inRange(eventDate)) {
          items.push({
            id: `event-${ev.id}`,
            type: "event",
            title: ev.name,
            subtitle: `${ev.client}${ev.location ? " • " + ev.location : ""}`,
            start: eventDate!.toISOString(),
            status: ev.status,
            entityId: ev.id,
            route: `/events/${ev.id}`,
            metadata: { client: ev.client, location: ev.location },
          });
        }
        if (wantType("event_setup") && wantStatus(ev.status) && inRange(setupDate)) {
          items.push({
            id: `event_setup-${ev.id}`,
            type: "event_setup",
            title: `Montagem: ${ev.name}`,
            subtitle: ev.client,
            start: setupDate!.toISOString(),
            status: ev.status,
            entityId: ev.id,
            route: `/events/${ev.id}`,
            metadata: { location: ev.location },
          });
        }
        const teardownDiffersFromEvent =
          teardownDate && eventDate
            ? teardownDate.toDateString() !== eventDate.toDateString()
            : !!teardownDate;
        if (wantType("event_teardown") && wantStatus(ev.status) && inRange(teardownDate) && teardownDiffersFromEvent) {
          items.push({
            id: `event_teardown-${ev.id}`,
            type: "event_teardown",
            title: `Desmontagem: ${ev.name}`,
            subtitle: ev.client,
            start: teardownDate!.toISOString(),
            status: ev.status,
            entityId: ev.id,
            route: `/events/${ev.id}`,
            metadata: { location: ev.location },
          });
        }
        if (wantType("request_window") && inRange(winStart)) {
          items.push({
            id: `req_win_start-${ev.id}`,
            type: "request_window_start",
            title: `Janela abre: ${ev.name}`,
            subtitle: "Início da janela de requisição",
            start: winStart!.toISOString(),
            status: "opening",
            entityId: ev.id,
            route: `/events/${ev.id}`,
            metadata: {},
          });
        }
        if (wantType("request_window") && inRange(winEnd)) {
          items.push({
            id: `req_win_end-${ev.id}`,
            type: "request_window_end",
            title: `Janela fecha: ${ev.name}`,
            subtitle: "Fim da janela de requisição",
            start: winEnd!.toISOString(),
            status: "closing",
            severity: "warning",
            entityId: ev.id,
            route: `/events/${ev.id}`,
            metadata: {},
          });
        }
      }

      // ── Trips ──────────────────────────────────────────
      if (wantType("trip")) {
        for (const trip of allTrips as any[]) {
          if (eventFilter && trip.eventId !== eventFilter) continue;
          if (!wantStatus(trip.status)) continue;
          // Use correct Drizzle camelCase field names (loadingDate does not exist)
          const loadDate = trip.loadingStartTime ? new Date(trip.loadingStartTime) : null;
          const unloadDate = trip.unloadingStartTime ? new Date(trip.unloadingStartTime) : null;
          const label = trip.description || trip.event?.name || "Viagem";
          const routeLabel = [trip.loadingLocation, trip.unloadingLocation].filter(Boolean).join(" → ");
          const meta = {
            driver: trip.driver?.name,
            vehicleType: trip.vehicleType?.name,
            plate: trip.vehicle?.plate,
            // All key timestamps so the client can show saída/chegada
            loadingStartTime: trip.loadingStartTime ?? null,
            loadingEndTime: trip.loadingEndTime ?? null,
            departureDateTime: trip.departureDateTime ?? null,
            unloadingStartTime: trip.unloadingStartTime ?? null,
            unloadingEndTime: trip.unloadingEndTime ?? null,
            loadingLocation: trip.loadingLocation ?? null,
            unloadingLocation: trip.unloadingLocation ?? null,
          };
          if (inRange(loadDate)) {
            items.push({
              id: `trip_loading-${trip.id}`,
              type: "trip_loading",
              title: `Carregamento: ${label}`,
              subtitle: routeLabel || trip.vehicleType?.name,
              start: loadDate!.toISOString(),
              status: trip.status,
              entityId: trip.id,
              route: `/trips`,
              metadata: meta,
            });
          }
          if (inRange(unloadDate)) {
            items.push({
              id: `trip_unloading-${trip.id}`,
              type: "trip_unloading",
              title: `Descarregamento: ${label}`,
              subtitle: routeLabel || trip.vehicleType?.name,
              start: unloadDate!.toISOString(),
              status: trip.status,
              entityId: trip.id,
              route: `/trips`,
              metadata: meta,
            });
          }
          // Also show trip by departureDateTime if it falls in range and was not already covered
          if (trip.departureDateTime) {
            const depDate = new Date(trip.departureDateTime);
            const depDateStr = depDate.toISOString().slice(0, 10);
            const loadDateStr = loadDate ? loadDate.toISOString().slice(0, 10) : null;
            if (inRange(depDate) && depDateStr !== loadDateStr) {
              items.push({
                id: `trip_departure-${trip.id}`,
                type: "trip_departure",
                title: `Saída: ${label}`,
                subtitle: routeLabel || trip.vehicleType?.name,
                start: depDate.toISOString(),
                status: trip.status,
                entityId: trip.id,
                route: `/trips`,
                metadata: meta,
              });
            }
          }
        }
      }

      // ── Loading Orders ──────────────────────────────────
      if (wantType("loading_order")) {
        for (const lo of allLoadingOrders as any[]) {
          if (eventFilter && lo.eventId !== eventFilter) continue;
          if (!wantStatus(lo.status)) continue;
          const pStart = lo.plannedStartTime ? new Date(lo.plannedStartTime) : null;
          const pEnd = lo.plannedEndTime ? new Date(lo.plannedEndTime) : null;
          if (inRange(pStart)) {
            items.push({
              id: `loading_order-${lo.id}`,
              type: "loading_order",
              title: lo.name || `Ordem ${lo.code || lo.id.slice(-6)}`,
              subtitle: lo.event?.name,
              start: pStart!.toISOString(),
              end: pEnd?.toISOString(),
              status: lo.status,
              entityId: lo.id,
              route: `/loading-orders/${lo.id}`,
              metadata: { code: lo.code },
            });
          }
        }
      }

      // ── Movements ───────────────────────────────────────
      if (wantType("movement")) {
        for (const mov of allMovements as any[]) {
          if (!wantStatus(mov.status)) continue;
          const movEvents = Array.isArray(mov.events) ? mov.events : [];
          if (eventFilter && !movEvents.some((e: any) => e?.id === eventFilter)) continue;
          const movDate = mov.updatedAt
            ? new Date(mov.updatedAt)
            : mov.createdAt
            ? new Date(mov.createdAt)
            : null;
          if (inRange(movDate)) {
            items.push({
              id: `movement-${mov.id}`,
              type: "movement",
              title: mov.movementType?.name || "Movimentação",
              subtitle: mov.description,
              start: movDate!.toISOString(),
              status: mov.status,
              severity: mov.status === "paused" ? "warning" : undefined,
              entityId: mov.id,
              route: `/movements/${mov.id}`,
              metadata: { description: mov.description },
            });
          }
        }
      }

      items.sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );

      res.json({ items });
    } catch (error) {
      console.error("[calendar/operational] error:", error);
      res.status(500).json({ error: "Failed to fetch calendar data" });
    }
  });

  // Events
  app.get("/api/events", requireAuth, async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", requireAuth, async (req, res) => {
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

  app.get("/api/events/:id/overview", requireAuth, async (req, res) => {
    try {
      const eventId = req.params.id;
      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const [allRequests, allLoadingOrders, allTrips, allMovements] = await Promise.all([
        storage.getMaterialRequests(),
        storage.getLoadingOrders(),
        storage.getTrips(),
        storage.getMovements(),
      ]);

      const requests = (allRequests as any[]).filter((r) => r.eventId === eventId);
      const loadingOrders = (allLoadingOrders as any[]).filter((lo) => lo.eventId === eventId);
      const eventTrips = (allTrips as any[]).filter((t) => t.eventId === eventId);
      const eventMovements = (allMovements as any[]).filter((m) =>
        Array.isArray(m.events) && m.events.some((e: any) => e && e.id === eventId)
      );

      const requestsSummary = {
        total: requests.length,
        draft: requests.filter((r) => r.status === "draft").length,
        pending: requests.filter((r) => r.status === "pending_approval").length,
        approved: requests.filter((r) => ["approved", "partial_approval"].includes(r.status)).length,
        rejected: requests.filter((r) => r.status === "rejected").length,
      };
      const loadingOrdersSummary = {
        total: loadingOrders.length,
        draft: loadingOrders.filter((lo) => lo.status === "draft").length,
        ready: loadingOrders.filter((lo) => lo.status === "ready").length,
        approved: loadingOrders.filter((lo) => lo.status === "approved").length,
        inProgress: loadingOrders.filter((lo) => lo.status === "in_progress").length,
        completed: loadingOrders.filter((lo) => lo.status === "completed").length,
      };
      const tripsSummary = {
        total: eventTrips.length,
        planned: eventTrips.filter((t) => t.status === "planned").length,
        inProgress: eventTrips.filter((t) =>
          ["loading", "loaded", "in_transit", "at_destination", "unloading"].includes(t.status)
        ).length,
        completed: eventTrips.filter((t) => t.status === "completed").length,
      };
      const movementsSummary = {
        total: eventMovements.length,
        inProgress: eventMovements.filter((m) => m.status === "in_progress").length,
        paused: eventMovements.filter((m) => m.status === "paused").length,
        completed: eventMovements.filter((m) => m.status === "completed").length,
        pendingApproval: eventMovements.filter((m) => m.status === "pending_approval").length,
      };

      const now = new Date();
      const eventDate = event.eventDate ? new Date(event.eventDate) : null;
      const daysToEvent = eventDate
        ? Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const alerts: Array<{ severity: string; message: string; type: string }> = [];
      if (requestsSummary.pending > 0)
        alerts.push({ severity: "warning", message: `${requestsSummary.pending} requisição(ões) aguardam aprovação`, type: "pending_requests" });
      if (movementsSummary.paused > 0)
        alerts.push({ severity: "warning", message: `${movementsSummary.paused} movimentação(ões) pausada(s)`, type: "paused_movements" });
      if (daysToEvent !== null && daysToEvent > 0 && daysToEvent <= 7 && eventTrips.length === 0)
        alerts.push({ severity: "critical", message: `Evento em ${daysToEvent} dia(s) sem viagem planejada`, type: "no_trips" });
      if (daysToEvent !== null && daysToEvent > 0 && daysToEvent <= 7 && loadingOrders.length === 0)
        alerts.push({ severity: "warning", message: `Evento em ${daysToEvent} dia(s) sem ordem de carregamento`, type: "no_loading_orders" });
      const tripsWithoutDriver = eventTrips.filter((t) => !t.driverId).length;
      if (tripsWithoutDriver > 0)
        alerts.push({ severity: "info", message: `${tripsWithoutDriver} viagem(ns) sem motorista definido`, type: "trips_no_driver" });

      const windowStart = event.requestWindowStart ? new Date(event.requestWindowStart) : null;
      const windowEnd = event.requestWindowEnd ? new Date(event.requestWindowEnd) : null;
      let windowStatus: "open" | "future" | "closed" | "none" = "none";
      if (windowStart || windowEnd) {
        if (windowStart && now < windowStart) windowStatus = "future";
        else if (windowEnd && now > windowEnd) windowStatus = "closed";
        else windowStatus = "open";
      }
      if (windowEnd) {
        const hoursToClose = (windowEnd.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursToClose > 0 && hoursToClose <= 48)
          alerts.push({ severity: "warning", message: `Janela de requisição encerra em ${Math.ceil(hoursToClose)}h`, type: "window_closing" });
      }
      if (windowStatus === "closed" && requestsSummary.approved === 0 && requestsSummary.total > 0)
        alerts.push({ severity: "warning", message: "Janela encerrada sem requisições aprovadas", type: "window_closed_no_approvals" });

      res.json({
        event,
        windowStatus,
        daysToEvent,
        requestsSummary,
        requests: requests.slice(0, 10),
        loadingOrdersSummary,
        loadingOrders: loadingOrders.slice(0, 10),
        tripsSummary,
        trips: eventTrips.slice(0, 10),
        movementsSummary,
        movements: eventMovements.slice(0, 10),
        alerts,
      });
    } catch (error) {
      console.error("[events/overview] error:", error);
      res.status(500).json({ error: "Failed to fetch event overview" });
    }
  });

  app.get("/api/events/:id/materials-summary", requireAuth, async (req, res) => {
    try {
      const eventId = req.params.id;
      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const calcKitLineQty = (
        formula: string,
        multiplier: number,
        parameters: Record<string, number>,
        productId: string,
      ): number => {
        const f = (formula ?? "").trim();
        if (f === "?") {
          // Parâmetros variáveis representam o total absoluto informado pelo usuário,
          // não uma quantidade por kit — portanto NÃO se multiplica pelo nº de kits.
          return Math.max(0, Math.round(parameters[productId] ?? 0));
        }
        try {
          let expr = f;
          for (const [name, val] of Object.entries(parameters || {})) {
            expr = expr.replace(new RegExp(`\\b${name}\\b`, "g"), String(val));
          }
          const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, "");
          if (sanitized !== expr) return 0;
          const result = Function('"use strict"; return (' + sanitized + ")")() as number;
          const total = result * multiplier;
          if (!Number.isFinite(total)) return 0;
          return Math.max(0, Math.round(total));
        } catch {
          return 0;
        }
      };

      const numVal = (v: any): number => {
        const n = typeof v === "string" ? parseFloat(v) : Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      const hasWeightFn = (raw: any): boolean =>
        raw !== null && raw !== undefined && numVal(raw) > 0;

      const allRequests = (await storage.getMaterialRequests()) as any[];
      const requests = allRequests.filter(
        (r) => r.eventId === eventId && r.status !== "rejected",
      );
      const pendingCount = requests.filter((r) => r.status === "pending_approval").length;
      const approvedCount = requests.filter((r) => r.status === "approved").length;

      const [products, kits] = await Promise.all([
        storage.getProducts(),
        storage.getKits(),
      ]);
      const productMap = new Map(products.map((p) => [p.id, p]));
      const kitMap = new Map(kits.map((k) => [k.id, k]));
      const requestMap = new Map(requests.map((r) => [r.id, r]));
      const bomCache = new Map<string, any[]>();
      const getBom = async (kitId: string) => {
        if (!bomCache.has(kitId)) {
          bomCache.set(kitId, await storage.getBomLinesByKit(kitId));
        }
        return bomCache.get(kitId)!;
      };

      // Pieces aggregation
      const pieces = new Map<string, {
        productId: string; sku: string; name: string; unit: string;
        category: string | null; ownership: string; location: string | null;
        weight: number; hasWeight: boolean;
        quantity: number; fromKits: number; direct: number;
        totalWeight: number | null;
      }>();

      const kitSummary = new Map<string, { kitId: string; name: string; quantity: number; requestCount: number }>();
      const kitRequestSeen = new Map<string, Set<string>>();
      const kitComponentTotals = new Map<string, Map<string, number>>();
      const kitRequestBreakdown = new Map<string, Array<{
        requestId: string; area: string | null; requestedByName: string; status: string; quantity: number;
      }>>();

      const addPiece = (productId: string, qty: number, source: "direct" | "kit") => {
        if (qty <= 0) return;
        const p = productMap.get(productId);
        const rawWeight = p?.weight;
        const weight = numVal(rawWeight);
        const hw = hasWeightFn(rawWeight);
        const existing = pieces.get(productId) ?? {
          productId,
          sku: p?.sku ?? "—",
          name: p?.name ?? "Produto removido",
          unit: p?.unit ?? "unid",
          category: p?.category?.trim() ? p.category.trim() : null,
          ownership: p?.ownership ?? "owned",
          location: p?.location ?? null,
          weight,
          hasWeight: hw,
          quantity: 0,
          fromKits: 0,
          direct: 0,
          totalWeight: null as number | null,
        };
        existing.quantity += qty;
        if (source === "kit") existing.fromKits += qty;
        else existing.direct += qty;
        existing.totalWeight = existing.hasWeight
          ? Math.round(existing.quantity * existing.weight * 100) / 100
          : null;
        pieces.set(productId, existing);
      };

      const allItems = (await storage.getRequestItemsByRequestIds(
        requests.map((r) => r.id),
      )) as any[];

      const referencedKitIds = Array.from(
        new Set(allItems.filter((it) => it.kitId).map((it) => it.kitId as string)),
      );
      await Promise.all(referencedKitIds.map((kitId) => getBom(kitId)));

      const itemsByRequest = new Map<string, any[]>();
      for (const it of allItems) {
        const arr = itemsByRequest.get(it.requestId) ?? [];
        arr.push(it);
        itemsByRequest.set(it.requestId, arr);
      }

      for (const it of allItems) {
        const qty = it.quantity ?? 0;
        const r = requestMap.get(it.requestId);
        if (it.productId && !it.kitId) {
          addPiece(it.productId, qty, "direct");
        } else if (it.kitId) {
          const k = kitMap.get(it.kitId);
          const ks = kitSummary.get(it.kitId) ?? {
            kitId: it.kitId,
            name: k?.name ?? "Kit removido",
            quantity: 0,
            requestCount: 0,
          };
          ks.quantity += qty;
          const seen = kitRequestSeen.get(it.kitId) ?? new Set<string>();
          if (!seen.has(it.requestId)) {
            seen.add(it.requestId);
            ks.requestCount += 1;
            kitRequestSeen.set(it.kitId, seen);
            const bd = kitRequestBreakdown.get(it.kitId) ?? [];
            bd.push({
              requestId: it.requestId,
              area: r?.area ?? null,
              requestedByName: r?.requestedByUser?.name ?? r?.requestedByUser?.username ?? "—",
              status: r?.status ?? "—",
              quantity: qty,
            });
            kitRequestBreakdown.set(it.kitId, bd);
          } else {
            const bd = kitRequestBreakdown.get(it.kitId) ?? [];
            const entry = bd.find((b) => b.requestId === it.requestId);
            if (entry) entry.quantity += qty;
          }
          kitSummary.set(it.kitId, ks);

          const bom = bomCache.get(it.kitId) ?? [];
          const params = (it.kitParameters as Record<string, number>) ?? {};
          const kitCompMap = kitComponentTotals.get(it.kitId) ?? new Map<string, number>();
          for (const line of bom) {
            const lineQty = calcKitLineQty(line.quantityFormula, qty, params, line.productId);
            addPiece(line.productId, lineQty, "kit");
            kitCompMap.set(line.productId, (kitCompMap.get(line.productId) ?? 0) + lineQty);
          }
          kitComponentTotals.set(it.kitId, kitCompMap);
        }
      }

      const piecesArr = Array.from(pieces.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      );
      const kitsArr = Array.from(kitSummary.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      );

      // Enrich kits with components and request breakdown
      const kitsEnriched = kitsArr.map((ks) => {
        const bom = bomCache.get(ks.kitId) ?? [];
        const kitCompMap = kitComponentTotals.get(ks.kitId) ?? new Map<string, number>();
        const components = bom.map((line: any) => {
          const cp = productMap.get(line.productId);
          const rawW = cp?.weight;
          const w = numVal(rawW);
          const hw = hasWeightFn(rawW);
          const total = kitCompMap.get(line.productId) ?? 0;
          const f = (line.quantityFormula ?? "").trim();
          let quantityPerKit: number | null = null;
          if (f !== "?" && f !== "") {
            try {
              const sanitized = f.replace(/[^0-9+\-*/().\s]/g, "");
              if (sanitized === f) {
                const result = Function('"use strict"; return (' + sanitized + ")")() as number;
                if (Number.isFinite(result)) quantityPerKit = Math.round(result);
              }
            } catch {}
          }
          return {
            productId: line.productId,
            name: cp?.name ?? "Produto removido",
            sku: cp?.sku ?? "—",
            unit: cp?.unit ?? "unid",
            formulaDisplay: f === "?" ? "variável" : (f || "—"),
            quantityPerKit,
            totalGenerated: total,
            hasWeight: hw,
            weight: w,
            totalWeight: hw ? Math.round(total * w * 100) / 100 : null,
          };
        });
        return {
          ...ks,
          totalUnitsGenerated: components.reduce((s: number, c: any) => s + c.totalGenerated, 0),
          weightEstimate: Math.round(
            components.filter((c: any) => c.hasWeight).reduce((s: number, c: any) => s + (c.totalWeight ?? 0), 0) * 100
          ) / 100,
          components,
          requestBreakdown: kitRequestBreakdown.get(ks.kitId) ?? [],
        };
      });

      // Category breakdown with weight and participation
      const totalPiecesAll = piecesArr.reduce((s, p) => s + p.quantity, 0);
      const categoryMap = new Map<string, {
        category: string; distinctProducts: number; totalPieces: number;
        weight: number; piecesWithoutWeight: number;
      }>();
      for (const p of piecesArr) {
        const cat = p.category?.trim() ? p.category.trim() : "Sem categoria";
        const c = categoryMap.get(cat) ?? {
          category: cat, distinctProducts: 0, totalPieces: 0, weight: 0, piecesWithoutWeight: 0,
        };
        c.distinctProducts += 1;
        c.totalPieces += p.quantity;
        if (p.hasWeight) c.weight += p.totalWeight as number;
        else c.piecesWithoutWeight += 1;
        categoryMap.set(cat, c);
      }
      const categories = Array.from(categoryMap.values())
        .map((c) => ({
          ...c,
          weight: Math.round(c.weight * 100) / 100,
          participation: totalPiecesAll > 0
            ? Math.round((c.totalPieces / totalPiecesAll) * 1000) / 10
            : 0,
        }))
        .sort((a, b) => b.totalPieces - a.totalPieces);

      // Request detail with stats and sorting by priority
      const STATUS_PRIORITY: Record<string, number> = { pending_approval: 0, approved: 1 };
      const requestsDetail = requests
        .map((r) => {
          const items = (itemsByRequest.get(r.id) ?? []).map((it) => {
            if (it.kitId && !it.productId) {
              const k = kitMap.get(it.kitId);
              const bom = bomCache.get(it.kitId) ?? [];
              const params = (it.kitParameters as Record<string, number>) ?? {};
              return {
                type: "kit" as const,
                id: it.id,
                kitId: it.kitId as string,
                name: k?.name ?? "Kit removido",
                quantity: it.quantity ?? 0,
                notes: it.notes ?? null,
                components: bom.map((line: any) => {
                  const cp = productMap.get(line.productId);
                  return {
                    productId: line.productId,
                    name: cp?.name ?? "Produto removido",
                    sku: cp?.sku ?? "—",
                    unit: cp?.unit ?? "unid",
                    quantity: calcKitLineQty(line.quantityFormula, it.quantity ?? 0, params, line.productId),
                  };
                }),
              };
            }
            const p = productMap.get(it.productId);
            return {
              type: "product" as const,
              id: it.id,
              productId: it.productId as string,
              name: p?.name ?? "Produto removido",
              sku: p?.sku ?? "—",
              unit: p?.unit ?? "unid",
              quantity: it.quantity ?? 0,
              notes: it.notes ?? null,
            };
          });

          let unitCount = 0;
          let kitCount = 0;
          let weightEstimate = 0;
          for (const it of items) {
            if (it.type === "product") {
              unitCount += it.quantity;
              const p = productMap.get(it.productId);
              if (hasWeightFn(p?.weight)) weightEstimate += it.quantity * numVal(p?.weight);
            } else {
              kitCount += it.quantity;
              for (const c of it.components) {
                unitCount += c.quantity;
                const cp = productMap.get(c.productId);
                if (hasWeightFn(cp?.weight)) weightEstimate += c.quantity * numVal(cp?.weight);
              }
            }
          }

          return {
            id: r.id,
            area: r.area,
            status: r.status,
            requestedByName: r.requestedByUser?.name ?? r.requestedByUser?.username ?? "—",
            createdAt: r.createdAt,
            itemCount: items.length,
            unitCount,
            kitCount,
            weightEstimate: Math.round(weightEstimate * 100) / 100,
            items,
          };
        })
        .sort((a, b) => {
          const pa = STATUS_PRIORITY[a.status] ?? 9;
          const pb = STATUS_PRIORITY[b.status] ?? 9;
          if (pa !== pb) return pa - pb;
          return (a.area || "").localeCompare(b.area || "", "pt-BR");
        });

      const piecesWithoutWeight = piecesArr.filter((p) => !p.hasWeight).length;

      res.json({
        calculatedAt: new Date().toISOString(),
        eventId,
        event: { id: event.id, name: event.name, client: event.client, location: event.location, eventDate: event.eventDate },
        requestCount: requests.length,
        pendingCount,
        approvedCount,
        totals: {
          distinctProducts: piecesArr.length,
          totalPieces: totalPiecesAll,
          distinctKits: kitsArr.length,
          totalKits: kitsArr.reduce((s, k) => s + k.quantity, 0),
          totalWeight: Math.round(
            piecesArr.filter((p) => p.hasWeight).reduce((s, p) => s + (p.totalWeight as number), 0) * 100
          ) / 100,
          weightKnownCount: piecesArr.length - piecesWithoutWeight,
          piecesWithoutWeight,
        },
        categories,
        pieces: piecesArr,
        kits: kitsEnriched,
        requests: requestsDetail,
      });
    } catch (error) {
      console.error("[events/materials-summary] error:", error);
      res.status(500).json({ error: "Failed to fetch materials summary" });
    }
  });

  // ── Event movements summary ────────────────────────────────────────────────
  app.get("/api/events/:id/movements-summary", requireAuth, async (req, res) => {
    try {
      const eventId = req.params.id;
      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ error: "Event not found" });

      // Fetch per-product movement totals for this event (junction + legacy eventId)
      const rows = await db.execute(sql`
        SELECT
          p.id            AS product_id,
          p.name,
          p.sku,
          p.unit,
          COALESCE(mtc.nature, 'outbound') AS nature,
          m.status,
          m.id            AS movement_id,
          m.movement_number,
          SUM(mi.quantity)::int AS qty
        FROM movements m
        JOIN movement_items mi ON mi.movement_id = m.id
        JOIN products p        ON p.id = mi.product_id
        LEFT JOIN movement_types_config mtc ON mtc.id = m.movement_type_config_id
        WHERE (
          m.id IN (SELECT movement_id FROM movement_events WHERE event_id = ${eventId})
          OR m.event_id = ${eventId}
        )
        AND m.status NOT IN ('cancelled', 'created')
        GROUP BY p.id, p.name, p.sku, p.unit, mtc.nature, m.status, m.id, m.movement_number
        ORDER BY p.name
      `);

      // Aggregate by product
      type ProductEntry = {
        productId: string; name: string; sku: string; unit: string;
        outbound: number; inbound: number;
        movements: Array<{ id: string; number: string; status: string; nature: string; qty: number }>;
      };
      const byProduct = new Map<string, ProductEntry>();
      for (const r of rows.rows as any[]) {
        let entry = byProduct.get(r.product_id);
        if (!entry) {
          entry = { productId: r.product_id, name: r.name, sku: r.sku, unit: r.unit, outbound: 0, inbound: 0, movements: [] };
          byProduct.set(r.product_id, entry);
        }
        const qty = Number(r.qty ?? 0);
        if (r.nature === "inbound") entry.inbound += qty;
        else if (r.nature === "outbound") entry.outbound += qty;
        entry.movements.push({ id: r.movement_id, number: r.movement_number, status: r.status, nature: r.nature, qty });
      }

      const products = Array.from(byProduct.values()).map((p) => ({
        ...p,
        balance: p.outbound - p.inbound,
      }));

      return res.json({
        eventId,
        products,
        totals: {
          outbound: products.reduce((s, p) => s + p.outbound, 0),
          inbound: products.reduce((s, p) => s + p.inbound, 0),
          balance: products.reduce((s, p) => s + p.balance, 0),
          distinctProducts: products.length,
        },
      });
    } catch (error) {
      console.error("[events/movements-summary] error:", error);
      res.status(500).json({ error: "Failed to fetch movements summary" });
    }
  });

  // ── Event Movements Dashboard ─────────────────────────────────────────────────
  app.get("/api/events/:id/movements-dashboard", requireAuth, async (req, res) => {
    try {
      const eventId = req.params.id;
      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ error: "Event not found" });

      // Request count + trip count
      const [reqCount, tripCount] = await Promise.all([
        db.execute(sql`SELECT COUNT(*)::int AS c FROM material_requests WHERE event_id = ${eventId}`),
        db.execute(sql`SELECT COUNT(*)::int AS c FROM trips WHERE event_id = ${eventId}`),
      ]);

      // ── Requested per product (approved/partially_approved requests) ──────────
      const requestedRows = await db.execute(sql`
        SELECT
          ri.product_id,
          SUM(COALESCE(ri.approved_quantity, ri.quantity))::int AS requested
        FROM request_items ri
        JOIN material_requests r ON r.id = ri.request_id
        WHERE r.event_id = ${eventId}
          AND r.status::text IN ('approved', 'partially_approved', 'completed')
          AND ri.product_id IS NOT NULL
        GROUP BY ri.product_id
      `);

      // ── Movement quantities per product (outbound/inbound, completed) ─────────
      const movQtyRows = await db.execute(sql`
        SELECT
          mi.product_id,
          COALESCE(mtc.nature, 'outbound') AS nature,
          SUM(mi.quantity)::int            AS qty,
          MAX(m.completed_at)              AS last_at
        FROM movement_items mi
        JOIN movements m ON m.id = mi.movement_id
        LEFT JOIN movement_types_config mtc ON mtc.id = m.movement_type_config_id
        WHERE (
          m.event_id = ${eventId}
          OR m.id IN (SELECT movement_id FROM movement_events WHERE event_id = ${eventId})
        )
          AND m.status = 'completed'
          AND mi.product_id IS NOT NULL
        GROUP BY mi.product_id, COALESCE(mtc.nature, 'outbound')
      `);

      // ── All distinct products touched by this event ───────────────────────────
      const productIds = new Set<string>();
      for (const r of requestedRows.rows as any[]) productIds.add(r.product_id);
      for (const r of movQtyRows.rows as any[]) productIds.add(r.product_id);

      // Fetch product info in bulk
      const productRows = productIds.size > 0
        ? await db.execute(sql`
            SELECT id, name, sku, unit, ownership, category
            FROM products
            WHERE id = ANY(${Array.from(productIds)})
          `)
        : { rows: [] };

      const productMap = new Map<string, any>();
      for (const p of productRows.rows as any[]) productMap.set(p.id, p);

      // ── Product-level request IDs ─────────────────────────────────────────────
      const productRequestRows = await db.execute(sql`
        SELECT DISTINCT ri.product_id, r.id AS request_id, r.area, u.username AS requested_by_name, r.status
        FROM request_items ri
        JOIN material_requests r ON r.id = ri.request_id
        LEFT JOIN users u ON u.id = r.requested_by
        WHERE r.event_id = ${eventId}
          AND r.status::text IN ('approved', 'partially_approved', 'completed')
          AND ri.product_id IS NOT NULL

        UNION

        SELECT DISTINCT bl.product_id, r.id AS request_id, r.area, u.username AS requested_by_name, r.status
        FROM request_items ri
        JOIN material_requests r ON r.id = ri.request_id
        LEFT JOIN users u ON u.id = r.requested_by
        JOIN bom_lines bl ON bl.kit_id = ri.kit_id
        WHERE r.event_id = ${eventId}
          AND r.status::text IN ('approved', 'partially_approved', 'completed')
          AND ri.kit_id IS NOT NULL
          AND ri.product_id IS NULL
      `);
      const productRequestsMap = new Map<string, Array<{ id: string; area: string | null; requestedByName: string; status: string }>>();
      for (const r of productRequestRows.rows as any[]) {
        const arr = productRequestsMap.get(r.product_id) || [];
        arr.push({ id: r.request_id, area: r.area, requestedByName: r.requested_by_name, status: r.status });
        productRequestsMap.set(r.product_id, arr);
      }

      // ── Aggregate by product ──────────────────────────────────────────────────
      const requestedMap = new Map<string, number>();
      for (const r of requestedRows.rows as any[]) requestedMap.set(r.product_id, Number(r.requested ?? 0));

      const outboundMap = new Map<string, number>();
      const returnedMap = new Map<string, number>();
      const lastMovMap = new Map<string, Date | null>();
      for (const r of movQtyRows.rows as any[]) {
        const qty = Number(r.qty ?? 0);
        if (r.nature === "outbound") outboundMap.set(r.product_id, (outboundMap.get(r.product_id) || 0) + qty);
        else if (r.nature === "inbound") returnedMap.set(r.product_id, (returnedMap.get(r.product_id) || 0) + qty);
        const lastAt = r.last_at ? new Date(r.last_at) : null;
        const existing = lastMovMap.get(r.product_id);
        if (!existing || (lastAt && lastAt > existing)) lastMovMap.set(r.product_id, lastAt);
      }

      const calcSituation = (requested: number, outbound: number, returned: number): string => {
        if (outbound === 0 && requested === 0) return "no_movement";
        if (outbound === 0 && requested > 0) return "awaiting_exit";
        if (outbound > 0 && outbound < requested && returned === 0) return "partial_exit";
        if (outbound > 0 && returned === 0) return "in_field";
        if (returned > 0 && returned < outbound) return "partial_return";
        if (returned >= outbound && outbound > 0) return "returned";
        return "in_field";
      };

      const products = Array.from(productIds).map((productId) => {
        const info = productMap.get(productId) || { name: productId, sku: "", unit: "", ownership: null, category: null };
        const requested = requestedMap.get(productId) || 0;
        const outbound = outboundMap.get(productId) || 0;
        const returned = returnedMap.get(productId) || 0;
        const inField = Math.max(0, outbound - returned);
        const pendingExit = Math.max(0, requested - outbound);
        const pendingResolution = Math.max(0, inField);
        return {
          productId,
          name: info.name,
          sku: info.sku,
          unit: info.unit,
          ownership: info.ownership,
          category: info.category,
          requested,
          outbound,
          returned,
          inField,
          pendingExit,
          pendingResolution,
          situation: calcSituation(requested, outbound, returned),
          lastMovementAt: lastMovMap.get(productId)?.toISOString() || null,
          requests: productRequestsMap.get(productId) || [],
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      // ── Recent movements for this event ──────────────────────────────────────
      const recentMovRows = await db.execute(sql`
        SELECT
          m.id, m.movement_number, m.name, m.status, m.created_at, m.completed_at,
          COALESCE(mtc.name, m.type::text) AS type_name,
          COALESCE(mtc.nature, 'outbound')  AS nature,
          u.username                         AS created_by_name,
          COUNT(DISTINCT mi.product_id)::int AS product_count,
          COALESCE(SUM(mi.quantity),0)::int  AS total_qty
        FROM movements m
        LEFT JOIN movement_types_config mtc ON mtc.id = m.movement_type_config_id
        LEFT JOIN users u ON u.id = m.created_by
        LEFT JOIN movement_items mi ON mi.movement_id = m.id
        WHERE (
          m.event_id = ${eventId}
          OR m.id IN (SELECT movement_id FROM movement_events WHERE event_id = ${eventId})
        )
          AND m.status != 'cancelled'
        GROUP BY m.id, m.movement_number, m.name, m.status, m.created_at, m.completed_at,
                 mtc.name, m.type, mtc.nature, u.username
        ORDER BY m.created_at DESC
        LIMIT 200
      `);

      // ── Last movement date for the event ─────────────────────────────────────
      const lastMovAll = products.reduce<Date | null>((best, p) => {
        if (!p.lastMovementAt) return best;
        const d = new Date(p.lastMovementAt);
        return !best || d > best ? d : best;
      }, null);

      // ── Totals ────────────────────────────────────────────────────────────────
      const totals = products.reduce(
        (acc, p) => {
          acc.distinctProducts++;
          acc.totalRequested += p.requested;
          acc.totalOutbound += p.outbound;
          acc.totalReturned += p.returned;
          acc.totalInField += p.inField;
          acc.totalPendingExit += p.pendingExit;
          if (p.pendingResolution > 0) acc.withPendingResolution++;
          return acc;
        },
        { distinctProducts: 0, totalRequested: 0, totalOutbound: 0, totalReturned: 0, totalInField: 0, totalPendingExit: 0, withPendingResolution: 0 }
      );

      return res.json({
        event: {
          id: event.id,
          name: event.name,
          client: event.client,
          location: event.location,
          eventDate: event.eventDate,
          status: event.status,
          requestCount: Number((reqCount.rows[0] as any)?.c ?? 0),
          tripCount: Number((tripCount.rows[0] as any)?.c ?? 0),
          lastMovementAt: lastMovAll?.toISOString() || null,
          calculatedAt: new Date().toISOString(),
        },
        products,
        movements: recentMovRows.rows.map((m: any) => ({
          id: m.id,
          movementNumber: m.movement_number,
          name: m.name,
          typeName: m.type_name,
          nature: m.nature,
          status: m.status,
          productCount: Number(m.product_count),
          totalQty: Number(m.total_qty),
          createdAt: m.created_at,
          completedAt: m.completed_at,
          createdByName: m.created_by_name,
        })),
        totals,
      });
    } catch (error) {
      console.error("[events/movements-dashboard] error:", error);
      res.status(500).json({ error: "Failed to fetch event movements dashboard" });
    }
  });

  app.post("/api/events", requireAuth, requireAdmin({ message: "Apenas administradores podem criar eventos" }), async (req, res) => {
    try {
      const data = insertEventSchema.parse(req.body);
      // Date order validation
      if (data.setupDate && data.eventDate && data.setupDate > data.eventDate) {
        return res.status(422).json({ error: "Data de montagem deve ser anterior à data do evento" });
      }
      if (data.eventDate && data.teardownDate && data.eventDate > data.teardownDate) {
        return res.status(422).json({ error: "Data do evento deve ser anterior à data de desmontagem" });
      }
      if (data.requestWindowStart && data.requestWindowEnd && data.requestWindowStart > data.requestWindowEnd) {
        return res.status(422).json({ error: "Início da janela de requisição deve ser anterior ao fim" });
      }
      const event = await storage.createEvent(data);
      res.status(201).json(event);
    } catch (error) {
      res.status(400).json({ error: "Dados de evento inválidos", details: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  });

  // Same admin restriction as POST /api/events — the bulk variant must not be
  // a way around it.
  app.post("/api/events/bulk", requireAuth, requireAdmin({ message: "Apenas administradores podem criar eventos" }), async (req, res) => {
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

  app.patch("/api/events/:id", requireAuth, requireAdmin({ message: "Apenas administradores podem editar eventos" }), async (req, res) => {
    try {
      const data = insertEventSchema.partial().parse(req.body);
      // Date order validation (only when both sides present)
      if (data.setupDate && data.eventDate && data.setupDate > data.eventDate) {
        return res.status(422).json({ error: "Data de montagem deve ser anterior à data do evento" });
      }
      if (data.eventDate && data.teardownDate && data.eventDate > data.teardownDate) {
        return res.status(422).json({ error: "Data do evento deve ser anterior à data de desmontagem" });
      }
      if (data.requestWindowStart && data.requestWindowEnd && data.requestWindowStart > data.requestWindowEnd) {
        return res.status(422).json({ error: "Início da janela de requisição deve ser anterior ao fim" });
      }
      const event = await storage.updateEvent(req.params.id, data);
      res.json(event);
    } catch (error) {
      res.status(400).json({ error: "Dados de evento inválidos" });
    }
  });

  app.delete("/api/events/:id", requireAuth, requireAdmin({ message: "Apenas administradores podem excluir eventos" }), async (req, res) => {
    try {
      await storage.deleteEvent(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir evento" });
    }
  });

  // Kits
  app.get("/api/kits", requireAuth, async (req, res) => {
    try {
      const kits = await storage.getKits();
      res.json(kits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kits" });
    }
  });

  app.get("/api/kits/:id", requireAuth, async (req, res) => {
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

  app.post("/api/kits", requireAdmin({ message: "Apenas administradores podem gerenciar kits" }), async (req, res) => {
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

  app.patch("/api/kits/:id", requireAdmin({ message: "Apenas administradores podem gerenciar kits" }), async (req, res) => {
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

  app.get("/api/kits/:id/bom", requireAuth, async (req, res) => {
    try {
      const bomLines = await storage.getBomLinesByKit(req.params.id);
      res.json(bomLines);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch BOM lines" });
    }
  });

  // Suppliers
  app.get("/api/suppliers", requireAuth, async (req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  // Specific routes MUST come before generic :id route
  app.get("/api/suppliers/recent", requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const suppliers = await storage.getRecentSuppliers(limit);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching recent suppliers:", error);
      res.status(500).json({ error: "Failed to fetch recent suppliers" });
    }
  });

  app.get("/api/suppliers/:id", requireAuth, async (req, res) => {
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

  app.post("/api/suppliers", requireAdmin({ message: "Apenas administradores podem gerenciar fornecedores" }), async (req, res) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(data);
      res.status(201).json(supplier);
    } catch (error) {
      res.status(400).json({ error: "Invalid supplier data" });
    }
  });

  app.patch("/api/suppliers/:id", requireAdmin({ message: "Apenas administradores podem gerenciar fornecedores" }), async (req, res) => {
    try {
      const data = insertSupplierSchema.partial().parse(req.body);
      const supplier = await storage.updateSupplier(req.params.id, data);
      res.json(supplier);
    } catch (error) {
      res.status(400).json({ error: "Invalid supplier data" });
    }
  });

  app.delete(
    "/api/suppliers/:id",
    requireAdmin({ message: "Apenas administradores podem excluir fornecedores" }),
    async (req, res) => {
      try {
        await storage.deleteSupplier(req.params.id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting supplier:", error);
        res.status(500).json({ error: "Failed to delete supplier" });
      }
    }
  );

  // Products
  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Product Variants - specific routes MUST come before generic :id route
  app.get("/api/products/by-sku/:sku", requireAuth, async (req, res) => {
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

  app.get("/api/products/target/:sku", requireAuth, async (req, res) => {
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

  app.get("/api/products/:id", requireAuth, async (req, res) => {
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

  app.get("/api/products/:id/history", requireAuth, async (req, res) => {
    try {
      const productId = req.params.id;
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const [movementsResult, requestsResult, statsResult, reqCountResult] = await Promise.all([
        db.execute(sql`
          SELECT
            m.id,
            m.movement_number,
            m.name,
            m.status,
            m.created_at,
            m.completed_at,
            mtc.name  AS type_name,
            mtc.nature,
            SUM(mi.quantity) AS quantity,
            e.name AS event_name
          FROM movement_items mi
          JOIN movements m ON mi.movement_id = m.id
          LEFT JOIN movement_types_config mtc ON m.movement_type_config_id = mtc.id
          LEFT JOIN events e ON m.event_id = e.id
          WHERE mi.product_id = ${productId}
          GROUP BY m.id, m.movement_number, m.name, m.status, m.created_at, m.completed_at, mtc.name, mtc.nature, e.name
          ORDER BY m.created_at DESC
          LIMIT 30
        `),
        db.execute(sql`
          SELECT
            ri.id,
            ri.quantity,
            ri.approved_quantity,
            ri.approval_status,
            mr.id          AS request_id,
            mr.area        AS request_area,
            mr.status      AS request_status,
            mr.created_at,
            e.name         AS event_name,
            k.name         AS kit_name
          FROM request_items ri
          JOIN material_requests mr ON ri.request_id = mr.id
          LEFT JOIN events e ON mr.event_id = e.id
          LEFT JOIN kits k ON k.id = ri.kit_id
          WHERE (
            ri.product_id = ${productId}
            OR ri.kit_id IN (SELECT kit_id FROM bom_lines WHERE product_id = ${productId})
          )
          AND mr.status::text IN ('approved', 'partially_approved', 'completed')
          ORDER BY mr.created_at DESC
          LIMIT 20
        `),
        db.execute(sql`
          SELECT
            COUNT(DISTINCT m.id)::int AS movement_count,
            COALESCE(SUM(CASE WHEN mtc.nature = 'outbound' THEN mi.quantity ELSE 0 END), 0)::int AS total_outbound,
            COALESCE(SUM(CASE WHEN mtc.nature = 'inbound'  THEN mi.quantity ELSE 0 END), 0)::int AS total_inbound
          FROM movement_items mi
          JOIN movements m ON mi.movement_id = m.id
          LEFT JOIN movement_types_config mtc ON m.movement_type_config_id = mtc.id
          WHERE mi.product_id = ${productId}
        `),
        db.execute(sql`
          SELECT COUNT(DISTINCT ri.request_id)::int AS request_count
          FROM request_items ri
          JOIN material_requests mr ON ri.request_id = mr.id
          WHERE (
            ri.product_id = ${productId}
            OR ri.kit_id IN (SELECT kit_id FROM bom_lines WHERE product_id = ${productId})
          )
          AND mr.status::text IN ('approved', 'partially_approved', 'completed')
        `),
      ]);

      res.json({
        product,
        movements: movementsResult.rows,
        requests: requestsResult.rows,
        stats: {
          ...(statsResult.rows[0] ?? { movement_count: 0, total_outbound: 0, total_inbound: 0 }),
          request_count: (reqCountResult.rows[0] as any)?.request_count ?? 0,
        },
      });
    } catch (error) {
      console.error("Error fetching product history:", error);
      res.status(500).json({ error: "Failed to fetch product history" });
    }
  });

  app.post("/api/products", requireAdmin({ message: "Apenas administradores podem gerenciar produtos" }), async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.status(201).json(product);
    } catch (error: any) {
      if (error?.code === "23505") {
        if (error?.constraint?.includes("barcode")) {
          return res.status(409).json({ error: "Código de barras já cadastrado." });
        }
        return res.status(409).json({ error: "SKU já cadastrado." });
      }
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.post("/api/products/bulk", requireAdmin({ message: "Apenas administradores podem gerenciar produtos" }), async (req, res) => {
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

  app.patch("/api/products/:id", requireAdmin({ message: "Apenas administradores podem gerenciar produtos" }), async (req, res) => {
    try {
      const data = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, data);
      res.json(product);
    } catch (error: any) {
      if (error?.code === "23505") {
        if (error?.constraint?.includes("barcode")) {
          return res.status(409).json({ error: "Código de barras já cadastrado." });
        }
        return res.status(409).json({ error: "SKU já cadastrado." });
      }
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  // Material Requests
  app.get("/api/requests", requireAuth, async (req, res) => {
    try {
      const isUserAdmin = await isAdmin(req.user);
      if (isUserAdmin) {
        const requests = await storage.getMaterialRequests();
        res.json(requests);
      } else {
        const requests = await storage.getMaterialRequestsByUser(req.user!.id);
        res.json(requests);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  });

  app.get("/api/requests/:id", requireAuth, async (req, res) => {
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

      // Auto-insert items from template when templateId is provided
      const templateId = req.body.templateId as string | undefined;
      if (templateId) {
        const templateItems = await db
          .select()
          .from(requestAreaTemplateItems)
          .where(eq(requestAreaTemplateItems.templateId, templateId));

        for (const ti of templateItems) {
          await storage.createRequestItem({
            requestId: request.id,
            productId: ti.productId,
            quantity: 0,
          });
        }
      }

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

      const currentRequest = await storage.getMaterialRequest(req.params.id);
      if (!currentRequest) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Fully-approved requests are locked — nobody can delete them
      if (currentRequest.status === "approved") {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Requisições aprovadas não podem ser excluídas",
        });
      }

      const isUserAdmin = await isAdmin(req.user);
      if (isUserAdmin) {
        // Admins can delete any non-approved request regardless of owner
        await storage.deleteMaterialRequest(req.params.id);
        return res.status(204).send();
      }

      // Non-admins: must own the request and it must still be a draft
      if (!(await canEditResource(req.user, currentRequest.requestedBy))) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Apenas o criador pode excluir esta requisição",
        });
      }
      if (currentRequest.status !== "draft") {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Apenas rascunhos podem ser excluídos",
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
  app.get("/api/requests/:id/items", requireAuth, async (req, res) => {
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

  app.post("/api/requests/:id/items/batch", async (req, res) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });

      const parentRequest = await storage.getMaterialRequest(req.params.id);
      if (!parentRequest) return res.status(404).json({ error: "Requisição não encontrada" });
      if (!(await canEditResource(req.user, parentRequest.requestedBy))) {
        return res.status(403).json({ error: "Acesso negado", message: "Apenas o criador da requisição pode adicionar itens" });
      }
      if (parentRequest.status !== "draft") {
        return res.status(403).json({ error: "Não é possível adicionar itens a uma requisição já enviada" });
      }

      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Lista de itens inválida ou vazia" });
      }

      for (const item of items) {
        if (!item.productId && !item.kitId) return res.status(400).json({ error: "Cada item deve ter productId ou kitId" });
        const qty = parseInt(item.quantity);
        if (isNaN(qty) || qty < 1) return res.status(400).json({ error: `Quantidade inválida para item ${item.productId ?? item.kitId}` });
      }

      const existingItems = await storage.getRequestItems(req.params.id);
      const results: any[] = [];

      for (const item of items) {
        const qty = parseInt(item.quantity);
        let existing: any = null;
        if (item.kitId && !item.productId) {
          existing = (existingItems as any[]).find((e: any) => !e.productId && e.kitId === item.kitId);
        } else if (item.productId) {
          existing = (existingItems as any[]).find((e: any) => e.productId === item.productId);
        }
        if (existing) {
          const updated = await storage.updateRequestItem(existing.id, { quantity: existing.quantity + qty });
          results.push({ ...updated, action: "merged" });
        } else {
          const created = await storage.createRequestItem({
            requestId: req.params.id,
            productId: item.productId || undefined,
            quantity: qty,
            notes: item.notes || undefined,
            kitId: item.kitId || undefined,
            kitParameters: item.kitParameters ?? undefined,
          } as any);
          results.push({ ...created, action: "created" });
        }
      }

      res.status(201).json({ items: results, count: results.length });
    } catch (error) {
      console.error("Error batch creating request items:", error);
      res.status(500).json({ error: "Falha ao adicionar itens em lote" });
    }
  });

  app.patch("/api/request-items/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }

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
          message: "Apenas o criador da requisição pode editar seus itens"
        });
      }

      if (parentRequest.status !== "draft") {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Não é possível editar itens de uma requisição já enviada"
        });
      }

      const { quantity, notes, kitParameters } = req.body;
      const updateData: Partial<z.infer<typeof insertRequestItemSchema>> = {};
      if (quantity !== undefined) {
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty < 1) {
          return res.status(400).json({ error: "Quantidade deve ser maior que zero" });
        }
        updateData.quantity = qty;
      }
      if (notes !== undefined) {
        updateData.notes = notes || null;
      }
      if (kitParameters !== undefined) {
        updateData.kitParameters = kitParameters;
      }

      const updated = await storage.updateRequestItem(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating request item:", error);
      res.status(500).json({ error: "Failed to update item" });
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
  // Approval routes mirror the movement approval rules: only Admin/Supervisor
  // may decide. Previously these required nothing beyond being logged in, so a
  // requester could approve their own material request.
  const requestApproval = requireAnyRole([ROLES.ADMIN, ROLES.SUPERVISOR], {
    message: "Apenas administradores e supervisores podem aprovar ou rejeitar requisições",
  });

  app.post("/api/requests/:id/approve-all", requestApproval, async (req, res) => {
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

  app.post("/api/requests/:id/approve-partial", requestApproval, async (req, res) => {
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

  app.post("/api/requests/:id/reject-all", requestApproval, async (req, res) => {
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
  app.get("/api/vehicle-types", requireAuth, async (req, res) => {
    try {
      const vehicleTypes = await storage.getVehicleTypes();
      res.json(vehicleTypes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicle types" });
    }
  });

  app.post("/api/vehicle-types", requireAdmin({ message: "Apenas administradores podem alterar configurações do sistema" }), async (req, res) => {
    try {
      const data = insertVehicleTypeSchema.parse(req.body);
      const vehicleType = await storage.createVehicleType(data);
      res.status(201).json(vehicleType);
    } catch (error: any) {
      console.error("[vehicle-types] POST error:", error?.message ?? error);
      if (error?.name === "ZodError") {
        return res.status(422).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: error?.message || "Erro ao criar tipo de veículo" });
    }
  });

  app.patch("/api/vehicle-types/:id", requireAdmin({ message: "Apenas administradores podem alterar configurações do sistema" }), async (req, res) => {
    try {
      const data = insertVehicleTypeSchema.partial().parse(req.body);
      const vehicleType = await storage.updateVehicleType(req.params.id, data);
      res.json(vehicleType);
    } catch (error: any) {
      console.error("[vehicle-types] PATCH error:", error?.message ?? error);
      if (error?.name === "ZodError") {
        return res.status(422).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: error?.message || "Erro ao atualizar tipo de veículo" });
    }
  });

  // Vehicles
  app.get("/api/vehicles", requireAuth, async (req, res) => {
    try {
      const vehicles = await storage.getVehicles();
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.post(
    "/api/vehicles",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem cadastrar veículos",
    }),
    async (req, res) => {
      try {
        const raw = { ...req.body, plate: req.body.plate || null };
        const data = insertVehicleSchema.parse(raw);
        const vehicle = await storage.createVehicle(data);
        res.status(201).json(vehicle);
      } catch (error: any) {
        console.error("[POST /api/vehicles] error:", error);
        if (error?.name === "ZodError") {
          return res.status(422).json({ error: "Dados inválidos", details: error.errors });
        }
        if (error?.code === "23505") {
          return res.status(409).json({ error: "Já existe um veículo com essa placa." });
        }
        res.status(400).json({ error: "Erro ao criar veículo." });
      }
    }
  );

  app.patch(
    "/api/vehicles/:id",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem editar veículos",
    }),
    async (req, res) => {
      try {
        const raw = { ...req.body, ...("plate" in req.body ? { plate: req.body.plate || null } : {}) };
        const data = insertVehicleSchema.partial().parse(raw);
        const vehicle = await storage.updateVehicle(req.params.id, data);
        res.json(vehicle);
      } catch (error: any) {
        console.error("[PATCH /api/vehicles/:id] error:", error);
        if (error?.name === "ZodError") {
          return res.status(422).json({ error: "Dados inválidos", details: error.errors });
        }
        if (error?.code === "23505") {
          return res.status(409).json({ error: "Já existe um veículo com essa placa." });
        }
        res.status(400).json({ error: "Erro ao atualizar veículo." });
      }
    }
  );

  app.delete(
    "/api/vehicles/:id",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem excluir veículos",
    }),
    async (req, res) => {
      try {
        await storage.deleteVehicle(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete vehicle" });
      }
    }
  );

  // Drivers
  app.get("/api/drivers", requireAuth, async (req, res) => {
    try {
      const drivers = await storage.getDrivers();
      res.json(drivers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  app.post(
    "/api/drivers",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem cadastrar motoristas",
    }),
    async (req, res) => {
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

  app.patch(
    "/api/drivers/:id",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem editar motoristas",
    }),
    async (req, res) => {
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

  app.delete(
    "/api/drivers/:id",
    requireAdmin({ message: "Apenas administradores podem excluir motoristas" }),
    async (req, res) => {
      try {
        await storage.deleteDriver(req.params.id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting driver:", error);
        res.status(500).json({ error: "Failed to delete driver" });
      }
    }
  );

  // Upload CNH image
  app.post(
    "/api/drivers/:id/cnh-upload",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem enviar CNH",
    }),
    upload.single("file"),
    async (req, res) => {
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
  app.get("/api/docks", requireAuth, async (req, res) => {
    try {
      const docks = await storage.getDocks();
      res.json(docks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch docks" });
    }
  });

  app.post(
    "/api/docks",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem cadastrar docas",
    }),
    async (req, res) => {
      try {
        const data = insertDockSchema.parse(req.body);
        const dock = await storage.createDock(data);
        res.status(201).json(dock);
      } catch (error) {
        res.status(400).json({ error: "Invalid dock data" });
      }
    }
  );

  app.patch(
    "/api/docks/:id",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem editar docas",
    }),
    async (req, res) => {
      try {
        const data = insertDockSchema.partial().parse(req.body);
        const dock = await storage.updateDock(req.params.id, data);
        res.json(dock);
      } catch (error) {
        res.status(400).json({ error: "Invalid dock data" });
      }
    }
  );

  app.delete(
    "/api/docks/:id",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem excluir docas",
    }),
    async (req, res) => {
      try {
        await storage.deleteDock(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete dock" });
      }
    }
  );

  // Helper: convert ISO string timestamps to Date objects for trip schema parsing
  function parseTripTimestamps(data: Record<string, any>) {
    const tsFields = [
      "loadingStartTime", "loadingEndTime", "departureDateTime",
      "outboundArrivalDateTime",
      "unloadingStartTime", "unloadingEndTime",
      "returnLoadingStartTime", "returnLoadingEndTime",
      "returnDepartureDateTime", "returnArrivalDateTime",
      "returnUnloadingStartTime", "returnUnloadingEndTime",
      "scheduledStart", "scheduledEnd", "actualStart", "actualEnd",
    ];
    const result = { ...data };
    for (const field of tsFields) {
      if (typeof result[field] === "string" && result[field]) {
        result[field] = new Date(result[field]);
      } else if (result[field] === null || result[field] === "") {
        result[field] = null;
      }
    }
    return result;
  }

  // Trips
  app.get("/api/trips", requireAuth, async (req, res) => {
    try {
      const trips = await storage.getTrips();
      res.json(trips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  });

  app.get("/api/trips/:id", requireAuth, async (req, res) => {
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

  app.post(
    "/api/trips",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem criar viagens",
    }),
    async (req, res) => {
    try {
      const { destinations, ...tripData } = req.body;
      const data = insertTripSchema.parse({ ...parseTripTimestamps(tripData), createdBy: req.user!.id });
      const trip = await storage.createTrip(data);
      
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

  app.patch(
    "/api/trips/:id",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem editar viagens",
    }),
    async (req, res) => {
    try {
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
      const data = insertTripSchema.partial().parse(parseTripTimestamps(tripData));
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

  app.post(
    "/api/trips/:id/duplicate",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem duplicar viagens",
    }),
    async (req, res) => {
      try {
        const original = await storage.getTrip(req.params.id) as any;
        if (!original) return res.status(404).json({ error: "Trip not found" });
        const {
          id: _id, createdAt: _ca, updatedAt: _ua, createdBy: _cb,
          event: _ev, vehicle: _vh, vehicleType: _vt, driver: _dr, dock: _dk, destinations: _ds,
          ...rest
        } = original;
        const data = insertTripSchema.parse({
          ...rest,
          description: rest.description ? `${rest.description} (Cópia)` : "(Cópia)",
          status: "planned",
          createdBy: req.user!.id,
        });
        const newTrip = await storage.createTrip(data);
        res.status(201).json(newTrip);
      } catch (error) {
        console.error("[DUPLICATE TRIP ERROR]", error);
        res.status(500).json({ error: "Failed to duplicate trip" });
      }
    }
  );

  app.post(
    "/api/trips/bulk",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem importar viagens em massa",
    }),
    async (req, res) => {
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
  app.get("/api/loading-orders", requireAuth, async (req, res) => {
    try {
      const orders = await storage.getLoadingOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loading orders" });
    }
  });

  app.get("/api/loading-orders/:id", requireAuth, async (req, res) => {
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

  app.get("/api/loading-orders/:id/requests", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getLoadingOrderRequests(req.params.id);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loading order requests" });
    }
  });

  app.get("/api/loading-orders/:id/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getLoadingOrderItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loading order items" });
    }
  });

  app.post(
    "/api/loading-orders/:id/items",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA, ROLES.ALMOXARIFADO], {
      message: "Apenas administradores, logística ou almoxarifado podem adicionar itens à ordem",
    }),
    async (req, res) => {
    try {
      const loadingOrderId = req.params.id;
      const { insertLoadingOrderItemSchema } = await import("@shared/schema");

      const existingOrder = await storage.getLoadingOrder(loadingOrderId);
      if (!existingOrder) {
        return res.status(404).json({ error: "Ordem de carregamento não encontrada" });
      }
      if (existingOrder.status === "completed" || existingOrder.status === "cancelled") {
        return res.status(400).json({
          error: "Ordens concluídas ou canceladas não podem receber novos itens",
        });
      }

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
  app.get("/api/loading-orders/:id/trips", requireAuth, async (req, res) => {
    try {
      const trips = await storage.getLoadingOrderTrips(req.params.id);
      res.json(trips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loading order trips" });
    }
  });

  app.post(
    "/api/loading-orders/:id/trips",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem vincular viagens à ordem de carregamento",
    }),
    async (req, res) => {
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

  app.delete(
    "/api/loading-orders/:id/trips",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem desvincular viagens da ordem de carregamento",
    }),
    async (req, res) => {
    try {
      await storage.deleteLoadingOrderTrips(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete loading order trips" });
    }
  });

  // Loading Order Request Slots
  app.get("/api/loading-orders/:id/request-slots", requireAuth, async (req, res) => {
    try {
      const slots = await storage.getLoadingOrderRequestSlots(req.params.id);
      res.json(slots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch request slots" });
    }
  });

  app.patch(
    "/api/loading-orders/:id/request-slots/:requestId",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem alterar a distribuição por veículo",
    }),
    async (req, res) => {
      try {
        const { vehicleSlot } = req.body;
        if (typeof vehicleSlot !== "number" || (vehicleSlot !== 1 && vehicleSlot !== 2)) {
          return res.status(400).json({ error: "vehicleSlot must be 1 or 2" });
        }
        await storage.updateLoadingOrderRequestSlot(req.params.id, req.params.requestId, vehicleSlot);
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to update request slot" });
      }
    }
  );

  app.post(
    "/api/loading-orders",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem gerenciar ordens de carregamento",
    }),
    async (req, res) => {
    try {
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
  app.get("/api/loading-orders/:id/can-edit", requireAuth, async (req, res) => {
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

  app.patch(
    "/api/loading-orders/:id",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA], {
      message: "Apenas administradores ou logística podem gerenciar ordens de carregamento",
    }),
    async (req, res) => {
    try {
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

  app.post(
    "/api/loading-orders/:id/approve",
    requireAnyRole([ROLES.ADMIN, ROLES.SUPERVISOR], {
      message: "Apenas administradores ou supervisores podem aprovar ou desaprovar ordens de carregamento",
    }),
    async (req, res) => {
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

  app.post(
    "/api/loading-orders/:id/disapprove",
    requireAnyRole([ROLES.ADMIN, ROLES.SUPERVISOR], {
      message: "Apenas administradores ou supervisores podem aprovar ou desaprovar ordens de carregamento",
    }),
    async (req, res) => {
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

  app.post(
    "/api/loading-orders/:id/mark-ready",
    requireAnyRole([ROLES.ADMIN, ROLES.LOGISTICA, ROLES.ALMOXARIFADO], {
      message: "Apenas administradores, logística ou almoxarifado podem marcar ordem como pronta",
    }),
    async (req, res) => {
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

  app.get("/api/loading-orders/:id/movements", requireAuth, async (req, res) => {
    try {
      const movements = await storage.getMovementsByLoadingOrder(req.params.id);
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movements for loading order" });
    }
  });

  app.delete("/api/loading-orders/:id", requireAuth, requireAdmin({ message: "Apenas administradores podem excluir ordens de carregamento" }), async (req, res) => {
    try {
      await storage.deleteLoadingOrder(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir ordem de carregamento" });
    }
  });

  app.delete("/api/movements/:id", requireAuth, requireAdmin({ message: "Apenas administradores podem excluir movimentações" }), async (req, res) => {
    try {
      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movimentação não encontrada" });
      }
      await storage.deleteMovement(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir movimentação" });
    }
  });

  // Movements
  app.get("/api/movements", requireAuth, async (req, res) => {
    try {
      const movements = await storage.getMovements();
      res.json(movements);
    } catch (error) {
      console.error("Failed to fetch movements:", error);
      res.status(500).json({ error: "Failed to fetch movements" });
    }
  });

  // Movement Approvals - Must come BEFORE /api/movements/:id
  app.get("/api/movements/pending-approval", requireAnyRole([ROLES.ADMIN, ROLES.SUPERVISOR]), async (req, res) => {
    try {
      const pendingMovements = await storage.listPendingMovements();
      res.json(pendingMovements);
    } catch (error) {
      console.error("Failed to fetch pending movements:", error);
      res.status(500).json({ error: "Failed to fetch pending movements" });
    }
  });

  app.get("/api/movements/:id", requireAuth, async (req, res) => {
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

  app.get("/api/movements/:id/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getMovementItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch movement items" });
    }
  });

  app.post("/api/movements", requireAnyRole([ROLES.ADMIN, ROLES.ALMOXARIFADO]), async (req, res) => {
    try {

      const data = insertMovementWithEventsSchema.parse(req.body);
      const { productItems, requestIds, ...movementData } = data as any;
      
      // A movement may be linked to a loading order OR requests, never both
      if (movementData.loadingOrderId && requestIds && requestIds.length > 0) {
        return res.status(400).json({ error: "Vincule a uma ordem de carregamento OU a requisições, não a ambas." });
      }

      // Validate loading order if provided
      if (movementData.loadingOrderId) {
        const order = await storage.getLoadingOrder(movementData.loadingOrderId);
        if (!order) {
          return res.status(404).json({ error: "Loading order not found" });
        }
        if (order.status !== "approved" && order.status !== "in_progress") {
          return res.status(400).json({ error: "Loading order must be approved" });
        }
      }

      // Validate each material request if provided (alternative to loading order)
      if (requestIds && requestIds.length > 0) {
        for (const requestId of requestIds) {
          const request = await storage.getMaterialRequest(requestId);
          if (!request) {
            return res.status(404).json({ error: `Requisição não encontrada: ${requestId}` });
          }
        }
      } else if (movementData.requestId) {
        // Legacy single requestId fallback
        const request = await storage.getMaterialRequest(movementData.requestId);
        if (!request) {
          return res.status(404).json({ error: "Request not found" });
        }
      }
      
      // Validate events exist
      if (movementData.eventIds && movementData.eventIds.length > 0) {
        for (const eventId of movementData.eventIds) {
          const event = await storage.getEvent(eventId);
          if (!event) {
            return res.status(404).json({ error: `Event not found: ${eventId}` });
          }
        }
      }
      
      // Validate trips exist
      if (movementData.tripIds && movementData.tripIds.length > 0) {
        for (const tripId of movementData.tripIds) {
          const trip = await storage.getTrip(tripId);
          if (!trip) {
            return res.status(404).json({ error: `Trip not found: ${tripId}` });
          }
        }
      }

      // Validate product items if provided (supports productId or kitId)
      if (productItems && productItems.length > 0) {
        for (const item of productItems) {
          if (!item.productId && !item.kitId) {
            return res.status(400).json({ error: "Cada item deve ter productId ou kitId" });
          }
          if (item.productId) {
            const product = await storage.getProduct(item.productId);
            if (!product) {
              return res.status(404).json({ error: `Produto não encontrado: ${item.productId}` });
            }
          } else if (item.kitId) {
            const kit = await storage.getKit(item.kitId);
            if (!kit) {
              return res.status(404).json({ error: `Kit não encontrado: ${item.kitId}` });
            }
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
        ...movementData,
        requestIds,
        movementNumber,
        createdBy,
      } as any);

      // Create pre-defined product items if provided (kits are expanded via BOM)
      if (productItems && productItems.length > 0) {
        const expandKitQty = (formula: string, multiplier: number, productId: string): number => {
          const f = (formula ?? "").trim();
          if (f === "?") return 0; // variable params unknown at this stage — skip
          try {
            const sanitized = f.replace(/[^0-9+\-*/().\s]/g, "");
            if (sanitized !== f) return 0;
            const result = Function('"use strict"; return (' + sanitized + ")")() as number;
            const total = result * multiplier;
            return Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
          } catch { return 0; }
        };

        // Accumulate expanded products to merge duplicates (same productId from different kits)
        const expandedMap = new Map<string, number>();

        for (const item of productItems) {
          if (item.productId) {
            expandedMap.set(item.productId, (expandedMap.get(item.productId) ?? 0) + item.quantity);
          } else if (item.kitId) {
            const bomLines = await storage.getBomLinesByKit(item.kitId);
            for (const line of bomLines) {
              const qty = expandKitQty(line.quantityFormula, item.quantity, line.productId);
              if (qty > 0) {
                expandedMap.set(line.productId, (expandedMap.get(line.productId) ?? 0) + qty);
              }
            }
          }
        }

        for (const [productId, quantity] of Array.from(expandedMap.entries())) {
          if (quantity > 0) {
            await storage.createMovementItem({
              movementId: movement.id,
              productId,
              quantity,
              scanned: false,
            });
          }
        }
      }

      res.status(201).json(movement);
    } catch (error) {
      console.error("Movement creation error:", error);
      res.status(400).json({ error: "Invalid movement data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/movements/:id", requireAnyRole([ROLES.ADMIN, ROLES.ALMOXARIFADO]), async (req, res) => {
    try {
      const movement = await storage.getMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }

      // Ownership check: non-admin can only edit their own movements
      if (!(await canEditResource(req.user, movement.createdBy))) {
        return res.status(403).json({ 
          error: "Acesso negado",
          message: "Apenas o criador ou um administrador pode editar esta movimentação"
        });
      }

      // Block editing in_progress/completed/cancelled movements via the general PATCH route
      if (movement.status !== "created" && movement.status !== "paused") {
        return res.status(400).json({
          error: "Movimentações em andamento, concluídas ou canceladas não podem ser editadas por esta rota. Use o endpoint de alteração de status (PATCH /api/movements/:id/status) ou os endpoints específicos."
        });
      }

      const bodyRequestIds: string[] | undefined = Array.isArray(req.body.requestIds) ? req.body.requestIds : undefined;
      const data = insertMovementSchema.partial().parse(req.body);

      // Enforce loading-order/request mutual exclusivity against the resulting state
      const effectiveLoadingOrderId =
        data.loadingOrderId !== undefined ? data.loadingOrderId : movement.loadingOrderId;
      const incomingRequestIds = bodyRequestIds ?? [];
      if (effectiveLoadingOrderId && incomingRequestIds.length > 0) {
        return res.status(400).json({ error: "Vincule a uma ordem de carregamento OU a requisições, não a ambas." });
      }
      if (data.loadingOrderId) {
        const order = await storage.getLoadingOrder(data.loadingOrderId);
        if (!order) {
          return res.status(404).json({ error: "Loading order not found" });
        }
        if (order.status !== "approved" && order.status !== "in_progress") {
          return res.status(400).json({ error: "Loading order must be approved" });
        }
      }
      if (bodyRequestIds && bodyRequestIds.length > 0) {
        for (const requestId of bodyRequestIds) {
          const request = await storage.getMaterialRequest(requestId);
          if (!request) {
            return res.status(404).json({ error: `Requisição não encontrada: ${requestId}` });
          }
        }
      } else if (data.requestId) {
        const request = await storage.getMaterialRequest(data.requestId);
        if (!request) {
          return res.status(404).json({ error: "Request not found" });
        }
      }

      // Reject any status mutation via the general PATCH route — status changes
      // must go through the dedicated PATCH /api/movements/:id/status endpoint
      if (data.status !== undefined && data.status !== movement.status) {
        return res.status(400).json({
          error: "Alterações de status não são permitidas por esta rota. Use o endpoint PATCH /api/movements/:id/status.",
        });
      }

      const updated = await storage.updateMovement(req.params.id, data);

      // Update junction table for requests if requestIds was explicitly sent
      if (bodyRequestIds !== undefined) {
        await storage.updateMovementRequests(req.params.id, bodyRequestIds);
      }

      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid movement data" });
    }
  });

  app.post("/api/movements/:id/items", requireAnyRole([ROLES.ADMIN, ROLES.ALMOXARIFADO]), async (req, res) => {
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

  app.patch("/api/movements/:id/items/:itemId/decrement", requireAnyRole([ROLES.ADMIN, ROLES.ALMOXARIFADO]), async (req, res) => {
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

      // Get item details before decrement for audit log
      const movementItems = await storage.getMovementItems(req.params.id);
      const itemToDecrement = movementItems.find(item => item.id === req.params.itemId);
      const previousQuantity = itemToDecrement?.quantity ?? 1;

      const updatedItem = await storage.decrementMovementItemQuantity(req.params.itemId);
      if (!updatedItem) {
        return res.status(404).json({ error: "Item not found" });
      }

      // Create audit log for quantity decrement
      if (itemToDecrement) {
        const product = await storage.getProduct(itemToDecrement.productId);
        await storage.createMovementAuditLog({
          movementId: req.params.id,
          action: "item_quantity_changed",
          actorId: req.user?.id || null,
          actorName: req.user?.name || "Sistema",
          metadata: {
            productId: itemToDecrement.productId,
            productName: product?.name || "Unknown",
            sku: product?.sku || "",
            previousQuantity,
            newQuantity: updatedItem.quantity,
            quantityDecremented: 1,
            ownerName: itemToDecrement.ownerName || undefined,
            ownerType: itemToDecrement.ownerType || undefined,
          },
        });
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(400).json({ error: "Failed to decrement item quantity" });
    }
  });

  app.delete("/api/movements/:id/items/:itemId", requireAnyRole([ROLES.ADMIN, ROLES.ALMOXARIFADO]), async (req, res) => {
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
  app.get("/api/movements/:id/audit-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getMovementAuditLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Movement Attachments — List
  app.get("/api/movements/:id/attachments", requireAuth, async (req, res) => {
    try {
      const movement = await storage.getMovement(req.params.id);
      if (!movement) return res.status(404).json({ error: "Movement not found" });
      const attachments = await storage.getMovementAttachments(req.params.id);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  // Movement Attachments — Upload
  app.post(
    "/api/movements/:id/attachments",
    requireAnyRole([ROLES.ADMIN, ROLES.ALMOXARIFADO]),
    upload.single("file"),
    async (req, res) => {
      try {
        const movement = await storage.getMovement(req.params.id);
        if (!movement) return res.status(404).json({ error: "Movement not found" });

        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file provided" });

        const allowedMimeTypes = [
          "image/png", "image/jpeg", "image/jpg", "image/webp",
          "video/mp4", "video/quicktime", "video/webm",
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return res.status(400).json({ error: "Unsupported file type. Allowed: PNG, JPG, WebP, MP4, MOV, WebM" });
        }

        const fileType = file.mimetype.startsWith("image/") ? "image" : "video";
        const { category = "other", caption, productId, movementItemId } = req.body as Record<string, string>;
        const isPostCompletion = movement.status === "completed";

        const objectStorageService = new ObjectStorageService();
        const fileUrl = await objectStorageService.uploadObjectEntity(file.buffer, file.originalname);

        const attachment = await storage.createMovementAttachment({
          movementId: req.params.id,
          movementItemId: movementItemId || null,
          productId: productId || null,
          fileUrl,
          fileName: file.originalname,
          fileType,
          mimeType: file.mimetype,
          fileSize: file.size,
          category,
          caption: caption || null,
          uploadedBy: req.user!.id,
          uploadedByName: req.user!.name || req.user!.username,
          isPostCompletion,
        });

        // Audit log
        await storage.createMovementAuditLog({
          movementId: req.params.id,
          action: "evidence_added",
          actorId: req.user?.id || null,
          actorName: req.user?.name || "Sistema",
          metadata: {
            attachmentId: attachment.id,
            fileType,
            category,
            fileName: file.originalname,
            productId: productId || undefined,
            isPostCompletion,
          },
        });

        res.status(201).json(attachment);
      } catch (error) {
        console.error("Error uploading attachment:", error);
        res.status(500).json({ error: "Failed to upload attachment" });
      }
    }
  );

  // Movement Attachments — Soft Delete
  app.delete(
    "/api/movements/:id/attachments/:attachmentId",
    requireAnyRole([ROLES.ADMIN, ROLES.ALMOXARIFADO]),
    async (req, res) => {
      try {
        const movement = await storage.getMovement(req.params.id);
        if (!movement) return res.status(404).json({ error: "Movement not found" });
        await storage.softDeleteMovementAttachment(req.params.attachmentId, req.params.id);
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete attachment" });
      }
    }
  );

  // Update Movement Status
  app.patch("/api/movements/:id/status", requireAdmin(), async (req, res) => {
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

  app.post("/api/movements/:id/approve", requireAnyRole([ROLES.ADMIN, ROLES.SUPERVISOR]), async (req, res) => {
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

  app.post("/api/movements/:id/reject", requireAnyRole([ROLES.ADMIN, ROLES.SUPERVISOR]), async (req, res) => {
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
  app.get("/api/returns", requireAuth, async (req, res) => {
    try {
      const returns = await storage.getReturns();
      res.json(returns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch returns" });
    }
  });

  app.post("/api/returns", requireAnyRole([ROLES.ADMIN, ROLES.ALMOXARIFADO]), async (req, res) => {
    try {
      const data = insertReturnSchema.parse(req.body);
      const returnItem = await storage.createReturn(data);
      res.status(201).json(returnItem);
    } catch (error) {
      res.status(400).json({ error: "Invalid return data" });
    }
  });

  // Users — mention-lookup MUST be declared before /api/users/:id so it's not captured as an id.
  // Returns minimal payload (id/username/name) for @mention autocomplete; any logged-in user can call it.
  app.get("/api/users/mention-lookup", requireAuth, async (req, res) => {
    try {
      const users = await storage.getUsersForMentionLookup();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users for mention lookup:", error);
      res.status(500).json({ error: "Failed to fetch users for mention lookup" });
    }
  });

  app.get("/api/users", requireAdmin({ message: "Apenas administradores podem gerenciar usuários" }), async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAdmin({ message: "Apenas administradores podem gerenciar usuários" }), async (req, res) => {
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

  // Admin-only. The approval fields are stripped from the payload so a caller
  // can never self-provision an already-approved account; approval goes
  // through the dedicated approve/reject routes.
  app.post("/api/users", requireAdmin({ message: "Apenas administradores podem criar usuários" }), async (req, res) => {
    try {
      const data = insertUserSchema.omit({
        approvalStatus: true,
        approvedBy: true,
        approvedAt: true,
        rejectedBy: true,
        rejectedAt: true,
        rejectionReason: true,
      }).parse(req.body);
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

  app.patch("/api/users/:id", requireAdmin({ message: "Apenas administradores podem gerenciar usuários" }), async (req, res) => {
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
  const adminRolesPerms = requireAdmin({ message: "Apenas administradores podem gerenciar papéis e permissões" });

  app.get("/api/roles", adminRolesPerms, async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", adminRolesPerms, async (req, res) => {
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

  app.post("/api/roles", adminRolesPerms, async (req, res) => {
    try {
      const data = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(data);
      res.status(201).json(role);
    } catch (error) {
      res.status(400).json({ error: "Invalid role data" });
    }
  });

  app.patch("/api/roles/:id", adminRolesPerms, async (req, res) => {
    try {
      const data = insertRoleSchema.partial().parse(req.body);
      const role = await storage.updateRole(req.params.id, data);
      res.json(role);
    } catch (error) {
      res.status(400).json({ error: "Invalid role data" });
    }
  });

  app.delete("/api/roles/:id", adminRolesPerms, async (req, res) => {
    try {
      await storage.deleteRole(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // Permissions
  app.get("/api/permissions", adminRolesPerms, async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.post("/api/permissions", adminRolesPerms, async (req, res) => {
    try {
      const data = insertPermissionSchema.parse(req.body);
      const permission = await storage.createPermission(data);
      res.status(201).json(permission);
    } catch (error) {
      res.status(400).json({ error: "Invalid permission data" });
    }
  });

  // Populate/Update all system permissions
  app.post("/api/permissions/populate", adminRolesPerms, async (req, res) => {
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
        { page: 'stock-projection', displayName: 'Projeção de Estoque', category: 'Relatórios' },
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
  app.get("/api/users/:userId/roles", adminRolesPerms, async (req, res) => {
    try {
      const userRoles = await storage.getUserRoles(req.params.userId);
      res.json(userRoles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user roles" });
    }
  });

  app.post("/api/users/:userId/roles", adminRolesPerms, async (req, res) => {
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

  app.delete("/api/users/:userId/roles/:roleId", adminRolesPerms, async (req, res) => {
    try {
      await storage.removeUserRole(req.params.userId, req.params.roleId);
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ error: "Failed to remove user role" });
    }
  });

  // Role Permissions
  app.get("/api/roles/:roleId/permissions", adminRolesPerms, async (req, res) => {
    try {
      const rolePermissions = await storage.getRolePermissions(req.params.roleId);
      res.json(rolePermissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role permissions" });
    }
  });

  app.post("/api/roles/:roleId/permissions", adminRolesPerms, async (req, res) => {
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

  app.patch("/api/role-permissions/:id", adminRolesPerms, async (req, res) => {
    try {
      const data = insertRolePermissionSchema.partial().parse(req.body);
      const rolePermission = await storage.updateRolePermission(req.params.id, data);
      res.json(rolePermission);
    } catch (error) {
      res.status(400).json({ error: "Invalid role permission data" });
    }
  });

  app.delete("/api/roles/:roleId/permissions/:permissionId", adminRolesPerms, async (req, res) => {
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
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // See server/uploadPath.ts — the containment check must run on the
      // resolved path, and is unit-tested there.
      const filePath = resolveUploadPath(path.join(process.cwd(), 'uploads'), req.params.filename);
      if (!filePath) {
        return res.status(400).json({ error: "Caminho de arquivo inválido" });
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: "File not found" });
      }

      // Uploaded content is user-supplied: only formats that cannot execute
      // script are served inline (so <img> previews keep working); everything
      // else is forced to download rather than run as stored XSS.
      if (!isInlineSafe(filePath)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Update product image
  app.put("/api/products/:id/image", requireAdmin({ message: "Apenas administradores podem gerenciar produtos" }), async (req, res) => {
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
  app.put("/api/kits/:id/image", requireAdmin({ message: "Apenas administradores podem gerenciar kits" }), async (req, res) => {
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

  // NOTE: A duplicate GET /api/users for @mention autocomplete used to live
  // here. It was unreachable because Express resolves the first matching
  // route (the requireAuth-protected one declared earlier in this file),
  // and the active route already returns a superset of the fields used by
  // @mention. Removed in Fase 1.5 — see replit.md.

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

  const adminConfig = requireAdmin({ message: "Apenas administradores podem alterar configurações do sistema" });

  app.post("/api/movement-groups", adminConfig, async (req, res) => {
    try {
      const data = insertMovementGroupSchema.parse(req.body);
      const group = await storage.createMovementGroup(data);
      res.json(group);
    } catch (error) {
      console.error("Error creating movement group:", error);
      res.status(500).json({ error: "Failed to create movement group" });
    }
  });

  app.patch("/api/movement-groups/:id", adminConfig, async (req, res) => {
    try {
      const data = insertMovementGroupSchema.partial().parse(req.body);
      const group = await storage.updateMovementGroup(req.params.id, data);
      res.json(group);
    } catch (error) {
      console.error("Error updating movement group:", error);
      res.status(500).json({ error: "Failed to update movement group" });
    }
  });

  app.delete("/api/movement-groups/:id", adminConfig, async (req, res) => {
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

  app.post("/api/movement-types-config", adminConfig, async (req, res) => {
    try {
      const data = insertMovementTypeConfigSchema.parse(req.body);
      const typeConfig = await storage.createMovementTypeConfig(data);
      res.json(typeConfig);
    } catch (error) {
      console.error("Error creating movement type config:", error);
      res.status(500).json({ error: "Failed to create movement type config" });
    }
  });

  app.patch("/api/movement-types-config/:id", adminConfig, async (req, res) => {
    try {
      const data = insertMovementTypeConfigSchema.partial().parse(req.body);
      const typeConfig = await storage.updateMovementTypeConfig(req.params.id, data);
      res.json(typeConfig);
    } catch (error) {
      console.error("Error updating movement type config:", error);
      res.status(500).json({ error: "Failed to update movement type config" });
    }
  });

  app.delete("/api/movement-types-config/:id", adminConfig, async (req, res) => {
    try {
      await storage.deleteMovementTypeConfig(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting movement type config:", error);
      res.status(500).json({ error: "Failed to delete movement type config" });
    }
  });

  // Supplier tracking
  app.get("/api/products/:sku/recent-suppliers", requireAuth, async (req, res) => {
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

  // Register Request Template routes
  registerRequestTemplateRoutes(app);

  // Register AI Optimization routes
  registerOptimizationRoutes(app);

  // Register Reports routes
  registerReportsRoutes(app);
  registerStockProjectionRoutes(app);

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

  app.post("/api/product-statuses", adminConfig, async (req, res) => {
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

  app.patch("/api/product-statuses/:id", adminConfig, async (req, res) => {
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

  app.post("/api/locations", adminConfig, async (req, res) => {
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

  app.patch("/api/locations/:id", adminConfig, async (req, res) => {
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

  // NOTE: A duplicate GET /api/users for user management used to live here.
  // It was unreachable for the same reason as the @mention duplicate above
  // (Express first-match). The active route declared earlier already returns
  // a superset of these fields. Removed in Fase 1.5 — see replit.md.

  app.patch("/api/users/:id/approve", requireAdmin({ message: "Apenas administradores podem gerenciar usuários" }), async (req, res) => {
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

  app.patch("/api/users/:id/reject", requireAdmin({ message: "Apenas administradores podem gerenciar usuários" }), async (req, res) => {
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

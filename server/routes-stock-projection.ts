import { Express, Request, Response } from "express";
import { db } from "./db";
import { requireAuth } from "./ownership";
import { and, eq, inArray } from "drizzle-orm";
import {
  events,
  products,
  materialRequests,
  requestItems,
  loadingOrders,
  loadingOrderItems,
  loadingOrderTrips,
  trips,
  tripItems,
  tripEvents,
  tripDestinations,
  movements,
  movementItems,
  movementEvents,
  movementTrips,
  movementTypesConfig,
} from "@shared/schema";
import type {
  StockProjectionParams,
  StockProjectionResult,
  ProjectionDayStatus,
  ProjectionProduct,
  ProjectionDayCell,
  ProjectionConflict,
  ProjectionDriver,
  ProjectionLink,
  ProjectionSource,
  ConsideredMovement,
  ConsideredMovementProduct,
  ConsideredSituation,
  EventTripSummary,
  EventsWithTripsResult,
} from "@shared/stock-projection";

// --- Date helpers (bucket everything by UTC calendar day) ---------------------
function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function parseDayKey(s: string): Date {
  // Treat yyyy-MM-dd as a UTC midnight to keep bucketing stable.
  return new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
}
function buildRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = parseDayKey(start);
  const last = parseDayKey(end);
  let guard = 0;
  while (cur.getTime() <= last.getTime() && guard < 400) {
    out.push(toDayKey(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  return out;
}

const MAX_RANGE_DAYS = 90;

// A normalized stock movement contribution for a single (product) within a flow.
interface Flow {
  productId: string;
  qty: number;
  outDate: Date | null;
  arriveDate: Date | null; // when goods reach the destination (transit → in event)
  inDate: Date | null;
  alreadyPhysical: boolean; // already reflected in currentStock
  source: ProjectionSource;
  sourceId: string;
  label: string;
  eventId: string | null;
  eventName: string | null;
  status: string;
}

// Mutable accumulator for a "considered source" before product names are resolved.
interface ConsideredAcc {
  source: ProjectionSource;
  sourceId: string;
  label: string;
  eventId: string | null;
  eventName: string | null;
  direction: "outbound" | "inbound";
  outDate: string | null;
  inDate: string | null;
  status: string;
  alreadyPhysical: boolean;
  situation: ConsideredSituation;
  grossByProduct: Map<string, number>; // what the source carries (pre-netting)
  netQuantity: number; // what was actually counted (post-netting)
  href?: string;
}

const COMMITTED_ORDER_STATUS = new Set(["ready", "approved", "in_progress"]);
const PHYSICAL_MOVEMENT_STATUS = new Set(["in_progress", "paused", "completed"]);
const PHYSICAL_TRIP_STATUS = new Set(["in_transit", "at_destination", "unloading", "completed"]);

export function registerStockProjectionRoutes(app: Express) {
  app.post("/api/reports/stock-projection", requireAuth, async (req: Request, res: Response) => {
    try {
      const params: StockProjectionParams = req.body || {};
      const { startDate, endDate } = params;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate e endDate são obrigatórios" });
      }
      if (startDate > endDate) {
        return res.status(400).json({ error: "startDate deve ser anterior ou igual a endDate" });
      }

      const rangeDays = buildRange(startDate, endDate);
      if (rangeDays.length > MAX_RANGE_DAYS) {
        return res.status(400).json({
          error: `O período máximo é de ${MAX_RANGE_DAYS} dias. Selecione um intervalo menor.`,
        });
      }

      const include = {
        requests: params.include?.requests !== false,
        loadingOrders: params.include?.loadingOrders !== false,
        movements: params.include?.movements !== false,
        trips: params.include?.trips === true, // opt-in (avoids double count by default)
      };
      const eventFilter = params.eventIds && params.eventIds.length > 0 ? params.eventIds : null;
      const productFilter =
        params.productIds && params.productIds.length > 0 ? new Set(params.productIds) : null;

      const rangeStart = parseDayKey(startDate);
      const rangeEnd = parseDayKey(endDate);

      const conflicts: ProjectionConflict[] = [];
      const warnings: string[] = [];
      const considered: ConsideredAcc[] = [];
      const flows: Flow[] = [];

      // ── Events in scope ────────────────────────────────────────────────────
      const eventRows = await db
        .select({
          id: events.id,
          name: events.name,
          setupDate: events.setupDate,
          teardownDate: events.teardownDate,
        })
        .from(events)
        .where(eventFilter ? inArray(events.id, eventFilter) : undefined);
      const eventMap = new Map(eventRows.map((e) => [e.id, e]));
      const scopeEventIds = eventRows.map((e) => e.id);

      // ── useEventTripDates: pre-compute first/last trip dates per event ────────
      const firstDepartureByEvent = new Map<string, Date>();
      const lastReturnByEvent = new Map<string, Date>();
      if (params.useEventTripDates && scopeEventIds.length > 0) {
        const tripDateRows = await db
          .select({
            eventId: trips.eventId,
            departure: trips.departureDateTime,
            loadingStart: trips.loadingStartTime,
            scheduledStart: trips.scheduledStart,
            unloadingEnd: trips.unloadingEndTime,
            unloadingStart: trips.unloadingStartTime,
            scheduledEnd: trips.scheduledEnd,
          })
          .from(trips)
          .where(inArray(trips.eventId, scopeEventIds));

        for (const t of tripDateRows) {
          const dep = t.departure || t.loadingStart || t.scheduledStart;
          const ret = t.unloadingEnd || t.unloadingStart || t.scheduledEnd;
          if (dep) {
            const cur = firstDepartureByEvent.get(t.eventId);
            if (!cur || dep < cur) firstDepartureByEvent.set(t.eventId, dep);
          }
          if (ret) {
            const cur = lastReturnByEvent.get(t.eventId);
            if (!cur || ret > cur) lastReturnByEvent.set(t.eventId, ret);
          }
        }
      }

      // Quantity-aware precedence keyed by `${eventId}::${productId}`.
      // Higher-precedence sources (outbound movements > committed transport
      // {loading orders, trips} > requests) cover demand so lower sources only add
      // the *remaining* uncovered quantity. Avoids double counting without ever
      // discarding quantity a lower source claims beyond higher coverage.
      const movementOutboundQty = new Map<string, number>();
      const committedTotalQty = new Map<string, number>();
      const addQty = (map: Map<string, number>, key: string, qty: number) =>
        map.set(key, (map.get(key) || 0) + qty);

      // Helper: turn a flow into a per-cell driver entry.
      const driverOf = (f: Flow, direction: "outbound" | "inbound", qty: number): ProjectionDriver => ({
        source: f.source,
        sourceId: f.sourceId,
        label: f.label,
        eventId: f.eventId,
        eventName: f.eventName,
        direction,
        qty,
      });

      const situationOf = (gross: number, net: number, hasDate: boolean): ConsideredSituation => {
        if (!hasDate) return "no_date";
        if (gross > 0 && net <= 0) return "ignored";
        if (net < gross) return "partial";
        return "considered";
      };

      // ── Movements (outbound realizations + inbound supply) ─────────────────
      if (include.movements) {
        const typeRows = await db
          .select({ id: movementTypesConfig.id, nature: movementTypesConfig.nature })
          .from(movementTypesConfig);
        const natureMap = new Map(typeRows.map((t) => [t.id, t.nature]));

        const movementRows = await db
          .select({
            id: movements.id,
            number: movements.movementNumber,
            name: movements.name,
            legacyType: movements.type,
            typeConfigId: movements.movementTypeConfigId,
            status: movements.status,
            eventId: movements.eventId,
            startedAt: movements.startedAt,
            completedAt: movements.completedAt,
            createdAt: movements.createdAt,
          })
          .from(movements);

        const movementIds = movementRows.map((m) => m.id);
        const moveItemRows = movementIds.length
          ? await db
              .select({
                movementId: movementItems.movementId,
                productId: movementItems.productId,
                quantity: movementItems.quantity,
              })
              .from(movementItems)
              .where(inArray(movementItems.movementId, movementIds))
          : [];
        const moveEventRows = movementIds.length
          ? await db
              .select({ movementId: movementEvents.movementId, eventId: movementEvents.eventId })
              .from(movementEvents)
              .where(inArray(movementEvents.movementId, movementIds))
          : [];
        const itemsByMovement = new Map<string, { productId: string; quantity: number }[]>();
        for (const it of moveItemRows) {
          if (!itemsByMovement.has(it.movementId)) itemsByMovement.set(it.movementId, []);
          itemsByMovement.get(it.movementId)!.push({ productId: it.productId, quantity: it.quantity });
        }
        const eventsByMovement = new Map<string, string[]>();
        for (const me of moveEventRows) {
          if (!eventsByMovement.has(me.movementId)) eventsByMovement.set(me.movementId, []);
          eventsByMovement.get(me.movementId)!.push(me.eventId);
        }

        // Fetch linked trip departure dates so non-started outbound movements
        // are projected on the truck's scheduled departure, not createdAt.
        const movTripRows = movementIds.length
          ? await db
              .select({ movementId: movementTrips.movementId, tripId: movementTrips.tripId })
              .from(movementTrips)
              .where(inArray(movementTrips.movementId, movementIds))
          : [];
        const linkedTripIds = Array.from(new Set(movTripRows.map((r) => r.tripId)));
        const tripDateRows2 = linkedTripIds.length
          ? await db
              .select({
                id: trips.id,
                departure: trips.departureDateTime,
                loadingStart: trips.loadingStartTime,
              })
              .from(trips)
              .where(inArray(trips.id, linkedTripIds))
          : [];
        const tripDateMap2 = new Map(tripDateRows2.map((t) => [t.id, t]));
        // For each movement, earliest trip departure (loadingStart preferred)
        const tripDepartureByMovement = new Map<string, Date>();
        for (const { movementId, tripId } of movTripRows) {
          const td = tripDateMap2.get(tripId);
          if (!td) continue;
          const dep = td.loadingStart || td.departure;
          if (!dep) continue;
          const cur = tripDepartureByMovement.get(movementId);
          if (!cur || dep < cur) tripDepartureByMovement.set(movementId, dep);
        }

        for (const m of movementRows) {
          if (m.status === "cancelled") continue;
          const resolvedNature =
            (m.typeConfigId && natureMap.get(m.typeConfigId)) ||
            (m.legacyType?.startsWith("inbound") ? "inbound" : m.legacyType?.startsWith("outbound") ? "outbound" : null);
          // Physical movements that are already in_progress/paused/completed and have
          // scanned items should still appear in the projection (their effect is already
          // baked into currentStock, so alreadyPhysical=true prevents double-counting).
          // Movements with unresolvable nature AND non-physical are silently skipped.
          const isPhysicalMovement = PHYSICAL_MOVEMENT_STATUS.has(m.status);
          const nature: "inbound" | "outbound" | null =
            resolvedNature === "inbound" || resolvedNature === "outbound"
              ? resolvedNature
              : isPhysicalMovement
                ? "outbound"
                : null;
          if (nature !== "inbound" && nature !== "outbound") continue;

          const items = itemsByMovement.get(m.id) || [];
          if (items.length === 0) continue;

          // Resolve associated event (junction first, then legacy column).
          const mEventIds = eventsByMovement.get(m.id) || (m.eventId ? [m.eventId] : []);
          const primaryEventId = mEventIds.find((id) => eventMap.has(id)) || mEventIds[0] || null;
          // When filtering by events, drop movements unrelated to scope.
          if (eventFilter && !mEventIds.some((id) => eventFilter.includes(id))) continue;
          const ev = primaryEventId ? eventMap.get(primaryEventId) : undefined;

          const inScopeEventIds = mEventIds.filter((id) => eventMap.has(id));
          if (inScopeEventIds.length > 1) {
            conflicts.push({
              severity: "warning",
              kind: "ambiguous",
              source: "movement",
              sourceId: m.id,
              sourceLabel: `${m.number} — ${m.name}`,
              eventId: primaryEventId,
              eventName: ev?.name || null,
              message: `Movimentação vinculada a ${inScopeEventIds.length} eventos; precedência aplicada ao evento "${ev?.name || primaryEventId}".`,
              suggestedAction: "Revise o vínculo de eventos da movimentação para evitar dupla contagem.",
              links: [{ type: "movement", id: m.id, label: `${m.number}`, href: `/movements/${m.id}` }],
            });
          }

          const isPhysical = PHYSICAL_MOVEMENT_STATUS.has(m.status);
          // For non-started outbound movements, prefer the linked trip's
          // departure/loading date over createdAt so the projection bucket
          // matches when the truck actually leaves.
          const tripOutDate = tripDepartureByMovement.get(m.id) ?? null;
          const baseDate = isPhysical
            ? (m.startedAt || m.completedAt || m.createdAt)
            : (m.startedAt || tripOutDate || m.createdAt);
          const label = `${m.number} — ${m.name}`;

          if (nature === "outbound") {
            // Outbound realization: if physical it is already in currentStock; its
            // return comes back via the event teardown date.
            const outDate = baseDate;
            const inDate = ev?.teardownDate || null;
            const acc: ConsideredAcc = {
              source: "movement",
              sourceId: m.id,
              label,
              eventId: primaryEventId,
              eventName: ev?.name || null,
              direction: "outbound",
              outDate: outDate ? toDayKey(outDate) : null,
              inDate: inDate ? toDayKey(inDate) : null,
              status: m.status,
              alreadyPhysical: isPhysical,
              situation: "considered",
              grossByProduct: new Map(),
              netQuantity: 0,
              href: `/movements/${m.id}`,
            };
            for (const it of items) {
              if (productFilter && !productFilter.has(it.productId)) continue;
              addQty(acc.grossByProduct, it.productId, it.quantity);
              if (primaryEventId) addQty(movementOutboundQty, `${primaryEventId}::${it.productId}`, it.quantity);
              flows.push({
                productId: it.productId,
                qty: it.quantity,
                outDate,
                arriveDate: outDate,
                inDate,
                alreadyPhysical: isPhysical,
                source: "movement",
                sourceId: m.id,
                label,
                eventId: primaryEventId,
                eventName: ev?.name || null,
                status: m.status,
              });
              acc.netQuantity += it.quantity;
            }
            if (acc.grossByProduct.size > 0) considered.push(acc);
          } else {
            // Inbound supply: arrives (adds stock) on its date; nothing leaves.
            // Completed inbound is already in currentStock → skip from math.
            if (isPhysical && m.status === "completed") continue;
            const inDate = baseDate;
            const acc: ConsideredAcc = {
              source: "movement",
              sourceId: m.id,
              label,
              eventId: primaryEventId,
              eventName: ev?.name || null,
              direction: "inbound",
              outDate: null,
              inDate: inDate ? toDayKey(inDate) : null,
              status: m.status,
              alreadyPhysical: false,
              situation: "considered",
              grossByProduct: new Map(),
              netQuantity: 0,
              href: `/movements/${m.id}`,
            };
            for (const it of items) {
              if (productFilter && !productFilter.has(it.productId)) continue;
              addQty(acc.grossByProduct, it.productId, it.quantity);
              flows.push({
                productId: it.productId,
                qty: it.quantity,
                outDate: null,
                arriveDate: null,
                inDate,
                alreadyPhysical: false,
                source: "movement",
                sourceId: m.id,
                label,
                eventId: primaryEventId,
                eventName: ev?.name || null,
                status: m.status,
              });
              acc.netQuantity += it.quantity;
            }
            if (acc.grossByProduct.size > 0) considered.push(acc);
          }
        }
      }

      // Remaining movement coverage to net committed transport (orders + trips).
      const movementCoverRemaining = new Map(movementOutboundQty);

      // ── Loading orders (committed reservations) ────────────────────────────
      if (include.loadingOrders) {
        const orderConds: any[] = [inArray(loadingOrders.status, ["ready", "approved", "in_progress"] as any)];
        if (eventFilter) orderConds.push(inArray(loadingOrders.eventId, eventFilter));
        const orderRows = await db
          .select({
            id: loadingOrders.id,
            number: loadingOrders.orderNumber,
            status: loadingOrders.status,
            eventId: loadingOrders.eventId,
            plannedStart: loadingOrders.plannedStartTime,
            plannedEnd: loadingOrders.plannedEndTime,
            loadingDate: loadingOrders.loadingDate,
            unloadingDate: loadingOrders.unloadingDate,
          })
          .from(loadingOrders)
          .where(and(...orderConds));

        const orderIds = orderRows.map((o) => o.id);
        const orderItemRows = orderIds.length
          ? await db
              .select({
                orderId: loadingOrderItems.loadingOrderId,
                productId: loadingOrderItems.productId,
                quantity: loadingOrderItems.consolidatedQuantity,
              })
              .from(loadingOrderItems)
              .where(inArray(loadingOrderItems.loadingOrderId, orderIds))
          : [];
        const orderTripRows = orderIds.length
          ? await db
              .select({
                orderId: loadingOrderTrips.loadingOrderId,
                loadingStart: trips.loadingStartTime,
                departure: trips.departureDateTime,
                unloadingEnd: trips.unloadingEndTime,
              })
              .from(loadingOrderTrips)
              .leftJoin(trips, eq(loadingOrderTrips.tripId, trips.id))
              .where(inArray(loadingOrderTrips.loadingOrderId, orderIds))
          : [];

        const itemsByOrder = new Map<string, { productId: string; quantity: number }[]>();
        for (const it of orderItemRows) {
          if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, []);
          itemsByOrder.get(it.orderId)!.push({ productId: it.productId, quantity: it.quantity });
        }
        const tripsByOrder = new Map<string, typeof orderTripRows>();
        for (const t of orderTripRows) {
          if (!tripsByOrder.has(t.orderId)) tripsByOrder.set(t.orderId, [] as any);
          tripsByOrder.get(t.orderId)!.push(t);
        }

        for (const o of orderRows) {
          const ev = eventMap.get(o.eventId);
          const orderTrips = tripsByOrder.get(o.id) || [];
          let outDate: Date | null = null;
          let inDate: Date | null = null;
          for (const t of orderTrips) {
            const start = t.loadingStart || t.departure;
            if (start && (!outDate || start < outDate)) outDate = start;
            if (t.unloadingEnd && (!inDate || t.unloadingEnd > inDate)) inDate = t.unloadingEnd;
          }
          if (!outDate) outDate = o.plannedStart || o.loadingDate || ev?.setupDate || null;
          if (!inDate) inDate = o.plannedEnd || o.unloadingDate || ev?.teardownDate || null;

          const items = itemsByOrder.get(o.id) || [];
          if (items.length === 0) continue;

          const acc: ConsideredAcc = {
            source: "loading_order",
            sourceId: o.id,
            label: o.number,
            eventId: o.eventId,
            eventName: ev?.name || null,
            direction: "outbound",
            outDate: outDate ? toDayKey(outDate) : null,
            inDate: inDate ? toDayKey(inDate) : null,
            status: o.status,
            alreadyPhysical: false,
            situation: "considered",
            grossByProduct: new Map(),
            netQuantity: 0,
            href: `/loading-orders/${o.id}`,
          };
          for (const it of items) {
            if (productFilter && !productFilter.has(it.productId)) continue;
            addQty(acc.grossByProduct, it.productId, it.quantity);
          }
          const grossTotal = Array.from(acc.grossByProduct.values()).reduce((a, b) => a + b, 0);

          if (!outDate) {
            acc.situation = situationOf(grossTotal, 0, false);
            conflicts.push({
              severity: "warning",
              kind: "missing_data",
              source: "loading_order",
              sourceId: o.id,
              sourceLabel: o.number,
              eventId: o.eventId,
              eventName: ev?.name || null,
              message: "Ordem de carregamento sem data de saída (sem viagem nem datas próprias). Ignorada no cálculo.",
              suggestedAction: "Defina datas de carregamento/viagem para incluir esta ordem na projeção.",
              links: [{ type: "loading_order", id: o.id, label: o.number, href: `/loading-orders/${o.id}` }],
            });
            if (acc.grossByProduct.size > 0) considered.push(acc);
            continue;
          }
          if (orderTrips.length > 1) {
            conflicts.push({
              severity: "warning",
              kind: "ambiguous",
              source: "loading_order",
              sourceId: o.id,
              sourceLabel: o.number,
              eventId: o.eventId,
              eventName: ev?.name || null,
              message: `Ordem com ${orderTrips.length} viagens — período consolidado (saída mais cedo, retorno mais tarde).`,
              links: [{ type: "loading_order", id: o.id, label: o.number, href: `/loading-orders/${o.id}` }],
            });
          }

          for (const it of items) {
            if (productFilter && !productFilter.has(it.productId)) continue;
            const key = `${o.eventId}::${it.productId}`;
            // Track committed transport demand so requests below are netted.
            addQty(committedTotalQty, key, it.quantity);
            // Net against outbound movements already accounting for this demand.
            const remain = movementCoverRemaining.get(key) || 0;
            const take = Math.min(remain, it.quantity);
            if (take > 0) movementCoverRemaining.set(key, remain - take);
            const eff = it.quantity - take;
            if (eff <= 0) continue; // demand already realized by an outbound movement
            flows.push({
              productId: it.productId,
              qty: eff,
              outDate,
              arriveDate: outDate,
              inDate,
              alreadyPhysical: false,
              source: "loading_order",
              sourceId: o.id,
              label: o.number,
              eventId: o.eventId,
              eventName: ev?.name || null,
              status: o.status,
            });
            acc.netQuantity += eff;
          }
          acc.situation = situationOf(grossTotal, acc.netQuantity, true);
          if (acc.grossByProduct.size > 0) considered.push(acc);
        }
      }

      // ── Standalone trips (committed transport not linked to an order) ───────
      if (include.trips) {
        const linkedTripRows = await db
          .select({ tripId: loadingOrderTrips.tripId })
          .from(loadingOrderTrips);
        const linkedTripIds = new Set(linkedTripRows.map((r) => r.tripId));

        const tripConds: any[] = [];
        if (eventFilter) tripConds.push(inArray(trips.eventId, eventFilter));
        const tripRows = await db
          .select({
            id: trips.id,
            description: trips.description,
            eventId: trips.eventId,
            status: trips.status,
            loadingStart: trips.loadingStartTime,
            departure: trips.departureDateTime,
            unloadingStart: trips.unloadingStartTime,
            unloadingEnd: trips.unloadingEndTime,
            scheduledStart: trips.scheduledStart,
            scheduledEnd: trips.scheduledEnd,
          })
          .from(trips)
          .where(tripConds.length ? and(...tripConds) : undefined);
        const standalone = tripRows.filter((t) => !linkedTripIds.has(t.id));
        const standaloneIds = standalone.map((t) => t.id);

        const tripItemRows = standaloneIds.length
          ? await db
              .select({
                tripId: tripItems.tripId,
                productId: tripItems.productId,
                quantity: tripItems.plannedQuantity,
              })
              .from(tripItems)
              .where(inArray(tripItems.tripId, standaloneIds))
          : [];
        const tripDestRows = standaloneIds.length
          ? await db
              .select({ tripId: tripDestinations.tripId, arrival: tripDestinations.arrivalDateTime })
              .from(tripDestinations)
              .where(inArray(tripDestinations.tripId, standaloneIds))
          : [];
        const itemsByTrip = new Map<string, { productId: string; quantity: number }[]>();
        for (const it of tripItemRows) {
          if (!itemsByTrip.has(it.tripId)) itemsByTrip.set(it.tripId, []);
          itemsByTrip.get(it.tripId)!.push({ productId: it.productId, quantity: it.quantity });
        }
        const firstArrivalByTrip = new Map<string, Date>();
        for (const d of tripDestRows) {
          if (!d.arrival) continue;
          const cur = firstArrivalByTrip.get(d.tripId);
          if (!cur || d.arrival < cur) firstArrivalByTrip.set(d.tripId, d.arrival);
        }

        for (const t of standalone) {
          const items = itemsByTrip.get(t.id) || [];
          if (items.length === 0) continue;
          const ev = eventMap.get(t.eventId);
          const isPhysical = PHYSICAL_TRIP_STATUS.has(t.status);
          const outDate = t.loadingStart || t.departure || t.scheduledStart || ev?.setupDate || null;
          const arriveDate = firstArrivalByTrip.get(t.id) || outDate;
          const inDate = t.unloadingEnd || t.unloadingStart || t.scheduledEnd || ev?.teardownDate || null;
          const label = t.description ? `Viagem — ${t.description}` : `Viagem ${t.id.slice(0, 8)}`;

          const acc: ConsideredAcc = {
            source: "trip",
            sourceId: t.id,
            label,
            eventId: t.eventId,
            eventName: ev?.name || null,
            direction: "outbound",
            outDate: outDate ? toDayKey(outDate) : null,
            inDate: inDate ? toDayKey(inDate) : null,
            status: t.status,
            alreadyPhysical: isPhysical,
            situation: "considered",
            grossByProduct: new Map(),
            netQuantity: 0,
            href: `/trips`,
          };
          for (const it of items) {
            if (productFilter && !productFilter.has(it.productId)) continue;
            addQty(acc.grossByProduct, it.productId, it.quantity);
          }
          const grossTotal = Array.from(acc.grossByProduct.values()).reduce((a, b) => a + b, 0);

          if (!outDate) {
            acc.situation = situationOf(grossTotal, 0, false);
            conflicts.push({
              severity: "warning",
              kind: "missing_data",
              source: "trip",
              sourceId: t.id,
              sourceLabel: label,
              eventId: t.eventId,
              eventName: ev?.name || null,
              message: "Viagem sem data de carregamento/saída. Ignorada no cálculo.",
              suggestedAction: "Defina a data de carregamento ou saída da viagem.",
              links: [{ type: "trip", id: t.id, label, href: `/trips` }],
            });
            if (acc.grossByProduct.size > 0) considered.push(acc);
            continue;
          }

          for (const it of items) {
            if (productFilter && !productFilter.has(it.productId)) continue;
            const key = `${t.eventId}::${it.productId}`;
            addQty(committedTotalQty, key, it.quantity);
            const remain = movementCoverRemaining.get(key) || 0;
            const take = Math.min(remain, it.quantity);
            if (take > 0) movementCoverRemaining.set(key, remain - take);
            const eff = it.quantity - take;
            if (eff <= 0) continue;
            flows.push({
              productId: it.productId,
              qty: eff,
              outDate,
              arriveDate,
              inDate,
              alreadyPhysical: isPhysical,
              source: "trip",
              sourceId: t.id,
              label,
              eventId: t.eventId,
              eventName: ev?.name || null,
              status: t.status,
            });
            acc.netQuantity += eff;
          }
          acc.situation = situationOf(grossTotal, acc.netQuantity, true);
          if (acc.grossByProduct.size > 0) considered.push(acc);
        }
      }

      // ── Approved requests not yet consolidated ─────────────────────────────
      if (include.requests && scopeEventIds.length > 0) {
        const reqConds: any[] = [
          inArray(materialRequests.eventId, scopeEventIds),
          inArray(materialRequests.status, ["approved", "cutoff_locked"] as any),
        ];
        const reqRows = await db
          .select({
            id: materialRequests.id,
            eventId: materialRequests.eventId,
            area: materialRequests.area,
            status: materialRequests.status,
          })
          .from(materialRequests)
          .where(and(...reqConds));
        const reqIds = reqRows.map((r) => r.id);
        const reqItemRows = reqIds.length
          ? await db
              .select({
                requestId: requestItems.requestId,
                productId: requestItems.productId,
                quantity: requestItems.quantity,
                approvalStatus: requestItems.approvalStatus,
                approvedQuantity: requestItems.approvedQuantity,
              })
              .from(requestItems)
              .where(inArray(requestItems.requestId, reqIds))
          : [];
        const itemsByRequest = new Map<string, typeof reqItemRows>();
        for (const it of reqItemRows) {
          if (!it.productId) continue;
          if (!itemsByRequest.has(it.requestId)) itemsByRequest.set(it.requestId, [] as any);
          itemsByRequest.get(it.requestId)!.push(it);
        }

        // Requests are netted by the larger of movement/committed coverage already
        // counted for the same (event, product).
        const reqCoverRemaining = new Map<string, number>();

        for (const r of reqRows) {
          const ev = eventMap.get(r.eventId);
          const items = itemsByRequest.get(r.id) || [];
          if (items.length === 0) continue;
          const outDate =
            (params.useEventTripDates && firstDepartureByEvent.get(r.eventId)) ||
            ev?.setupDate ||
            null;
          const inDate =
            (params.useEventTripDates && lastReturnByEvent.get(r.eventId)) ||
            ev?.teardownDate ||
            null;
          const label = `${ev?.name || "Evento"} · ${r.area}`;

          const acc: ConsideredAcc = {
            source: "request",
            sourceId: r.id,
            label,
            eventId: r.eventId,
            eventName: ev?.name || null,
            direction: "outbound",
            outDate: outDate ? toDayKey(outDate) : null,
            inDate: inDate ? toDayKey(inDate) : null,
            status: r.status,
            alreadyPhysical: false,
            situation: "considered",
            grossByProduct: new Map(),
            netQuantity: 0,
            href: `/requests/${r.id}`,
          };
          for (const it of items) {
            if (it.approvalStatus === "rejected") continue;
            const productId = it.productId!;
            if (productFilter && !productFilter.has(productId)) continue;
            const baseQty =
              it.approvalStatus === "approved" && it.approvedQuantity != null
                ? it.approvedQuantity
                : it.quantity;
            if (baseQty <= 0) continue;
            addQty(acc.grossByProduct, productId, baseQty);
          }
          const grossTotal = Array.from(acc.grossByProduct.values()).reduce((a, b) => a + b, 0);

          if (!outDate) {
            acc.situation = situationOf(grossTotal, 0, false);
            conflicts.push({
              severity: "warning",
              kind: "missing_data",
              source: "request",
              sourceId: r.id,
              sourceLabel: label,
              eventId: r.eventId,
              eventName: ev?.name || null,
              message: "Requisição sem data de montagem do evento. Ignorada no cálculo.",
              suggestedAction: "Defina a data de montagem do evento para incluir esta requisição.",
              links: [
                { type: "request", id: r.id, label: r.area, href: `/requests/${r.id}` },
                ...(r.eventId
                  ? [{ type: "event" as const, id: r.eventId, label: ev?.name || "Evento", href: `/events/${r.eventId}` }]
                  : []),
              ],
            });
            if (acc.grossByProduct.size > 0) considered.push(acc);
            continue;
          }

          for (const [productId, baseQty] of Array.from(acc.grossByProduct.entries())) {
            const key = `${r.eventId}::${productId}`;
            if (!reqCoverRemaining.has(key)) {
              reqCoverRemaining.set(
                key,
                Math.max(movementOutboundQty.get(key) || 0, committedTotalQty.get(key) || 0),
              );
            }
            const remain = reqCoverRemaining.get(key)!;
            const take = Math.min(remain, baseQty);
            if (take > 0) reqCoverRemaining.set(key, remain - take);
            const eff = baseQty - take;
            if (eff <= 0) continue; // demand already covered by committed transport / movements
            flows.push({
              productId,
              qty: eff,
              outDate,
              arriveDate: outDate,
              inDate,
              alreadyPhysical: false,
              source: "request",
              sourceId: r.id,
              label,
              eventId: r.eventId,
              eventName: ev?.name || null,
              status: r.status,
            });
            acc.netQuantity += eff;
          }
          acc.situation = situationOf(grossTotal, acc.netQuantity, true);
          if (acc.grossByProduct.size > 0) considered.push(acc);
        }
      }

      // ── Resolve product universe (flows + considered, for names) ────────────
      const flowProductIdSet = new Set<string>();
      for (const f of flows) flowProductIdSet.add(f.productId);
      const allProductIdSet = new Set<string>(flowProductIdSet);
      for (const acc of considered)
        for (const pid of Array.from(acc.grossByProduct.keys())) allProductIdSet.add(pid);

      // Fetch ALL products (the projection must show the full catalog, not only impacted products).
      // If a product-level filter is active, restrict to those; otherwise include everything.
      const catalogQuery = db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          unit: products.unit,
          currentStock: products.currentStock,
          minimumStock: products.minimumStock,
        })
        .from(products);
      const productRows = productFilter
        ? await catalogQuery.where(inArray(products.id, Array.from(productFilter)))
        : await catalogQuery;
      const productMap = new Map(productRows.map((p) => [p.id, p]));

      // Materialize considered movements (resolve product names + situation).
      const finalizeConsidered = (acc: ConsideredAcc): ConsideredMovement => {
        const productsList: ConsideredMovementProduct[] = Array.from(acc.grossByProduct.entries()).map(
          ([pid, qty]) => {
            const p = productMap.get(pid);
            return { productId: pid, name: p?.name || "Produto", sku: p?.sku || "—", qty };
          },
        );
        const grossTotal = productsList.reduce((a, b) => a + b.qty, 0);
        return {
          source: acc.source,
          sourceId: acc.sourceId,
          label: acc.label,
          eventId: acc.eventId,
          eventName: acc.eventName,
          direction: acc.direction,
          outDate: acc.outDate,
          inDate: acc.inDate,
          productCount: productsList.length,
          totalQuantity: acc.situation === "no_date" || acc.situation === "ignored" ? 0 : acc.netQuantity || grossTotal,
          status: acc.status,
          alreadyPhysical: acc.alreadyPhysical,
          situation: acc.situation,
          products: productsList,
          href: acc.href,
        };
      };
      const consideredMovements: ConsideredMovement[] = considered.map(finalizeConsidered);

      // Build a human description of what fed the projection.
      const baseSources: string[] = [];
      if (include.movements) baseSources.push("movimentações");
      if (include.loadingOrders) baseSources.push("ordens de carregamento");
      if (include.trips) baseSources.push("viagens avulsas");
      if (include.requests) baseSources.push("requisições aprovadas");
      const calculationBase = `Saldo atual dos produtos + ${baseSources.join(", ") || "nenhuma fonte"} no período de ${startDate} a ${endDate}.`;

      // No early return for empty flows — the projection always shows all catalog products
      // (with flat zero-activity lines when they have no flows in the period).

      const flowsByProduct = new Map<string, Flow[]>();
      for (const f of flows) {
        if (!flowsByProduct.has(f.productId)) flowsByProduct.set(f.productId, []);
        flowsByProduct.get(f.productId)!.push(f);
      }

      const dayIndex = new Map<string, number>();
      rangeDays.forEach((d, i) => dayIndex.set(d, i));

      const projProducts: ProjectionProduct[] = [];
      let peakShortageDate: string | null = null;
      let peakShortageDeficit = 0;
      let sumOutbound = 0;
      let sumInbound = 0;
      let sumPeakReserved = 0;
      let sumPeakInEvent = 0;

      const driverToLink = (d: ProjectionDriver): ProjectionLink => {
        switch (d.source) {
          case "loading_order":
            return { type: "loading_order", id: d.sourceId, label: d.label, href: `/loading-orders/${d.sourceId}` };
          case "movement":
            return { type: "movement", id: d.sourceId, label: d.label, href: `/movements/${d.sourceId}` };
          case "request":
            return { type: "request", id: d.sourceId, label: d.label, href: `/requests/${d.sourceId}` };
          case "trip":
          default:
            return { type: "trip", id: d.sourceId, label: d.label, href: `/trips` };
        }
      };

      for (const productId of Array.from(productMap.keys())) {
        const p = productMap.get(productId);
        if (!p) continue;
        const productFlows = flowsByProduct.get(productId) || [];

        const outboundByDay = new Array(rangeDays.length).fill(0);
        const inboundByDay = new Array(rangeDays.length).fill(0);
        const reservedByDay = new Array(rangeDays.length).fill(0);
        const inTransitByDay = new Array(rangeDays.length).fill(0);
        const inEventByDay = new Array(rangeDays.length).fill(0);
        const driversByDay: ProjectionDriver[][] = rangeDays.map(() => []);

        for (const f of productFlows) {
          const effOut = f.outDate;
          const effIn = f.inDate;
          const effArrive = f.arriveDate || f.outDate;
          // Fully returned before window → no effect on this window.
          if (effIn && effIn.getTime() < rangeStart.getTime() && (!effOut || effOut.getTime() < rangeStart.getTime())) {
            continue;
          }

          // Outbound (only for not-yet-physical flows; physical already left).
          if (effOut && !f.alreadyPhysical) {
            if (effOut.getTime() <= rangeEnd.getTime()) {
              const applyKey = effOut.getTime() < rangeStart.getTime() ? rangeDays[0] : toDayKey(effOut);
              const idx = dayIndex.get(applyKey);
              if (idx !== undefined) {
                outboundByDay[idx] += f.qty;
                driversByDay[idx].push(driverOf(f, "outbound", f.qty));
              }
            }
          }

          // Inbound (returns of any flow, including physical ones).
          if (effIn && effIn.getTime() >= rangeStart.getTime() && effIn.getTime() <= rangeEnd.getTime()) {
            const idx = dayIndex.get(toDayKey(effIn));
            if (idx !== undefined) {
              inboundByDay[idx] += f.qty;
              driversByDay[idx].push(driverOf(f, "inbound", f.qty));
            }
          }

          // Overlays per day.
          for (let i = 0; i < rangeDays.length; i++) {
            const dTime = parseDayKey(rangeDays[i]).getTime();
            const outTime = effOut ? effOut.getTime() : null;
            const arriveTime = effArrive ? effArrive.getTime() : outTime;
            const inTime = effIn ? effIn.getTime() : null;
            // Reserved: committed, not yet shipped (only non-physical).
            if (!f.alreadyPhysical && outTime !== null && dTime < outTime) {
              reservedByDay[i] += f.qty;
            }
            const shipped = outTime === null ? false : dTime >= outTime;
            const arrived = arriveTime === null ? shipped : dTime >= arriveTime;
            const returned = inTime !== null && dTime >= inTime;
            // In transit: shipped but not yet arrived.
            if (shipped && !arrived && !returned) inTransitByDay[i] += f.qty;
            // In event: arrived and not yet returned.
            if (arrived && !returned) inEventByDay[i] += f.qty;
          }
        }

        const cells: ProjectionDayCell[] = [];
        let opening = p.currentStock || 0;
        let minAvailable = Infinity;
        let minAvailableDate: string | null = null;
        let worstStatus: ProjectionDayStatus = "ok";
        let totalOutbound = 0;
        let totalInbound = 0;
        let peakReserved = 0;
        let peakInEvent = 0;
        const minimumStock = p.minimumStock || 0;

        for (let i = 0; i < rangeDays.length; i++) {
          const outbound = outboundByDay[i];
          const inbound = inboundByDay[i];
          const available = opening - outbound + inbound;
          totalOutbound += outbound;
          totalInbound += inbound;
          if (reservedByDay[i] > peakReserved) peakReserved = reservedByDay[i];
          if (inEventByDay[i] > peakInEvent) peakInEvent = inEventByDay[i];

          let status: ProjectionDayStatus = "ok";
          if (available < 0) status = "shortage";
          else if (minimumStock > 0 && available < minimumStock) status = "low";

          if (available < minAvailable) {
            minAvailable = available;
            minAvailableDate = rangeDays[i];
          }
          if (status === "shortage") worstStatus = "shortage";
          else if (status === "low" && worstStatus !== "shortage") worstStatus = "low";

          if (available < 0 && -available > peakShortageDeficit) {
            peakShortageDeficit = -available;
            peakShortageDate = rangeDays[i];
          }

          cells.push({
            date: rangeDays[i],
            opening,
            inbound,
            outbound,
            available,
            reserved: reservedByDay[i],
            inTransit: inTransitByDay[i],
            inEvent: inEventByDay[i],
            status,
            drivers: driversByDay[i],
          });
          opening = available;
        }

        if (minAvailable === Infinity) minAvailable = p.currentStock || 0;

        if (params.onlyShortages && worstStatus !== "shortage") continue;
        if (params.onlyImpacted) {
          const impacted = cells.some(
            (c) => c.outbound !== 0 || c.inbound !== 0 || c.reserved !== 0 || c.inTransit !== 0 || c.inEvent !== 0,
          );
          if (!impacted) continue;
        }

        const maxDeficit = Math.max(0, -minAvailable);
        sumOutbound += totalOutbound;
        sumInbound += totalInbound;
        sumPeakReserved += peakReserved;
        sumPeakInEvent += peakInEvent;

        projProducts.push({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          currentStock: p.currentStock || 0,
          minimumStock,
          days: cells,
          minAvailable,
          minAvailableDate,
          worstStatus,
          totalOutbound,
          totalInbound,
          totalInEvent: peakInEvent,
          maxDeficit,
        });

        // Build an actionable conflict for shortage / low products.
        if (worstStatus === "shortage" || worstStatus === "low") {
          const worstIdx = minAvailableDate ? dayIndex.get(minAvailableDate) : undefined;
          const links: ProjectionLink[] = [];
          const seen = new Set<string>();
          const pushLink = (l: ProjectionLink) => {
            const k = `${l.type}:${l.id}`;
            if (!seen.has(k)) {
              seen.add(k);
              links.push(l);
            }
          };
          pushLink({ type: "product", id: p.id, label: p.sku, href: `/products` });
          const collectFrom = (cell?: ProjectionDayCell) => {
            if (!cell) return;
            for (const d of cell.drivers) {
              if (d.direction !== "outbound") continue;
              pushLink(driverToLink(d));
              if (d.eventId) {
                pushLink({ type: "event", id: d.eventId, label: d.eventName || "Evento", href: `/events/${d.eventId}` });
              }
            }
          };
          if (worstIdx !== undefined) collectFrom(cells[worstIdx]);
          if (links.length <= 1 && worstIdx !== undefined) {
            for (let i = 0; i <= worstIdx; i++) collectFrom(cells[i]);
          }

          const isShortage = worstStatus === "shortage";
          const deficit = isShortage ? maxDeficit : Math.max(0, minimumStock - minAvailable);
          const dominantEvent = links.find((l) => l.type === "event");
          conflicts.push({
            severity: isShortage ? "error" : "warning",
            kind: "shortage",
            source: (cells[worstIdx ?? 0]?.drivers.find((d) => d.direction === "outbound")?.source as ProjectionSource) || "loading_order",
            sourceId: p.id,
            sourceLabel: p.name,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            date: minAvailableDate,
            projectedBalance: minAvailable,
            minimumStock,
            deficit,
            eventId: dominantEvent ? dominantEvent.id : null,
            eventName: dominantEvent ? dominantEvent.label : null,
            message: isShortage
              ? `Saldo negativo (${minAvailable} ${p.unit}) previsto em ${minAvailableDate}.`
              : `Saldo (${minAvailable} ${p.unit}) abaixo do mínimo (${minimumStock}) em ${minAvailableDate}.`,
            suggestedAction: isShortage
              ? `Comprar/alugar ${deficit} ${p.unit} ou antecipar retornos antes de ${minAvailableDate}.`
              : `Repor ${deficit} ${p.unit} para manter o estoque mínimo.`,
            links,
          });
        }
      }

      // Sort: shortage first, then low, then ok; tiebreak by worst availability.
      const statusOrder: Record<ProjectionDayStatus, number> = { shortage: 0, low: 1, ok: 2 };
      projProducts.sort((a, b) => {
        const diff = statusOrder[a.worstStatus] - statusOrder[b.worstStatus];
        if (diff !== 0) return diff;
        if (a.minAvailable !== b.minAvailable) return a.minAvailable - b.minAvailable;
        return a.name.localeCompare(b.name);
      });

      // Aggregate warnings.
      const missingCount = conflicts.filter((c) => c.kind === "missing_data").length;
      if (missingCount > 0) warnings.push(`${missingCount} origem(ns) ignorada(s) por falta de data.`);
      const ambiguousCount = conflicts.filter((c) => c.kind === "ambiguous").length;
      if (ambiguousCount > 0) warnings.push(`${ambiguousCount} origem(ns) com vínculo de múltiplos eventos/viagens.`);

      const result: StockProjectionResult = {
        generatedAt: new Date().toISOString(),
        calculationBase,
        filters: params,
        rangeDays,
        summary: {
          totalProducts: projProducts.length,
          productsShortage: projProducts.filter((p) => p.worstStatus === "shortage").length,
          productsLow: projProducts.filter((p) => p.worstStatus === "low").length,
          productsOk: projProducts.filter((p) => p.worstStatus === "ok").length,
          peakShortageDate,
          totalOutbound: sumOutbound,
          totalInbound: sumInbound,
          totalReserved: sumPeakReserved,
          totalInEvent: sumPeakInEvent,
        },
        products: projProducts,
        conflicts,
        consideredMovements,
        warnings,
      };

      res.json(result);
    } catch (error: any) {
      console.error("Stock projection error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── GET /api/reports/events-with-trips ──────────────────────────────────────
  app.get("/api/reports/events-with-trips", requireAuth, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query as Record<string, string>;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate e endDate são obrigatórios" });
      }

      const rangeStart = parseDayKey(startDate);
      const rangeEnd = new Date(`${endDate}T23:59:59.999Z`);

      const allTrips = await db
        .select({
          id: trips.id,
          description: trips.description,
          eventId: trips.eventId,
          status: trips.status,
          departure: trips.departureDateTime,
          loadingStart: trips.loadingStartTime,
          scheduledStart: trips.scheduledStart,
          unloadingEnd: trips.unloadingEndTime,
          unloadingStart: trips.unloadingStartTime,
          scheduledEnd: trips.scheduledEnd,
        })
        .from(trips);

      const tripsByEvent = new Map<string, typeof allTrips>();
      for (const t of allTrips) {
        const dep = t.departure || t.loadingStart || t.scheduledStart;
        const ret = t.unloadingEnd || t.unloadingStart || t.scheduledEnd;
        const depInRange = dep && dep >= rangeStart && dep <= rangeEnd;
        const retInRange = ret && ret >= rangeStart && ret <= rangeEnd;
        const spansRange = dep && ret && dep <= rangeEnd && ret >= rangeStart;
        if (!depInRange && !retInRange && !spansRange) continue;
        if (!tripsByEvent.has(t.eventId)) tripsByEvent.set(t.eventId, []);
        tripsByEvent.get(t.eventId)!.push(t);
      }

      if (tripsByEvent.size === 0) {
        return res.json({ startDate, endDate, events: [] } as EventsWithTripsResult);
      }

      const scopeEventIds = Array.from(tripsByEvent.keys());

      const [eventRows, reqRows] = await Promise.all([
        db.select({ id: events.id, name: events.name })
          .from(events)
          .where(inArray(events.id, scopeEventIds)),
        db.select({ eventId: materialRequests.eventId, id: materialRequests.id })
          .from(materialRequests)
          .where(inArray(materialRequests.eventId, scopeEventIds)),
      ]);

      const reqCountByEvent = new Map<string, number>();
      for (const r of reqRows) {
        reqCountByEvent.set(r.eventId, (reqCountByEvent.get(r.eventId) || 0) + 1);
      }

      const result: EventTripSummary[] = eventRows.map((ev) => {
        const evTrips = tripsByEvent.get(ev.id) || [];
        let firstDep: Date | null = null;
        let lastRet: Date | null = null;
        for (const t of evTrips) {
          const dep = t.departure || t.loadingStart || t.scheduledStart;
          const ret = t.unloadingEnd || t.unloadingStart || t.scheduledEnd;
          if (dep && (!firstDep || dep < firstDep)) firstDep = dep;
          if (ret && (!lastRet || ret > lastRet)) lastRet = ret;
        }
        return {
          id: ev.id,
          name: ev.name,
          firstDepartureDate: firstDep ? toDayKey(firstDep) : null,
          lastReturnDate: lastRet ? toDayKey(lastRet) : null,
          trips: evTrips.map((t) => {
            const dep = t.departure || t.loadingStart || t.scheduledStart;
            const ret = t.unloadingEnd || t.unloadingStart || t.scheduledEnd;
            return {
              id: t.id,
              description: t.description,
              status: t.status,
              departureDate: dep ? toDayKey(dep) : null,
              returnDate: ret ? toDayKey(ret) : null,
            };
          }),
          requestCount: reqCountByEvent.get(ev.id) || 0,
        };
      });

      return res.json({ startDate, endDate, events: result } as EventsWithTripsResult);
    } catch (error: any) {
      console.error("events-with-trips error:", error);
      return res.status(500).json({ error: "Erro ao buscar eventos com viagens" });
    }
  });
}

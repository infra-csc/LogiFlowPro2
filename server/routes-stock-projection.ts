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
  movements,
  movementItems,
  movementEvents,
  movementTypesConfig,
} from "@shared/schema";
import type {
  StockProjectionParams,
  StockProjectionResult,
  ProjectionDayStatus,
  ProjectionProduct,
  ProjectionDayCell,
  ProjectionConflict,
  ConsideredMovement,
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

// A normalized stock movement contribution for a single (product) within a flow.
interface Flow {
  productId: string;
  qty: number;
  outDate: Date | null;
  inDate: Date | null;
  alreadyPhysical: boolean; // already reflected in currentStock
  source: "request" | "loading_order" | "movement";
  sourceId: string;
  label: string;
  eventId: string | null;
  eventName: string | null;
  status: string;
}

const COMMITTED_ORDER_STATUS = new Set(["ready", "approved", "in_progress"]);
const PHYSICAL_MOVEMENT_STATUS = new Set(["in_progress", "paused", "completed"]);

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

      const include = {
        requests: params.include?.requests !== false,
        loadingOrders: params.include?.loadingOrders !== false,
        movements: params.include?.movements !== false,
      };
      const eventFilter = params.eventIds && params.eventIds.length > 0 ? params.eventIds : null;
      const productFilter =
        params.productIds && params.productIds.length > 0 ? new Set(params.productIds) : null;

      const rangeDays = buildRange(startDate, endDate);
      const rangeStart = parseDayKey(startDate);
      const rangeEnd = parseDayKey(endDate);

      const conflicts: ProjectionConflict[] = [];
      const consideredMovements: ConsideredMovement[] = [];
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

      // Quantity-aware precedence keyed by `${eventId}::${productId}`.
      // Higher-precedence sources (outbound movements > loading orders > requests)
      // cover demand so lower sources only add the *remaining* uncovered quantity.
      // This avoids double counting while never discarding quantity a lower source
      // claims beyond what higher sources already account for.
      const movementOutboundQty = new Map<string, number>();
      const loadingTotalQty = new Map<string, number>();
      const addQty = (map: Map<string, number>, key: string, qty: number) =>
        map.set(key, (map.get(key) || 0) + qty);

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

        for (const m of movementRows) {
          if (m.status === "cancelled") continue;
          const nature =
            (m.typeConfigId && natureMap.get(m.typeConfigId)) ||
            (m.legacyType?.startsWith("inbound") ? "inbound" : m.legacyType?.startsWith("outbound") ? "outbound" : null);
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
              source: "movement",
              sourceId: m.id,
              sourceLabel: `${m.number} — ${m.name}`,
              message: `Movimentação vinculada a ${inScopeEventIds.length} eventos; precedência aplicada ao evento "${ev?.name || primaryEventId}".`,
            });
          }

          const isPhysical = PHYSICAL_MOVEMENT_STATUS.has(m.status);
          const baseDate = m.startedAt || m.completedAt || m.createdAt;

          if (nature === "outbound") {
            // Outbound realization: if physical it is already in currentStock; its
            // return comes back via the event teardown date.
            const outDate = baseDate;
            const inDate = ev?.teardownDate || null;
            let totalQty = 0;
            for (const it of items) {
              if (productFilter && !productFilter.has(it.productId)) continue;
              if (primaryEventId) addQty(movementOutboundQty, `${primaryEventId}::${it.productId}`, it.quantity);
              flows.push({
                productId: it.productId,
                qty: it.quantity,
                outDate,
                inDate,
                alreadyPhysical: isPhysical,
                source: "movement",
                sourceId: m.id,
                label: `${m.number} — ${m.name}`,
                eventId: primaryEventId,
                eventName: ev?.name || null,
                status: m.status,
              });
              totalQty += it.quantity;
            }
            if (totalQty > 0) {
              consideredMovements.push({
                source: "movement",
                sourceId: m.id,
                label: `${m.number} — ${m.name}`,
                eventId: primaryEventId,
                eventName: ev?.name || null,
                direction: "outbound",
                outDate: outDate ? toDayKey(outDate) : null,
                inDate: inDate ? toDayKey(inDate) : null,
                productCount: items.length,
                totalQuantity: totalQty,
                status: m.status,
                alreadyPhysical: isPhysical,
              });
            }
          } else {
            // Inbound supply: arrives (adds stock) on its date; nothing leaves.
            // Completed inbound is already in currentStock → skip from math.
            if (isPhysical && m.status === "completed") continue;
            const inDate = baseDate;
            let totalQty = 0;
            for (const it of items) {
              if (productFilter && !productFilter.has(it.productId)) continue;
              flows.push({
                productId: it.productId,
                qty: it.quantity,
                outDate: null,
                inDate,
                alreadyPhysical: false,
                source: "movement",
                sourceId: m.id,
                label: `${m.number} — ${m.name}`,
                eventId: primaryEventId,
                eventName: ev?.name || null,
                status: m.status,
              });
              totalQty += it.quantity;
            }
            if (totalQty > 0) {
              consideredMovements.push({
                source: "movement",
                sourceId: m.id,
                label: `${m.number} — ${m.name}`,
                eventId: primaryEventId,
                eventName: ev?.name || null,
                direction: "inbound",
                outDate: null,
                inDate: inDate ? toDayKey(inDate) : null,
                productCount: items.length,
                totalQuantity: totalQty,
                status: m.status,
                alreadyPhysical: false,
              });
            }
          }
        }
      }

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

        // Remaining movement coverage to net against loading orders.
        const movementCoverRemaining = new Map(movementOutboundQty);

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

          if (!outDate) {
            conflicts.push({
              severity: "error",
              source: "loading_order",
              sourceId: o.id,
              sourceLabel: o.number,
              message: "Ordem de carregamento sem data de saída (sem viagem nem datas próprias). Ignorada no cálculo.",
            });
            continue;
          }
          if (orderTrips.length > 1) {
            conflicts.push({
              severity: "warning",
              source: "loading_order",
              sourceId: o.id,
              sourceLabel: o.number,
              message: `Ordem com ${orderTrips.length} viagens — período consolidado (saída mais cedo, retorno mais tarde).`,
            });
          }

          let totalQty = 0;
          for (const it of items) {
            if (productFilter && !productFilter.has(it.productId)) continue;
            const key = `${o.eventId}::${it.productId}`;
            // Track full loading demand so requests below are netted by the larger
            // of movement/loading coverage.
            addQty(loadingTotalQty, key, it.quantity);
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
              inDate,
              alreadyPhysical: false,
              source: "loading_order",
              sourceId: o.id,
              label: o.number,
              eventId: o.eventId,
              eventName: ev?.name || null,
              status: o.status,
            });
            totalQty += eff;
          }
          if (totalQty > 0) {
            consideredMovements.push({
              source: "loading_order",
              sourceId: o.id,
              label: o.number,
              eventId: o.eventId,
              eventName: ev?.name || null,
              direction: "outbound",
              outDate: toDayKey(outDate),
              inDate: inDate ? toDayKey(inDate) : null,
              productCount: items.length,
              totalQuantity: totalQty,
              status: o.status,
              alreadyPhysical: false,
            });
          }
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

        // Requests are netted by the larger of movement/loading coverage already
        // counted for the same (event, product).
        const reqCoverRemaining = new Map<string, number>();

        for (const r of reqRows) {
          const ev = eventMap.get(r.eventId);
          const items = itemsByRequest.get(r.id) || [];
          if (items.length === 0) continue;
          const outDate = ev?.setupDate || null;
          const inDate = ev?.teardownDate || null;
          if (!outDate) {
            conflicts.push({
              severity: "error",
              source: "request",
              sourceId: r.id,
              sourceLabel: `${r.area}`,
              message: "Requisição sem data de montagem do evento. Ignorada no cálculo.",
            });
            continue;
          }
          let totalQty = 0;
          let countedProducts = 0;
          for (const it of items) {
            if (it.approvalStatus === "rejected") continue;
            const productId = it.productId!;
            if (productFilter && !productFilter.has(productId)) continue;
            const key = `${r.eventId}::${productId}`;
            const baseQty =
              it.approvalStatus === "approved" && it.approvedQuantity != null
                ? it.approvedQuantity
                : it.quantity;
            if (baseQty <= 0) continue;
            if (!reqCoverRemaining.has(key)) {
              reqCoverRemaining.set(
                key,
                Math.max(movementOutboundQty.get(key) || 0, loadingTotalQty.get(key) || 0),
              );
            }
            const remain = reqCoverRemaining.get(key)!;
            const take = Math.min(remain, baseQty);
            if (take > 0) reqCoverRemaining.set(key, remain - take);
            const eff = baseQty - take;
            if (eff <= 0) continue; // demand already covered by loading orders / movements
            flows.push({
              productId,
              qty: eff,
              outDate,
              inDate,
              alreadyPhysical: false,
              source: "request",
              sourceId: r.id,
              label: `${ev?.name || "Evento"} · ${r.area}`,
              eventId: r.eventId,
              eventName: ev?.name || null,
              status: r.status,
            });
            totalQty += eff;
            countedProducts++;
          }
          if (totalQty > 0) {
            consideredMovements.push({
              source: "request",
              sourceId: r.id,
              label: `${ev?.name || "Evento"} · ${r.area}`,
              eventId: r.eventId,
              eventName: ev?.name || null,
              direction: "outbound",
              outDate: toDayKey(outDate),
              inDate: inDate ? toDayKey(inDate) : null,
              productCount: countedProducts,
              totalQuantity: totalQty,
              status: r.status,
              alreadyPhysical: false,
            });
          }
        }
      }

      // ── Resolve product universe ───────────────────────────────────────────
      const productIdSet = new Set<string>();
      for (const f of flows) productIdSet.add(f.productId);
      const productIds = Array.from(productIdSet);
      if (productIds.length === 0) {
        const empty: StockProjectionResult = {
          generatedAt: new Date().toISOString(),
          filters: params,
          rangeDays,
          summary: {
            totalProducts: 0,
            productsShortage: 0,
            productsLow: 0,
            productsOk: 0,
            peakShortageDate: null,
          },
          products: [],
          conflicts,
          consideredMovements,
        };
        return res.json(empty);
      }

      const productRows = await db
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
      const productMap = new Map(productRows.map((p) => [p.id, p]));

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

      for (const productId of productIds) {
        const p = productMap.get(productId);
        if (!p) continue;
        const productFlows = flowsByProduct.get(productId) || [];

        const outboundByDay = new Array(rangeDays.length).fill(0);
        const inboundByDay = new Array(rangeDays.length).fill(0);
        const reservedByDay = new Array(rangeDays.length).fill(0);
        const inEventByDay = new Array(rangeDays.length).fill(0);

        for (const f of productFlows) {
          const effOut = f.outDate;
          const effIn = f.inDate;
          // Fully returned before window → no effect on this window.
          if (effIn && effIn.getTime() < rangeStart.getTime() && (!effOut || effOut.getTime() < rangeStart.getTime())) {
            continue;
          }

          // Outbound (only for not-yet-physical flows; physical already left).
          if (effOut && !f.alreadyPhysical) {
            if (effOut.getTime() <= rangeEnd.getTime()) {
              const applyKey = effOut.getTime() < rangeStart.getTime() ? rangeDays[0] : toDayKey(effOut);
              const idx = dayIndex.get(applyKey);
              if (idx !== undefined) outboundByDay[idx] += f.qty;
            }
          }

          // Inbound (returns of any flow, including physical ones).
          if (effIn && effIn.getTime() >= rangeStart.getTime() && effIn.getTime() <= rangeEnd.getTime()) {
            const idx = dayIndex.get(toDayKey(effIn));
            if (idx !== undefined) inboundByDay[idx] += f.qty;
          }

          // Overlays per day.
          for (let i = 0; i < rangeDays.length; i++) {
            const dTime = parseDayKey(rangeDays[i]).getTime();
            const outTime = effOut ? effOut.getTime() : null;
            const inTime = effIn ? effIn.getTime() : null;
            // Reserved: committed, not yet shipped (only non-physical).
            if (!f.alreadyPhysical && outTime !== null && dTime < outTime) {
              reservedByDay[i] += f.qty;
            }
            // In event: shipped and not yet returned.
            const shipped = outTime === null ? false : dTime >= outTime;
            const returned = inTime !== null && dTime >= inTime;
            if (shipped && !returned) inEventByDay[i] += f.qty;
          }
        }

        const cells: ProjectionDayCell[] = [];
        let opening = p.currentStock || 0;
        let minAvailable = Infinity;
        let minAvailableDate: string | null = null;
        let worstStatus: ProjectionDayStatus = "ok";
        let totalOutbound = 0;
        let totalInbound = 0;
        const minimumStock = p.minimumStock || 0;

        for (let i = 0; i < rangeDays.length; i++) {
          const outbound = outboundByDay[i];
          const inbound = inboundByDay[i];
          const available = opening - outbound + inbound;
          totalOutbound += outbound;
          totalInbound += inbound;

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
            inEvent: inEventByDay[i],
            status,
          });
          opening = available;
        }

        if (minAvailable === Infinity) minAvailable = p.currentStock || 0;

        if (params.onlyShortages && worstStatus !== "shortage") continue;

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
        });

        if (worstStatus === "shortage") {
          conflicts.push({
            severity: "error",
            source: "loading_order",
            sourceId: p.id,
            sourceLabel: p.name,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            message: `Saldo negativo (${minAvailable}) previsto em ${minAvailableDate}.`,
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

      const result: StockProjectionResult = {
        generatedAt: new Date().toISOString(),
        filters: params,
        rangeDays,
        summary: {
          totalProducts: projProducts.length,
          productsShortage: projProducts.filter((p) => p.worstStatus === "shortage").length,
          productsLow: projProducts.filter((p) => p.worstStatus === "low").length,
          productsOk: projProducts.filter((p) => p.worstStatus === "ok").length,
          peakShortageDate,
        },
        products: projProducts,
        conflicts,
        consideredMovements,
      };

      res.json(result);
    } catch (error: any) {
      console.error("Stock projection error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}

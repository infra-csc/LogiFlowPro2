// Shared contract for the "Central de Projeção de Estoque".
// Used by both the server engine (server/routes-stock-projection.ts) and the
// client page (client/src/pages/stock-projection.tsx).

export interface StockProjectionInclude {
  /** Approved material requests not yet consolidated into a loading order. */
  requests?: boolean;
  /** Committed loading orders (ready / approved / in_progress). */
  loadingOrders?: boolean;
  /** Inbound supply movements (purchases/rentals) + outbound realizations. */
  movements?: boolean;
  /** Standalone trips (not linked to a loading order) carrying material. */
  trips?: boolean;
}

export interface StockProjectionParams {
  /** Inclusive range start, yyyy-MM-dd. */
  startDate: string;
  /** Inclusive range end, yyyy-MM-dd. */
  endDate: string;
  /** Limit to these events (empty/undefined = all). */
  eventIds?: string[];
  /** Limit to these products (empty/undefined = all involved). */
  productIds?: string[];
  /** Which data sources to feed into the projection. */
  include?: StockProjectionInclude;
  /** When true, only return products that hit shortage on some day. */
  onlyShortages?: boolean;
  /** When true, only return products touched by at least one flow. */
  onlyImpacted?: boolean;
  /**
   * When true, for each event override request outDate/inDate to use
   * the event's first-trip departure and last-trip return dates instead of
   * event setupDate/teardownDate.
   */
  useEventTripDates?: boolean;
}

// ── Events-with-trips query result ────────────────────────────────────────────

export interface EventTripItem {
  id: string;
  description: string | null;
  status: string;
  /** yyyy-MM-dd or null */
  departureDate: string | null;
  /** yyyy-MM-dd or null */
  returnDate: string | null;
}

export interface EventTripSummary {
  id: string;
  name: string;
  /** Earliest departure across all trips in range, yyyy-MM-dd or null */
  firstDepartureDate: string | null;
  /** Latest return across all trips in range, yyyy-MM-dd or null */
  lastReturnDate: string | null;
  trips: EventTripItem[];
  requestCount: number;
}

export interface EventsWithTripsResult {
  startDate: string;
  endDate: string;
  events: EventTripSummary[];
}

export type ProjectionDayStatus = "ok" | "low" | "shortage";

export type ProjectionSource = "request" | "loading_order" | "movement" | "trip";

export type DriverDirection = "outbound" | "inbound";

/** A single source that contributed to a day's delta (the "why" of a cell). */
export interface ProjectionDriver {
  source: ProjectionSource;
  sourceId: string;
  label: string;
  eventId: string | null;
  eventName: string | null;
  direction: DriverDirection;
  /** Always positive; direction encodes the sign. */
  qty: number;
}

export interface ProjectionDayCell {
  date: string; // yyyy-MM-dd
  opening: number; // available at the start of the day
  inbound: number; // returns / supply arriving this day
  outbound: number; // shipments leaving this day
  available: number; // closing balance = opening - outbound + inbound
  reserved: number; // committed but not yet shipped as of this day
  inTransit: number; // shipped, not yet arrived at destination as of this day
  inEvent: number; // arrived and not yet returned as of this day
  status: ProjectionDayStatus;
  /** Sources that produced this day's inbound/outbound deltas. */
  drivers: ProjectionDriver[];
}

export interface ProjectionProduct {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  days: ProjectionDayCell[];
  minAvailable: number; // worst (lowest) available across the range
  minAvailableDate: string | null;
  worstStatus: ProjectionDayStatus;
  totalOutbound: number;
  totalInbound: number;
  /** Peak units simultaneously in-event over the range (0 when none). */
  totalInEvent: number;
  /** Largest shortfall below zero across the range (0 when never negative). */
  maxDeficit: number;
}

/** Where a conflict link points (used to render "open X" buttons). */
export interface ProjectionLink {
  type: "event" | "loading_order" | "movement" | "product" | "trip" | "request";
  id: string;
  label: string;
  href?: string;
}

export interface ProjectionConflict {
  severity: "error" | "warning";
  /** shortage = projected negative; missing_data = undateable; ambiguous = multi-event. */
  kind: "shortage" | "missing_data" | "ambiguous";
  source: ProjectionSource;
  sourceId: string;
  sourceLabel: string;
  productId?: string;
  productName?: string;
  sku?: string;
  date?: string | null;
  projectedBalance?: number;
  minimumStock?: number;
  deficit?: number;
  eventId?: string | null;
  eventName?: string | null;
  message: string;
  /** Operational suggestion (human text), e.g. "Comprar/alugar 8 unidades". */
  suggestedAction?: string;
  links?: ProjectionLink[];
}

export interface ConsideredMovementProduct {
  productId: string;
  name: string;
  sku: string;
  qty: number;
}

/**
 * considered = fully counted; partial = some qty netted by higher precedence;
 * ignored = fully covered by higher precedence / nothing left; no_date = skipped
 * for lack of a usable date.
 */
export type ConsideredSituation = "considered" | "partial" | "ignored" | "no_date";

export interface ConsideredMovement {
  source: ProjectionSource;
  sourceId: string;
  label: string;
  eventId: string | null;
  eventName: string | null;
  direction: "outbound" | "inbound";
  outDate: string | null;
  inDate: string | null;
  productCount: number;
  totalQuantity: number;
  status: string;
  /** True when the stock already physically moved (already in currentStock). */
  alreadyPhysical: boolean;
  situation: ConsideredSituation;
  products: ConsideredMovementProduct[];
  href?: string;
}

export interface StockProjectionSummary {
  totalProducts: number;
  productsShortage: number;
  productsLow: number;
  productsOk: number;
  peakShortageDate: string | null;
  totalOutbound: number;
  totalInbound: number;
  /** Sum across products of their peak reserved quantity over the range. */
  totalReserved: number;
  /** Sum across products of their peak in-event quantity over the range. */
  totalInEvent: number;
}

export interface StockProjectionResult {
  generatedAt: string;
  /** Human description of what the projection was built from. */
  calculationBase: string;
  filters: StockProjectionParams;
  rangeDays: string[]; // ordered yyyy-MM-dd within the range
  summary: StockProjectionSummary;
  products: ProjectionProduct[];
  conflicts: ProjectionConflict[];
  consideredMovements: ConsideredMovement[];
  /** Non-fatal notices (entities skipped, caps applied, etc.). */
  warnings: string[];
}

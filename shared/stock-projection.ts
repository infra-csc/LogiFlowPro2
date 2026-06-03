// Shared contract for the "Central de Projeção de Estoque" (Phase 1).
// Used by both the server engine (server/routes-stock-projection.ts) and the
// client page (client/src/pages/stock-projection.tsx).

export interface StockProjectionInclude {
  /** Approved material requests not yet consolidated into a loading order. */
  requests?: boolean;
  /** Committed loading orders (ready / approved / in_progress). */
  loadingOrders?: boolean;
  /** Inbound supply movements (purchases/rentals) + outbound realizations. */
  movements?: boolean;
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
}

export type ProjectionDayStatus = "ok" | "low" | "shortage";

export interface ProjectionDayCell {
  date: string; // yyyy-MM-dd
  opening: number; // available at the start of the day
  inbound: number; // returns / supply arriving this day
  outbound: number; // shipments leaving this day
  available: number; // closing balance = opening - outbound + inbound
  reserved: number; // committed but not yet shipped as of this day
  inEvent: number; // shipped and not yet returned as of this day
  status: ProjectionDayStatus;
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
}

export type ProjectionSource = "request" | "loading_order" | "movement" | "trip";

export interface ProjectionConflict {
  severity: "error" | "warning";
  source: ProjectionSource;
  sourceId: string;
  sourceLabel: string;
  productId?: string;
  productName?: string;
  sku?: string;
  message: string;
}

export interface ConsideredMovement {
  source: "request" | "loading_order" | "movement";
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
}

export interface StockProjectionSummary {
  totalProducts: number;
  productsShortage: number;
  productsLow: number;
  productsOk: number;
  peakShortageDate: string | null;
}

export interface StockProjectionResult {
  generatedAt: string;
  filters: StockProjectionParams;
  rangeDays: string[]; // ordered yyyy-MM-dd within the range
  summary: StockProjectionSummary;
  products: ProjectionProduct[];
  conflicts: ProjectionConflict[];
  consideredMovements: ConsideredMovement[];
}

/**
 * Derived physical progress of a material request.
 *
 * Background: the request lifecycle (requestStatusEnum) models a long pipeline
 * — in_picking, loaded, in_transit, in_use … — but the backend only ever sets
 * draft / pending_approval / approved / rejected. Once approved, a request
 * never advances, even though the physical work (loading orders, trips) is
 * tracked separately. So the stored status cannot answer "has this request's
 * material actually been loaded and shipped yet?".
 *
 * This module answers that question WITHOUT touching stored state: it derives
 * an advisory progress from the statuses of the loading orders and trips
 * linked to the request. It is read-only and never persisted, so a wrong label
 * is a display issue, never data corruption. The rules live here as one pure,
 * unit-tested function so they are reviewable and easy to adjust.
 *
 * This is deliberately a SEPARATE concept from the official request status:
 * the stored status says where the request is in the approval workflow; this
 * says how far its material has physically moved. The UI should present it as
 * such ("Progresso físico"), not as the request status.
 */

export type RequestProgress =
  | "awaiting" // approved, nothing started downstream
  | "preparing" // a loading order is being assembled
  | "loaded" // material is loaded, not yet moving
  | "in_transit" // on the road / at destination / unloading
  | "delivered"; // all linked trips completed

export const REQUEST_PROGRESS_LABELS: Record<RequestProgress, string> = {
  awaiting: "Aguardando preparação",
  preparing: "Em preparação",
  loaded: "Carregado",
  in_transit: "Em trânsito",
  delivered: "Entregue",
};

// Higher rank = further along. `deriveRequestProgress` takes the max across all
// linked orders/trips, so the request reflects the most-advanced fulfillment.
const PROGRESS_RANK: Record<RequestProgress, number> = {
  awaiting: 0,
  preparing: 1,
  loaded: 2,
  in_transit: 3,
  delivered: 4,
};

function loadingOrderProgress(status: string): RequestProgress {
  switch (status) {
    case "in_progress":
      return "preparing";
    case "completed":
      return "loaded"; // order fully assembled onto a vehicle
    // draft / ready / approved / cancelled: not started physically
    default:
      return "awaiting";
  }
}

function tripProgress(status: string): RequestProgress {
  switch (status) {
    case "loading":
      return "preparing";
    case "loaded":
      return "loaded";
    case "in_transit":
    case "at_destination":
    case "unloading":
      return "in_transit";
    case "completed":
      return "delivered";
    // planned: scheduled but not started
    default:
      return "awaiting";
  }
}

export interface RequestDownstream {
  loadingOrderStatuses: string[];
  tripStatuses: string[];
}

/**
 * Derive physical progress for an APPROVED request from its downstream links.
 *
 * Returns `null` when the request is not yet in fulfillment (draft,
 * pending_approval, rejected) — those are pure workflow states with no physical
 * progress to show. For an approved request with no linked orders/trips the
 * result is `"awaiting"`.
 */
export function deriveRequestProgress(
  requestStatus: string,
  downstream: RequestDownstream
): RequestProgress | null {
  if (requestStatus !== "approved") return null;

  const candidates: RequestProgress[] = [
    ...downstream.loadingOrderStatuses.map(loadingOrderProgress),
    ...downstream.tripStatuses.map(tripProgress),
  ];

  if (candidates.length === 0) return "awaiting";

  return candidates.reduce((best, cur) =>
    PROGRESS_RANK[cur] > PROGRESS_RANK[best] ? cur : best
  );
}

import { describe, it, expect } from "vitest";
import { deriveRequestProgress, REQUEST_PROGRESS_LABELS } from "./request-progress";

const none = { loadingOrderStatuses: [], tripStatuses: [] };

describe("deriveRequestProgress", () => {
  it("returns null for statuses that are not yet in fulfillment", () => {
    for (const s of ["draft", "pending_approval", "rejected"]) {
      expect(deriveRequestProgress(s, none)).toBeNull();
    }
  });

  it("is 'awaiting' for an approved request with nothing downstream", () => {
    expect(deriveRequestProgress("approved", none)).toBe("awaiting");
  });

  it("reflects a loading order being assembled", () => {
    expect(
      deriveRequestProgress("approved", { loadingOrderStatuses: ["in_progress"], tripStatuses: [] })
    ).toBe("preparing");
  });

  it("treats a completed loading order as loaded", () => {
    expect(
      deriveRequestProgress("approved", { loadingOrderStatuses: ["completed"], tripStatuses: [] })
    ).toBe("loaded");
  });

  it("reflects a trip in transit", () => {
    for (const s of ["in_transit", "at_destination", "unloading"]) {
      expect(
        deriveRequestProgress("approved", { loadingOrderStatuses: [], tripStatuses: [s] })
      ).toBe("in_transit");
    }
  });

  it("is 'delivered' only when a trip is completed", () => {
    expect(
      deriveRequestProgress("approved", { loadingOrderStatuses: [], tripStatuses: ["completed"] })
    ).toBe("delivered");
  });

  it("takes the most-advanced state across mixed downstream links", () => {
    // One order still preparing, one trip already in transit -> in_transit wins.
    expect(
      deriveRequestProgress("approved", {
        loadingOrderStatuses: ["in_progress", "draft"],
        tripStatuses: ["planned", "in_transit"],
      })
    ).toBe("in_transit");
  });

  it("does not regress to an earlier stage because of a not-started sibling", () => {
    // A freshly added planned trip must not pull a loaded request backwards.
    expect(
      deriveRequestProgress("approved", {
        loadingOrderStatuses: ["completed"],
        tripStatuses: ["planned"],
      })
    ).toBe("loaded");
  });

  it("ignores cancelled/draft orders as not-started rather than advancing", () => {
    expect(
      deriveRequestProgress("approved", {
        loadingOrderStatuses: ["cancelled", "ready", "approved"],
        tripStatuses: [],
      })
    ).toBe("awaiting");
  });

  it("has a pt-BR label for every progress value", () => {
    for (const key of ["awaiting", "preparing", "loaded", "in_transit", "delivered"] as const) {
      expect(REQUEST_PROGRESS_LABELS[key]).toBeTruthy();
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  applyPurchaseItemSnapshot,
  getPurchaseItemDetails,
} from "../../../src/services/PurchaseRefundService";

describe("PurchaseRefundService item snapshots", () => {
  it("prefers the stored item title when the linked event is unavailable", () => {
    const details = getPurchaseItemDetails({
      purchaseType: "event",
      itemTitle: "Spring Retreat",
      itemLabel: "Event",
    });

    expect(details).toEqual({
      itemType: "event",
      itemLabel: "Event",
      itemTitle: "Spring Retreat",
    });
  });

  it("captures the linked membership title before refund flows detach access", () => {
    const purchase = {
      purchaseType: "membership" as const,
      membershipId: { title: "2026-2027 NextGen Annual Membership" },
    };

    const changed = applyPurchaseItemSnapshot(purchase);

    expect(changed).toBe(true);
    expect(purchase.itemTitle).toBe("2026-2027 NextGen Annual Membership");
    expect(purchase.itemLabel).toBe("Annual Membership");
  });

  it("falls back to the type label when no title can be recovered", () => {
    const purchase = {
      purchaseType: "program" as const,
    };

    applyPurchaseItemSnapshot(purchase);

    expect(purchase.itemTitle).toBe("Program");
    expect(purchase.itemLabel).toBe("Program");
  });
});

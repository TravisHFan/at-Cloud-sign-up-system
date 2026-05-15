import Program from "../models/Program";
import type { IPurchase } from "../models/Purchase";

export const REFUND_WINDOW_DAYS = 30;

export type RefundEligibility = {
  isEligible: boolean;
  requiresApproval: boolean;
  reason?: string;
  daysRemaining?: number;
  purchaseDate: Date;
  refundDeadline: Date;
  refundWindowExpired: boolean;
};

export type PurchaseItemDetails = {
  itemTitle: string;
  itemLabel: "Program" | "Event";
  itemType: "program" | "event";
};

export type ProgramUnenrollReason =
  | "self_unenroll_refund"
  | "self_unenroll_no_refund"
  | "refund_requested";

function getReferenceId(value: unknown): unknown {
  if (value && typeof value === "object" && "_id" in value) {
    return (value as { _id: unknown })._id;
  }
  return value;
}

export function getPurchaseItemDetails(purchase: {
  purchaseType?: "program" | "event";
  programId?: unknown;
  eventId?: unknown;
}): PurchaseItemDetails {
  const itemType = purchase.purchaseType === "event" ? "event" : "program";
  const itemLabel = itemType === "event" ? "Event" : "Program";
  const linkedItem =
    itemType === "event" ? purchase.eventId : purchase.programId;

  const itemTitle =
    linkedItem &&
    typeof linkedItem === "object" &&
    "title" in linkedItem &&
    typeof linkedItem.title === "string" &&
    linkedItem.title.trim()
      ? linkedItem.title
      : itemLabel;

  return { itemTitle, itemLabel, itemType };
}

export function calculateRefundEligibility(purchase: {
  status?: string;
  purchaseDate: Date | string;
  finalPrice?: number;
  stripePaymentIntentId?: string;
}): RefundEligibility {
  const now = new Date();
  const purchaseDate = new Date(purchase.purchaseDate);
  const refundDeadline = new Date(purchaseDate);
  refundDeadline.setDate(refundDeadline.getDate() + REFUND_WINDOW_DAYS);
  const refundWindowExpired = now > refundDeadline;

  const daysElapsed = Math.floor(
    (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const daysRemaining = Math.max(0, REFUND_WINDOW_DAYS - daysElapsed);

  if (
    purchase.status !== "completed" &&
    purchase.status !== "refund_failed"
  ) {
    return {
      isEligible: false,
      requiresApproval: false,
      reason: `Purchase status is "${purchase.status}". Only completed purchases can be refunded.`,
      purchaseDate,
      refundDeadline,
      refundWindowExpired,
    };
  }

  if ((purchase.finalPrice || 0) <= 0) {
    return {
      isEligible: false,
      requiresApproval: false,
      reason: "No payment was collected for this purchase, so there is no refund to issue.",
      purchaseDate,
      refundDeadline,
      refundWindowExpired,
    };
  }

  if (!purchase.stripePaymentIntentId) {
    return {
      isEligible: false,
      requiresApproval: false,
      reason: "No card payment was found for this purchase, so an automatic refund is not available.",
      purchaseDate,
      refundDeadline,
      refundWindowExpired,
    };
  }

  if (refundWindowExpired) {
    return {
      isEligible: false,
      requiresApproval: true,
      reason: `Refund window has expired. Refunds are only available within ${REFUND_WINDOW_DAYS} days of purchase.`,
      daysRemaining: 0,
      purchaseDate,
      refundDeadline,
      refundWindowExpired,
    };
  }

  return {
    isEligible: true,
    requiresApproval: false,
    reason: `You have ${daysRemaining} day${
      daysRemaining !== 1 ? "s" : ""
    } remaining to request a refund.`,
    daysRemaining,
    purchaseDate,
    refundDeadline,
    refundWindowExpired,
  };
}

export async function markProgramPurchaseUnenrolled(
  purchase: IPurchase,
  reason: ProgramUnenrollReason,
  unenrolledAt = new Date(),
): Promise<boolean> {
  const programId = getReferenceId(purchase.programId);

  if (purchase.unenrolledAt) {
    return false;
  }

  purchase.unenrolledAt = unenrolledAt;
  purchase.unenrollReason = reason;

  if (purchase.purchaseType === "program" && programId && purchase.isClassRep) {
    await Program.findOneAndUpdate(
      {
        _id: programId,
        classRepCount: { $gt: 0 },
      },
      { $inc: { classRepCount: -1 } },
      { runValidators: false },
    );
  }

  return true;
}

export const markPurchaseUnenrolled = markProgramPurchaseUnenrolled;

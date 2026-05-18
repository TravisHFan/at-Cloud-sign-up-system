import dotenv from "dotenv";
import mongoose from "mongoose";
import { Purchase } from "../../models";
import { applyPurchaseItemSnapshot } from "../../services/PurchaseRefundService";

dotenv.config();

async function migratePurchaseItemSnapshots(): Promise<void> {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
  await mongoose.connect(mongoUri);

  try {
    const purchases = await Purchase.find({
      $or: [
        { itemTitle: { $exists: false } },
        { itemTitle: "" },
        { itemLabel: { $exists: false } },
      ],
    })
      .populate("programId", "title")
      .populate("eventId", "title")
      .populate("membershipId", "title");

    let migratedCount = 0;
    for (const purchase of purchases) {
      if (applyPurchaseItemSnapshot(purchase)) {
        await purchase.save();
        migratedCount += 1;
      }
    }

    console.log(`Backfilled item snapshots for ${migratedCount} purchase(s).`);
  } finally {
    await mongoose.connection.close();
  }
}

export { migratePurchaseItemSnapshots };

if (require.main === module) {
  migratePurchaseItemSnapshots()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Purchase item snapshot migration failed:", error);
      process.exit(1);
    });
}

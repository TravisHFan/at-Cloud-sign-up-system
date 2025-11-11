/**
 * Fix pending recurring donation by manually updating status and recording transaction
 * Run with: npx ts-node scripts/fix-pending-donation.ts <donationId>
 */

import mongoose from "mongoose";
import Donation from "../src/models/Donation";
import DonationService from "../src/services/DonationService";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

async function fixPendingDonation(donationId: string) {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Find the donation
    const donation = await Donation.findById(donationId);
    if (!donation) {
      console.error(`Donation ${donationId} not found`);
      process.exit(1);
    }

    console.log("Found donation:", {
      _id: donation._id,
      type: donation.type,
      amount: donation.amount,
      status: donation.status,
      stripeSubscriptionId: donation.stripeSubscriptionId,
    });

    // Check if it's a recurring donation
    if (donation.type !== "recurring") {
      console.log("This is not a recurring donation");
      process.exit(0);
    }

    // Check if it has a subscription ID (meaning checkout completed)
    if (
      donation.stripeSubscriptionId &&
      donation.stripeSubscriptionId !== "pending"
    ) {
      console.log(
        `Donation already has subscription ID: ${donation.stripeSubscriptionId}`
      );

      // Update status to active
      donation.status = "active";
      donation.lastGiftDate = new Date();
      await donation.save();
      console.log("✅ Updated donation status to active");

      // Record first transaction if not exists
      try {
        await DonationService.recordTransaction({
          donationId: (donation._id as mongoose.Types.ObjectId).toString(),
          userId: (donation.userId as mongoose.Types.ObjectId).toString(),
          amount: donation.amount,
          type: donation.type,
          stripePaymentIntentId: `manual_fix_${Date.now()}`,
          paymentMethod: donation.paymentMethod,
        });
        console.log("✅ Recorded first transaction");
      } catch (error) {
        console.log(
          "Transaction might already exist:",
          (error as Error).message
        );
      }
    } else {
      console.log(
        "⚠️  Donation doesn't have a subscription ID yet - checkout might not have completed"
      );
      console.log("Check Stripe dashboard to see if subscription was created");
    }

    await mongoose.disconnect();
    console.log("\n✅ Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Get donation ID from command line
const donationId = process.argv[2];
if (!donationId) {
  console.error(
    "Usage: npx ts-node scripts/fix-pending-donation.ts <donationId>"
  );
  process.exit(1);
}

fixPendingDonation(donationId);

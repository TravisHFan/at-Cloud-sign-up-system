import mongoose, { Schema, Document, Model } from "mongoose";

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Bundle Discount Configuration
 * Settings for auto-generating promo codes after purchases
 */
export interface IBundleDiscountConfig {
  enabled: boolean; // Feature enabled/disabled
  discountAmount: number; // Dollar amount in cents (e.g., 5000 = $50)
  expiryDays: number; // Days until bundle code expires (e.g., 30)
}

/**
 * System Configuration Document
 * Stores system-wide settings in MongoDB
 */
export interface ISystemConfig extends Document {
  key: string; // Unique identifier for this config (e.g., "bundle_discount_config")
  value: Record<string, unknown>; // Configuration value (flexible JSON structure)
  description?: string; // Human-readable description of this setting
  updatedBy?: string; // User/admin who last updated this config
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
interface ISystemConfigModel extends Model<ISystemConfig> {
  getBundleDiscountConfig(): Promise<IBundleDiscountConfig>;
  updateBundleDiscountConfig(
    config: IBundleDiscountConfig,
    updatedBy: string
  ): Promise<ISystemConfig>;
  initializeDefaults(): Promise<void>;
}

// ============================================================================
// SCHEMA
// ============================================================================

const SystemConfigSchema = new Schema<ISystemConfig, ISystemConfigModel>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    updatedBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    collection: "systemconfigs",
  }
);

// ============================================================================
// INDEXES
// ============================================================================

// Primary lookup index (unique key)
SystemConfigSchema.index({ key: 1 }, { unique: true });

// ============================================================================
// STATIC METHODS
// ============================================================================

/**
 * Get bundle discount configuration
 * Returns default values if not found in database
 */
SystemConfigSchema.statics.getBundleDiscountConfig =
  async function (): Promise<IBundleDiscountConfig> {
    const config = await this.findOne({ key: "bundle_discount_config" });

    if (config && config.value) {
      // Return database config
      return {
        enabled: (config.value.enabled as boolean) ?? true,
        discountAmount: (config.value.discountAmount as number) ?? 5000,
        expiryDays: (config.value.expiryDays as number) ?? 30,
      };
    }

    // Return default values if not in database
    return {
      enabled: true,
      discountAmount: 5000, // $50.00
      expiryDays: 30,
    };
  };

/**
 * Update bundle discount configuration
 * Creates config if it doesn't exist
 */
SystemConfigSchema.statics.updateBundleDiscountConfig = async function (
  config: IBundleDiscountConfig,
  updatedBy: string
): Promise<ISystemConfig> {
  // Validate config
  if (typeof config.enabled !== "boolean") {
    throw new Error("enabled must be a boolean");
  }

  if (
    typeof config.discountAmount !== "number" ||
    config.discountAmount < 1000 ||
    config.discountAmount > 20000
  ) {
    throw new Error(
      "discountAmount must be between 1000 and 20000 (10 and 200 dollars)"
    );
  }

  if (
    typeof config.expiryDays !== "number" ||
    config.expiryDays < 7 ||
    config.expiryDays > 365
  ) {
    throw new Error("expiryDays must be between 7 and 365");
  }

  // Update or create config
  const updated = await this.findOneAndUpdate(
    { key: "bundle_discount_config" },
    {
      key: "bundle_discount_config",
      value: {
        enabled: config.enabled,
        discountAmount: config.discountAmount,
        expiryDays: config.expiryDays,
      },
      description: "Bundle discount auto-generation configuration",
      updatedBy,
    },
    {
      upsert: true, // Create if doesn't exist
      new: true, // Return updated document
      runValidators: true,
    }
  );

  if (!updated) {
    throw new Error("Failed to update bundle discount configuration");
  }

  return updated;
};

/**
 * Initialize default configurations
 * Called on server startup to ensure default configs exist
 */
SystemConfigSchema.statics.initializeDefaults =
  async function (): Promise<void> {
    // Check if bundle discount config exists
    const bundleConfig = await this.findOne({ key: "bundle_discount_config" });

    if (!bundleConfig) {
      console.log("📝 Initializing default bundle discount configuration...");

      // Check if env vars are set (migration from Todo #15)
      const envEnabled = process.env.BUNDLE_DISCOUNT_ENABLED !== "false";
      const envAmount = parseInt(
        process.env.BUNDLE_DISCOUNT_AMOUNT || "5000",
        10
      );
      const envDays = parseInt(process.env.BUNDLE_EXPIRY_DAYS || "30", 10);

      // Create default config (use env vars if present for migration)
      await this.create({
        key: "bundle_discount_config",
        value: {
          enabled: envEnabled,
          discountAmount: envAmount,
          expiryDays: envDays,
        },
        description: "Bundle discount auto-generation configuration",
        updatedBy: "system",
      });

      console.log(
        `✅ Bundle discount config initialized: enabled=${envEnabled}, amount=$${
          envAmount / 100
        }, expiryDays=${envDays}`
      );

      // Log migration message if env vars were used
      if (
        process.env.BUNDLE_DISCOUNT_ENABLED ||
        process.env.BUNDLE_DISCOUNT_AMOUNT ||
        process.env.BUNDLE_EXPIRY_DAYS
      ) {
        console.log(
          "📦 Migrated bundle config from environment variables to database."
        );
        console.log(
          "💡 You can now safely remove BUNDLE_DISCOUNT_* env vars from .env file."
        );
      }
    }
  };

// ============================================================================
// MODEL EXPORT
// ============================================================================

export const SystemConfig = (mongoose.models.SystemConfig ||
  mongoose.model<ISystemConfig, ISystemConfigModel>(
    "SystemConfig",
    SystemConfigSchema
  )) as ISystemConfigModel;

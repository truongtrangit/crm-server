const mongoose = require("mongoose");
const {
  WEBHOOK_EVENT_TYPE_LIST,
} = require("../constants/webhookEvents");

const WEBHOOK_STATUSES = ["received", "processing", "processed", "failed"];

const webhookLogSchema = new mongoose.Schema(
  {
    /**
     * Delivery ID from 3rd party — used for idempotency.
     * Optional: field is absent when 3rd party doesn't provide one.
     * Sparse unique index: only enforces uniqueness on docs where field exists.
     */
    deliveryId: {
      type: String, index: {
        unique: true,
        partialFilterExpression: {
          deliveryId: { $type: "string" }
        }
      }
    },

    /** Event type — matches EVENT_GROUP_IDS */
    eventType: {
      type: String,
      enum: WEBHOOK_EVENT_TYPE_LIST,
      required: true,
    },

    /** Source identifier — which 3rd-party service sent this */
    source: { type: String, default: "external" },

    /**
     * Raw payload from 3rd party.
     * Using Mixed type because payload structure varies per eventType.
     * This allows maximum flexibility without schema changes.
     */
    payload: { type: mongoose.Schema.Types.Mixed, required: true },

    /** Processing status */
    status: {
      type: String,
      enum: WEBHOOK_STATUSES,
      default: "received",
    },

    /** Error message if processing failed */
    error: { type: String, default: null },

    /** When the event was successfully processed */
    processedAt: { type: Date, default: null },

    /** IP address of the sender */
    ipAddress: { type: String, default: "" },

    /** ID of the Event created from this webhook (if any) */
    createdEventId: { type: String, default: null },

    /** ID of the Customer created/updated from this webhook (if any) */
    createdCustomerId: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Index for querying by status + date for monitoring/retry
webhookLogSchema.index({ status: 1, createdAt: -1 });
webhookLogSchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model("WebhookLog", webhookLogSchema);

const mongoose = require("mongoose");

/**
 * AutomationLog — Records every Block Automation execution.
 *
 * Captures the full execution context: which event/chain/action triggered it,
 * what payload was sent, what response was received, and whether it succeeded.
 * Append-only audit trail — never update or delete logs.
 */
const automationLogSchema = new mongoose.Schema(
  {
    /** Event context */
    eventId: { type: String, required: true },
    eventName: { type: String, default: "" },

    /** Chain context */
    chainId: { type: String, default: null },
    chainName: { type: String, default: "" },

    /** Action that triggered this */
    actionId: { type: String, default: null },
    actionName: { type: String, default: "" },

    /** Block Automation config used */
    blockAutomationId: { type: String, default: null },
    blockAutomationName: { type: String, default: "" },

    /** HTTP request details */
    url: { type: String, default: "" },
    method: { type: String, default: "POST" },

    /** Resolved payload sent to third-party */
    resolvedPayload: { type: mongoose.Schema.Types.Mixed, default: null },

    /** HTTP response */
    responseStatus: { type: Number, default: null },
    responseStatusText: { type: String, default: null },
    responseData: { type: mongoose.Schema.Types.Mixed, default: null },

    /** Who triggered the execution */
    performedBy: {
      userId: { type: String, default: null },
      userName: { type: String, default: "System" },
      userAvatar: { type: String, default: "" },
    },

    /** Outcome */
    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
    },

    /** Error message if failed */
    error: { type: String, default: null },

    /** Execution duration in milliseconds */
    duration: { type: Number, default: 0 },

    /** The attempt number for this block automation */
    attemptCount: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Indexes for common queries
automationLogSchema.index({ createdAt: -1 });
automationLogSchema.index({ eventId: 1, createdAt: -1 });
automationLogSchema.index({ blockAutomationId: 1, createdAt: -1 });
automationLogSchema.index({ status: 1, createdAt: -1 });
automationLogSchema.index({ "performedBy.userId": 1, createdAt: -1 });

module.exports = mongoose.model("AutomationLog", automationLogSchema);

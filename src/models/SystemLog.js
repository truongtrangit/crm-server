const mongoose = require("mongoose");

/**
 * SystemLog — Records all CRUD and system-level operations.
 *
 * Captures who did what, when, to which resource, and whether it succeeded.
 * This is an append-only audit trail — never update or delete logs.
 */

const SYSTEM_LOG_ACTIONS = [
  "create", "update", "delete", "restore",
  "login", "logout",
  "force_delete", "assign", "unassign",
  "activate", "deactivate",
  "other",
];

const { RESOURCES } = require("../constants/rbac");

/**
 * Valid resource values — derived from RBAC RESOURCES constant.
 * "other" is added as a catch-all for edge cases.
 */
const SYSTEM_LOG_RESOURCES = [...Object.values(RESOURCES), "other"];

const systemLogSchema = new mongoose.Schema(
  {
    /** CRUD action performed */
    action: {
      type: String,
      enum: SYSTEM_LOG_ACTIONS,
      required: true,
    },

    /** Resource type affected */
    resource: {
      type: String,
      enum: SYSTEM_LOG_RESOURCES,
      required: true,
    },

    /** ID of the affected resource */
    resourceId: { type: String, default: null },

    /** Human-readable name snapshot of the resource at time of action */
    resourceName: { type: String, default: "" },

    /** Human-readable description of what happened */
    description: { type: String, default: "" },

    /** Who performed the action */
    performedBy: {
      userId: { type: String, default: null },
      userName: { type: String, default: "System" },
      userAvatar: { type: String, default: "" },
    },

    /** Outcome */
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },

    /** Error message if failed */
    error: { type: String, default: null },

    /** Optional extra context (e.g. changed fields, old values) */
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },

    /** IP address of the requester */
    ipAddress: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Indexes for common queries
systemLogSchema.index({ createdAt: -1 });
systemLogSchema.index({ resource: 1, createdAt: -1 });
systemLogSchema.index({ action: 1, createdAt: -1 });
systemLogSchema.index({ "performedBy.userId": 1, createdAt: -1 });
systemLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("SystemLog", systemLogSchema);

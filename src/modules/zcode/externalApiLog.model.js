const mongoose = require('mongoose');

/**
 * ExternalApiLog — Audit trail for all external API requests.
 *
 * Captures request details, security validation results, response,
 * and timing information. Documents auto-expire after 90 days.
 */
const externalApiLogSchema = new mongoose.Schema(
  {
    /** HTTP method */
    method: { type: String, required: true },

    /** Request path */
    path: { type: String, required: true },

    /** External system name */
    system: { type: String, default: 'ZCODE' },

    /** Caller IP (from CF-Connecting-IP or X-Forwarded-For) */
    callerIp: { type: String, default: '' },

    /** Security validation results */
    apiKeyValid: { type: Boolean, default: false },

    /** Idempotency key (if provided) */
    idempotencyKey: { type: String, default: null },
    idempotentHit: { type: Boolean, default: false },

    /** Request body (sanitized — no sensitive data) */
    requestBody: { type: mongoose.Schema.Types.Mixed, default: null },

    /** Response */
    responseStatus: { type: Number, default: null },
    responseCode: { type: String, default: null },

    /** Processing duration in milliseconds */
    durationMs: { type: Number, default: null },

    /** Error message if request failed */
    error: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// TTL index — auto-delete after 90 days
externalApiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
// Query indexes
externalApiLogSchema.index({ system: 1, createdAt: -1 });
externalApiLogSchema.index({ callerIp: 1, createdAt: -1 });

module.exports = mongoose.model('ExternalApiLog', externalApiLogSchema);

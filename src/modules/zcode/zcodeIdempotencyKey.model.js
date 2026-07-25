const mongoose = require('mongoose');

/**
 * ZCodeIdempotencyKey — Stores processed external API request keys
 * to prevent duplicate processing on retries.
 *
 * Documents auto-expire after 24 hours via TTL index.
 */
const zcodeIdempotencyKeySchema = new mongoose.Schema(
  {
    /** The idempotency key from X-Idempotency-Key header */
    key: {
      type: String,
      required: true,
      unique: true,
    },

    /** Cached HTTP status code */
    responseStatus: {
      type: Number,
      required: true,
    },

    /** Cached response body */
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// TTL index — auto-delete after 24 hours
zcodeIdempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('ZCodeIdempotencyKey', zcodeIdempotencyKeySchema);

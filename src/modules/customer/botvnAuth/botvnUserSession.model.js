const mongoose = require("mongoose");

const botvnUserSessionSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    sessionId: { type: String, required: true, unique: true },
    accessTokenHash: { type: String, required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    accessTokenExpiresAt: { type: Date, required: true },
    refreshTokenExpiresAt: { type: Date, required: true },
    userAgent: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    lastUsedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// TTL index to automatically remove expired sessions
botvnUserSessionSchema.index({ refreshTokenExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("BotvnUserSession", botvnUserSessionSchema);

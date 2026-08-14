const mongoose = require("mongoose");

const actionResultSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    status: { type: String, enum: ["SUCCESS", "FAILED"], required: true },
    error: { type: String, default: null },
    // References to created entities
    eventId: { type: String, default: null },
    leadId: { type: String, default: null },
    taskId: { type: String, default: null },
  },
  { _id: false }
);

const integrationLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },

    // The config that triggered this log. Null if no config matched.
    configId: { type: String, ref: "IntegrationConfig", default: null },

    source: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: ["SUCCESS", "PARTIAL", "FAILED", "NO_CONFIG"],
      required: true,
      index: true,
    },

    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: null },

    actionResults: [actionResultSchema],

    // Useful to auto-delete old logs
    createdAt: { type: Date, default: Date.now, expires: "30d" },
  },
  { timestamps: false, versionKey: false, id: false }
);

module.exports = mongoose.model("IntegrationLog", integrationLogSchema);

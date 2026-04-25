const mongoose = require("mongoose");

/**
 * Counter — Monotonic auto-increment counter for resource IDs.
 *
 * Each document represents a prefix (e.g. "USER", "EVT", "CUST")
 * and holds the current sequence number. The counter only ever
 * increments, ensuring IDs are never reused even after deletion.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // prefix, e.g. "USER", "EVT"
    seq: { type: Number, default: 0 },
  },
  {
    versionKey: false,
  },

);

module.exports = mongoose.model("Counter", counterSchema);

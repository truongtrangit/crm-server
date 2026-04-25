const Counter = require("../models/Counter");

/**
 * Generate a monotonic ID that never decreases.
 * Uses an atomic findByIdAndUpdate + $inc to guarantee uniqueness
 * even under concurrent requests. No padding — produces USER1, USER2, etc.
 *
 * @param {string} prefix - e.g. "USER", "EVT", "CUST"
 * @returns {Promise<string>} - e.g. "USER1", "EVT42"
 */
async function generateMonotonicId(prefix) {
  const counter = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `${prefix}${counter.seq}`;
}

/**
 * Generate a monotonic task ID: #00001, #00002, ...
 *
 * @returns {Promise<string>}
 */
async function generateTaskId() {
  const counter = await Counter.findByIdAndUpdate(
    "TASK",
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `#${String(counter.seq).padStart(5, "0")}`;
}

module.exports = {
  generateMonotonicId,
  generateTaskId,
};

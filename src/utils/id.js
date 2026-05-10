const Counter = require("../models/Counter");

/**
 * ─── ID Prefixes ─────────────────────────────────────────────────────────────
 * Central registry of all resource ID prefixes.
 * Add new resources here to keep them discoverable and consistent.
 */
const ID_PREFIXES = Object.freeze({
  USER: "USER",
  CUSTOMER: "CUST",
  EVENT: "EVT",
  LEAD: "LEAD",
  SUBSCRIPTION: "SUB",

  // Action Config
  ACTION: "ACT",
  RESULT: "RES",
  REASON: "RSN",
  CHAIN: "CHN",
  BLOCK_AUTOMATION: "BLK",

  // Staff / Org
  FUNCTION: "FUNC",

  // Meta
  META_CONFIG: "MCFG",
  META_PROGRAM: "META",

  // Task
  TASK: "TASK",

  // Lead Config
  LEAD_STATUS: "LS",
  LEAD_STATUS_GROUP: "LSG",

  // Funnel
  FUNNEL_FOLDER: "FFOL",
  FUNNEL_GROUP: "FGRP",
  FUNNEL: "FNL",
});

/**
 * Generate a monotonic ID that never decreases.
 * Uses an atomic findByIdAndUpdate + $inc to guarantee uniqueness
 * even under concurrent requests. No padding — produces USER1, USER2, etc.
 *
 * @param {string} prefix - e.g. ID_PREFIXES.USER, ID_PREFIXES.EVT
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

module.exports = {
  ID_PREFIXES,
  generateMonotonicId,
};

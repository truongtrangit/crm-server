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

  // Staff / Org / Company
  COMPANY: "COM",
  FUNCTION: "FUNC",
  FUNCTIONAL_GROUP: "FNG",
  STAFF: "STF",

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

  // Organization
  ORGANIZATION: "ORG",

  // Finance
  REVENUE_CATEGORY: "RVC",
  EXPECTED_REVENUE: "RVE",
  EXPENSE_CATEGORY: "EPC",
  EXPECTED_EXPENSE: "EPE",
  PROJECT_BONUS: "PJB",

  // Job Hub
  JOB_STATUS_CONFIG: "JSC",
  JOB_TASK_TYPE_GROUP: "JTG",
  JOB_TASK_TYPE: "JTT",
  JOB_CHANNEL: "JCH",
  JOB_REPEAT_RULE: "JRR",

  // Course
  COURSE_CATEGORY: "CCT",
  COURSE_HASHTAG: "CHT",
  COURSE_LECTURER: "CLT",

  // Course Challenge
  COURSE_CHALLENGE_TEMPLATE: "CHCT",
  COURSE_CHALLENGE: "CHC",
  COURSE_CHALLENGE_DAY: "CHD",
  COURSE_CHALLENGE_ENROLLMENT: "CHE",

  // Knowledge
  KNOWLEDGE: "KNW",
  KNOWLEDGE_CATEGORY: "KNC",
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

/**
 * Generate a batch of monotonic IDs atomicly.
 * Increments the sequence once and returns the batch of generated IDs.
 *
 * @param {string} prefix - e.g. ID_PREFIXES.TASK
 * @param {number} count - number of IDs to generate
 * @returns {Promise<string[]>}
 */
async function generateMonotonicIdsBatch(prefix, count) {
  if (count <= 0) return [];
  const counter = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: count } },
    { new: true, upsert: true },
  );
  const endSeq = counter.seq;
  const startSeq = endSeq - count + 1;
  const ids = [];
  for (let i = startSeq; i <= endSeq; i++) {
    ids.push(`${prefix}${i}`);
  }
  return ids;
}

module.exports = {
  ID_PREFIXES,
  generateMonotonicId,
  generateMonotonicIdsBatch,
};

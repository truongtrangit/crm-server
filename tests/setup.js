/**
 * tests/setup.js
 * Global Jest setup: boots an in-memory MongoDB, seeds RBAC + fixture users,
 * and tears everything down after all suites complete.
 */

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const path = require("path");

// Make src imports work from test files
process.env.NODE_ENV = "test";

let mongod;

// ─── Global Setup ─────────────────────────────────────────────────────────────
async function setup() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Override MONGO_URI so the app connects here
  process.env.MONGO_URI = uri;
  process.env.PORT = "0"; // let OS assign free port

  await mongoose.connect(uri);

  // Seed RBAC (Roles + Permissions) — required for all permission checks
  const { seedRbac } = require("../src/services/rbacSeed");
  await seedRbac();

  // Seed minimal fixture users
  const { seedTestFixtures } = require("./utils/fixtures");
  await seedTestFixtures();

  // Expose mongod on global so teardown can stop it
  global.__MONGOD__ = mongod;
}

// ─── Global Teardown ──────────────────────────────────────────────────────────
async function teardown() {
  await mongoose.disconnect();
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
}

module.exports = { setup, teardown };

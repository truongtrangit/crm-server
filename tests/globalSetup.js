/**
 * tests/globalSetup.js
 * Jest globalSetup — runs ONCE before all test files.
 * Boots MongoMemoryServer, connects mongoose, seeds RBAC + fixtures.
 *
 * NOTE: globalSetup runs in a separate Node context from test files.
 *       It must write shared state (e.g., MONGO_URI) to process.env
 *       so test files (in their own context) can pick it up.
 */

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const path = require("path");

// Load .env for JWT secrets etc., but NOT MONGO_URI (we override it)
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

module.exports = async function globalSetup() {
  // 1. Start in-memory MongoDB
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // 2. Store on global so teardown can stop it
  global.__MONGOD__ = mongod;

  // 3. Inject URI into process.env — supertest app will read this
  process.env.MONGO_URI     = uri;
  process.env.NODE_ENV      = "test";
  process.env.PORT          = "0";

  // Also write to a temp env file that globalTeardown can read
  // (globalSetup and globalTeardown share global but NOT with worker threads,
  //  so we also store it in process.env which IS inherited by workers)
  process.env.__MONGOD_URI__ = uri;

  // 4. Connect + seed
  await mongoose.connect(uri);

  const { seedRbac } = require("../src/services/rbacSeed");
  await seedRbac();

  const { seedTestFixtures } = require("./utils/fixtures");
  await seedTestFixtures();

  await mongoose.disconnect();

  console.log("\n🧪 Test DB ready:", uri.replace(/\?.+/, ""));
};

/**
 * tests/jestSetup.js
 * Runs in each test worker (setupFilesAfterFramework).
 * Ensures mongoose is connected to the in-memory MongoDB before any test runs.
 */

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");
const { seedTestFixtures } = require("./utils/fixtures");
const { seedRbac } = require("../src/core/services/rbacSeed");
const { clearTokenCache } = require("./utils/testHelpers");

// Connect once per worker if not already connected
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }

  // Clear all collections to isolate this test suite
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Re-seed RBAC and Fixtures so this test file has a fresh state
  await seedRbac();
  await seedTestFixtures();
  
  // Clear auth tokens cached across test files
  clearTokenCache();
});

// DO NOT disconnect here — the worker reuses the connection across suites.
// globalTeardown handles final cleanup.

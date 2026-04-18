/**
 * tests/jestSetup.js
 * Runs in each test worker (setupFilesAfterFramework).
 * Ensures mongoose is connected to the in-memory MongoDB before any test runs.
 */

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");

// Connect once per worker if not already connected
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }
});

// DO NOT disconnect here — the worker reuses the connection across suites.
// globalTeardown handles final cleanup.

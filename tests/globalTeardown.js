/**
 * tests/globalTeardown.js
 * Jest globalTeardown — runs ONCE after all test files complete.
 * Disconnects mongoose and stops MongoMemoryServer.
 */

const mongoose = require("mongoose");

module.exports = async function globalTeardown() {
  // Ensure mongoose is disconnected
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Stop MongoMemoryServer
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }

  console.log("\n🧹 Test DB stopped.\n");
};

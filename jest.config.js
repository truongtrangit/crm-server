/**
 * jest.config.js
 * Jest configuration for CRM Server integration tests.
 */

module.exports = {
  // Test environment
  testEnvironment: "node",

  // Test file discovery
  testMatch: ["**/tests/api/**/*.test.js"],

  // Global setup & teardown (MongoMemoryServer + fixture seed)
  globalSetup:    "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",

  // Per-worker setup: connect mongoose to the in-memory DB before each suite
  // NOTE: correct Jest config key is setupFilesAfterEnv
  setupFilesAfterEnv: ["<rootDir>/tests/jestSetup.js"],

  // Run each test file serially — avoids parallel Mongo writes conflicting
  maxWorkers: 1,

  // Timeout per test
  testTimeout: 15000,

  // Coverage (enable with --coverage flag)
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/scripts/**",
    "!src/config/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],

  // Display
  verbose: true,
};

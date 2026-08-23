const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Run a function with an isolated context.
 * @param {Object} store - The state you want to store (e.g. { traceId })
 * @param {Function} callback - The function to run within this context
 */
function runWithContext(store, callback) {
  return asyncLocalStorage.run(store, callback);
}

/**
 * Get a specific key from the current async context
 * @param {string} key - The key to retrieve (e.g. 'traceId')
 * @returns {any} The value, or undefined if not set
 */
function getContext(key) {
  const store = asyncLocalStorage.getStore();
  return store ? store[key] : undefined;
}

module.exports = {
  runWithContext,
  getContext,
  asyncLocalStorage,
};

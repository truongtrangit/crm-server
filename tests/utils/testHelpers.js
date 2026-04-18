/**
 * tests/utils/testHelpers.js
 * Shared helpers: login, authenticated requests, response assertion shortcuts.
 */

const request = require("supertest");
const app = require("../../src/app");
const { CREDENTIALS } = require("./fixtures");

// ─── Token cache (populated after first login per role) ──────────────────────
const _tokenCache = {};

/**
 * Login as a given role and cache the token.
 * @param {"owner"|"admin"|"manager"|"staff1"|"staff2"} role
 * @returns {Promise<string>} Bearer access token
 */
async function loginAs(role) {
  if (_tokenCache[role]) return _tokenCache[role];

  const creds = CREDENTIALS[role];
  if (!creds) throw new Error(`Unknown test role: ${role}`);

  const res = await request(app)
    .post("/api/v1/auth/login")
    .send(creds)
    .expect(200);

  const token = res.body?.data?.accessToken;
  if (!token) throw new Error(`Login as ${role} failed — no accessToken in response`);

  _tokenCache[role] = token;
  return token;
}

/** Clear token cache (useful between test suites that mutate sessions) */
function clearTokenCache() {
  Object.keys(_tokenCache).forEach((k) => delete _tokenCache[k]);
}

/**
 * Build a supertest request with auth header already set.
 * @param {"owner"|"admin"|"manager"|"staff1"|"staff2"} role
 */
async function authRequest(role) {
  const token = await loginAs(role);
  return {
    get:    (url) => request(app).get(url).set("Authorization",  `Bearer ${token}`),
    post:   (url) => request(app).post(url).set("Authorization", `Bearer ${token}`),
    put:    (url) => request(app).put(url).set("Authorization",  `Bearer ${token}`),
    patch:  (url) => request(app).patch(url).set("Authorization",`Bearer ${token}`),
    delete: (url) => request(app).delete(url).set("Authorization",`Bearer ${token}`),
  };
}

/**
 * Quick expect helpers — DRY common assertions.
 */
function expectSuccess(res, statusCode = 200) {
  expect(res.status).toBe(statusCode);
  expect(res.body).toHaveProperty("statusCode", statusCode);
  expect(res.body).toHaveProperty("data");
}

function expectError(res, statusCode) {
  expect(res.status).toBe(statusCode);
  expect(res.body).toHaveProperty("statusCode", statusCode);
  expect(res.body).toHaveProperty("code");
  expect(res.body).toHaveProperty("message");
}

function expectPaginated(res) {
  expectSuccess(res, 200);
  expect(res.body.data).toHaveProperty("items");
  expect(Array.isArray(res.body.data.items)).toBe(true);
  expect(res.body.data).toHaveProperty("pagination");
  expect(res.body.data.pagination).toHaveProperty("page");
  expect(res.body.data.pagination).toHaveProperty("totalItems");
}

module.exports = {
  request,
  app,
  loginAs,
  clearTokenCache,
  authRequest,
  expectSuccess,
  expectError,
  expectPaginated,
};

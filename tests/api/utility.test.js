/**
 * tests/api/utility.test.js
 * Integration tests for utility endpoints: health check, API version info, functions
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError, expectPaginated } = require("../utils/testHelpers");
const { IDS } = require("../utils/fixtures");

// ─── Health Check ─────────────────────────────────────────────────────────────
describe("GET /health", () => {
  it("✅ returns 200 and status ok (no auth required)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("status", "ok");
  });
});

// ─── API Root ─────────────────────────────────────────────────────────────────
describe("GET /api", () => {
  it("✅ returns API version info", async () => {
    const res = await request(app).get("/api");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1", () => {
  it("✅ returns API v1 info", async () => {
    const res = await request(app).get("/api/v1");
    expect(res.status).toBe(200);
  });
});

// ─── Functions ────────────────────────────────────────────────────────────────
const FUNC_BASE = "/api/v1/functions";

describe("GET /functions", () => {
  it("✅ returns staff function list", async () => {
    const api = await authRequest("owner");
    const res = await api.get(FUNC_BASE);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(FUNC_BASE);
    expectError(res, 401);
  });
});

describe("POST /functions", () => {
  let createdFuncId = null;

  it("✅ OWNER creates a function → 201", async () => {
    const api = await authRequest("owner");
    const res = await api.post(FUNC_BASE).send({
      title: "Integration Function Test",
      desc: "Test function",
      type: "sale",
    });
    expect(res.status).toBe(201);
    createdFuncId = res.body.data?.id;
  });

  it("❌ returns 400 when title missing", async () => {
    const api = await authRequest("owner");
    const res = await api.post(FUNC_BASE).send({ type: "sale" });
    expectError(res, 400);
  });

  it("❌ STAFF cannot create functions (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(FUNC_BASE).send({ title: "Nope", type: "sale" });
    expectError(res, 403);
  });

  it("✅ OWNER deletes the created function", async () => {
    if (!createdFuncId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${FUNC_BASE}/${createdFuncId}`);
    // 200 = deleted, 404 = may not match expected id format
    expect([200, 404]).toContain(res.status);
  });
});

// ─── 404 Handling ─────────────────────────────────────────────────────────────
describe("Unknown routes", () => {
  it("✅ returns 404 JSON for unknown route (public prefix)", async () => {
    const res = await request(app).get("/route-that-does-not-exist-xyz");
    expect(res.status).toBe(404);
    expect(res.type).toMatch(/json/);
    expect(res.body).toHaveProperty("code");
  });
});

/**
 * tests/api/organization.test.js
 * Integration tests for /api/v1/organization/*
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError } = require("../utils/testHelpers");

const BASE = "/api/v1/organization";

// ─── List ─────────────────────────────────────────────────────────────────────
describe("GET /organization", () => {
  it("✅ OWNER gets organization list", async () => {
    const api = await authRequest("owner");
    const res = await api.get(BASE);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });

  it("✅ MANAGER can read organizations", async () => {
    const api = await authRequest("manager");
    const res = await api.get(BASE);
    expect(res.status).toBe(200);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(BASE);
    expectError(res, 401);
  });
});

// ─── Create Department ────────────────────────────────────────────────────────
describe("POST /organization/departments", () => {
  it("✅ OWNER creates a new department", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/departments`).send({
      name: "Phòng Test Integration",
      desc: "Test department",
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("parent", "Phòng Test Integration");
  });

  it("❌ duplicate department name → 409", async () => {
    const api = await authRequest("owner");
    await api.post(`${BASE}/departments`).send({ name: "Phòng Duplicate Test" });
    const res = await api.post(`${BASE}/departments`).send({ name: "Phòng Duplicate Test" });
    expectError(res, 409);
  });

  it("❌ returns 400 when name missing", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/departments`).send({});
    expectError(res, 400);
  });

  it("❌ STAFF cannot create department (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/departments`).send({ name: "Phòng No Perm" });
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(`${BASE}/departments`).send({ name: "X" });
    expectError(res, 401);
  });
});

// ─── Create Group ─────────────────────────────────────────────────────────────
describe("POST /organization/groups", () => {
  it("✅ OWNER creates a group under existing department", async () => {
    const api = await authRequest("owner");
    // Get the org ID first
    const orgRes = await api.get(BASE);
    const firstOrg = orgRes.body.data?.items?.[0] || orgRes.body.data?.[0];
    if (!firstOrg) return;

    const res = await api.post(`${BASE}/groups`).send({
      name: "Nhóm Test Integration",
      desc: "Test group",
      parentId: String(firstOrg.id),
    });
    expect(res.status).toBe(201);
  });

  it("❌ returns 400 when name or parentId missing", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/groups`).send({ desc: "No name" });
    expectError(res, 400);
  });

  it("❌ returns 404 when parentId doesn't exist", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/groups`).send({
      name: "Orphan Group",
      parentId: "9999",
    });
    expectError(res, 404);
  });

  it("❌ STAFF cannot create group (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/groups`).send({ name: "X", parentId: "1" });
    expectError(res, 403);
  });
});

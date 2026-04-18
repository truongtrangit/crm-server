/**
 * tests/api/leads.test.js
 * Integration tests for /api/v1/leads/*
 *
 * Routes: GET /, POST /, PUT /:id, PATCH /:id/status, DELETE /:id  (NO GET /:id)
 *
 * Permission facts:
 *   LEADS_READ   → OWNER, ADMIN, MANAGER, STAFF
 *   LEADS_CREATE → OWNER, ADMIN, MANAGER, STAFF
 *   LEADS_UPDATE → OWNER, ADMIN, MANAGER
 *   LEADS_DELETE → OWNER, ADMIN
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError, expectPaginated } = require("../utils/testHelpers");
const { IDS } = require("../utils/fixtures");

const BASE = "/api/v1/leads";
let createdLeadId = null;

describe("GET /leads", () => {
  it("✅ OWNER gets lead list (paginated)", async () => {
    const api = await authRequest("owner");
    const res = await api.get(BASE);
    expectPaginated(res);
  });

  it("✅ STAFF can read leads (LEADS_READ)", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(BASE);
    expectPaginated(res);
  });

  it("✅ filter by status works", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}?status=Biz tạo mới`);
    expectPaginated(res);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(BASE);
    expectError(res, 401);
  });
});

describe("POST /leads", () => {
  const validLead = {
    name: "Integration Lead",
    email: "intlead@test.com",
    phone: "0912 000 001",
    source: "Landing Page",
    status: "Biz tạo mới",
    tags: [],
  };

  it("✅ MANAGER creates a lead → 201", async () => {
    const api = await authRequest("manager");
    const res = await api.post(BASE).send(validLead);
    expect(res.status).toBe(201);
    createdLeadId = res.body.data?.id;
  });

  it("✅ STAFF creates a lead (LEADS_CREATE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(BASE).send({ ...validLead, email: "staff.lead@test.com", name: "Staff Lead" });
    expect(res.status).toBe(201);
  });

  it("❌ returns 400 when name missing", async () => {
    const api = await authRequest("manager");
    const { name, ...noName } = validLead;
    const res = await api.post(BASE).send(noName);
    expectError(res, 400);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(BASE).send(validLead);
    expectError(res, 401);
  });
});

describe("PUT /leads/:id", () => {
  it("✅ MANAGER updates lead fields (LEADS_UPDATE)", async () => {
    if (!createdLeadId) return;
    const api = await authRequest("manager");
    const res = await api.put(`${BASE}/${createdLeadId}`).send({ status: "Đang liên hệ" });
    expectSuccess(res, 200);
  });

  it("❌ STAFF cannot update lead (no LEADS_UPDATE)", async () => {
    if (!createdLeadId) return;
    const api = await authRequest("staff1");
    const res = await api.put(`${BASE}/${createdLeadId}`).send({ status: "Hacked" });
    expectError(res, 403);
  });

  it("❌ returns 404 for non-existent lead", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/LEAD-DOES-NOT-EXIST-XYZ`).send({ status: "X" });
    expectError(res, 404);
  });
});

describe("PATCH /leads/:id/status", () => {
  it("✅ MANAGER patches lead status", async () => {
    if (!createdLeadId) return;
    const api = await authRequest("manager");
    const res = await api.patch(`${BASE}/${createdLeadId}/status`).send({ status: "Chuyển đổi" });
    expect(res.status).toBe(200);
  });

  it("❌ STAFF cannot patch status (no LEADS_UPDATE)", async () => {
    if (!createdLeadId) return;
    const api = await authRequest("staff1");
    const res = await api.patch(`${BASE}/${createdLeadId}/status`).send({ status: "Chuyển đổi" });
    expectError(res, 403);
  });

  it("❌ returns 404 for non-existent lead", async () => {
    const api = await authRequest("owner");
    const res = await api.patch(`${BASE}/LEAD-DOES-NOT-EXIST-XYZ/status`).send({ status: "X" });
    expectError(res, 404);
  });
});

describe("DELETE /leads/:id", () => {
  it("✅ OWNER deletes created lead (LEADS_DELETE)", async () => {
    if (!createdLeadId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${createdLeadId}`);
    expectSuccess(res, 200);
  });

  it("❌ returns 404 after deletion", async () => {
    if (!createdLeadId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${createdLeadId}`);
    expectError(res, 404);
  });

  it("❌ STAFF cannot delete leads (no LEADS_DELETE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.delete(`${BASE}/${IDS.LEAD1}`);
    expectError(res, 403);
  });

  it("❌ MANAGER cannot delete leads (no LEADS_DELETE)", async () => {
    const api = await authRequest("manager");
    const res = await api.delete(`${BASE}/${IDS.LEAD1}`);
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).delete(`${BASE}/${IDS.LEAD1}`);
    expectError(res, 401);
  });
});

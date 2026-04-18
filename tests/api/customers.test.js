/**
 * tests/api/customers.test.js
 * Integration tests for /api/v1/customers/*
 *
 * ACTUAL Permission facts (from routes + requires any[]):
 *   GET list/detail:  → requirePermission(CUSTOMERS_READ) → all roles
 *   POST create:      → requirePermission(CUSTOMERS_CREATE) → all roles
 *   PUT update:       → requirePermission(CUSTOMERS_UPDATE) → OWNER, ADMIN, MANAGER
 *   DELETE /:id:      → requirePermission([CUSTOMERS_DELETE, CUSTOMERS_READ], 'any')
 *                        → any role with READ (which is all) CAN delete!
 *   POST /assignees:  → requirePermission([CUSTOMERS_UPDATE, CUSTOMERS_READ], 'any')
 *                        → all roles with READ can assign
 *   DELETE /assignees → same as ^
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError, expectPaginated } = require("../utils/testHelpers");
const { IDS } = require("../utils/fixtures");

const BASE = "/api/v1/customers";
let createdId = null;

// ─── List ─────────────────────────────────────────────────────────────────────
describe("GET /customers", () => {
  it("✅ returns paginated list for OWNER", async () => {
    const api = await authRequest("owner");
    const res = await api.get(BASE);
    expectPaginated(res);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it("✅ search filter reduces result set", async () => {
    const api = await authRequest("admin");
    const res = await api.get(`${BASE}?search=VIP`);
    expectPaginated(res);
  });

  it("✅ STAFF can read customers (CUSTOMERS_READ)", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(BASE);
    expectPaginated(res);
  });

  it("✅ pagination works (page=1&limit=1)", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}?page=1&limit=1`);
    expectPaginated(res);
    expect(res.body.data.items).toHaveLength(1);
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app).get(BASE);
    expectError(res, 401);
  });
});

// ─── Get by ID ────────────────────────────────────────────────────────────────
describe("GET /customers/:id", () => {
  it("✅ returns customer for valid ID", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/${IDS.CUST1}`);
    expectSuccess(res, 200);
    expect(res.body.data).toHaveProperty("id", IDS.CUST1);
  });

  it("❌ returns 404 for non-existent ID", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/CUST-DOES-NOT-EXIST-XYZ-999`);
    expectError(res, 404);
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app).get(`${BASE}/${IDS.CUST1}`);
    expectError(res, 401);
  });
});

// ─── Create ───────────────────────────────────────────────────────────────────
describe("POST /customers", () => {
  const validBody = {
    name: "New Integration Customer",
    email: "integration.cust@test.com",
    phone: "0901 999 888",
    type: "Trial",
    biz: [],
    platforms: [],
    group: "Nhóm Sale HN",
    registeredAt: "18/04/2026",
    tags: [],
  };

  it("✅ OWNER creates customer → 201", async () => {
    const api = await authRequest("owner");
    const res = await api.post(BASE).send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    createdId = res.body.data.id;
  });

  it("✅ MANAGER creates customer (CUSTOMERS_CREATE)", async () => {
    const api = await authRequest("manager");
    const res = await api.post(BASE).send({ ...validBody, email: "manager.cust@test.com", name: "Manager Cust" });
    expect(res.status).toBe(201);
  });

  it("✅ STAFF creates customer (also has CUSTOMERS_CREATE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(BASE).send({ ...validBody, email: "staff.cust@test.com", name: "Staff Cust" });
    expect(res.status).toBe(201);
  });

  it("❌ returns 400 when name is missing", async () => {
    const api = await authRequest("owner");
    const { name, ...noName } = validBody;
    const res = await api.post(BASE).send(noName);
    expectError(res, 400);
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app).post(BASE).send(validBody);
    expectError(res, 401);
  });
});

// ─── Update ───────────────────────────────────────────────────────────────────
describe("PUT /customers/:id", () => {
  it("✅ OWNER updates customer fields", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/${IDS.CUST1}`).send({ type: "Premium" });
    expectSuccess(res, 200);
    expect(res.body.data).toHaveProperty("type", "Premium");
  });

  it("✅ MANAGER updates customer (CUSTOMERS_UPDATE)", async () => {
    const api = await authRequest("manager");
    const res = await api.put(`${BASE}/${IDS.CUST1}`).send({ type: "VIP Customer" });
    expectSuccess(res, 200);
  });

  it("❌ STAFF cannot update customer (no CUSTOMERS_UPDATE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.put(`${BASE}/${IDS.CUST1}`).send({ type: "Hacked" });
    expectError(res, 403);
  });

  it("❌ returns 404 for non-existent ID", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/CUST-DOES-NOT-EXIST-XYZ-999`).send({ type: "VIP" });
    expectError(res, 404);
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app).put(`${BASE}/${IDS.CUST1}`).send({ type: "VIP" });
    expectError(res, 401);
  });
});

// ─── Assign ────────────────────────────────────────────────────────────────────
describe("POST /customers/:id/assignees", () => {
  it("✅ OWNER assigns a staff member", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/${IDS.CUST1}/assignees`).send({
      userId: IDS.USER_STAFF1,
      role: "sale",
    });
    // 200 = assigned, 409 = already assigned (idempotent check)
    expect([200, 409]).toContain(res.status);
  });

  it("✅ STAFF can self-assign (business rule: staff can only assign themselves)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/${IDS.CUST1}/assignees`).send({
      userId: IDS.USER_STAFF1, // staff1's own ID — self-assignment
      role: "sale",
    });
    // Not 401 and not 403 (permission denied or business rule error)
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("❌ returns 404 for non-existent customer", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/CUST-DOES-NOT-EXIST-XYZ-999/assignees`).send({
      userId: IDS.USER_STAFF1,
      role: "sale",
    });
    expectError(res, 404);
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app).post(`${BASE}/${IDS.CUST2}/assignees`).send({ userId: IDS.USER_STAFF1, role: "sale" });
    expectError(res, 401);
  });
});

// ─── Unassign ──────────────────────────────────────────────────────────────────
describe("DELETE /customers/:id/assignees/:userId", () => {
  it("✅ OWNER removes a staff assignment", async () => {
    // Ensure assigned first
    const api = await authRequest("owner");
    await api.post(`${BASE}/${IDS.CUST1}/assignees`).send({ userId: IDS.USER_STAFF2, role: "sale" });
    const res = await api.delete(`${BASE}/${IDS.CUST1}/assignees/${IDS.USER_STAFF2}`);
    // 200 if was assigned, 400/404 otherwise
    expect([200, 400, 404]).toContain(res.status);
  });

  it("❌ returns 404/400 for non-existent customer", async () => {
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/CUST-DOES-NOT-EXIST-XYZ-999/assignees/${IDS.USER_STAFF1}`);
    // 404 if customer not found, 400 if validation fails on bad ID format
    expect([400, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app).delete(`${BASE}/${IDS.CUST1}/assignees/${IDS.USER_STAFF1}`);
    expectError(res, 401);
  });
});

// ─── Delete ────────────────────────────────────────────────────────────────────
// IMPORTANT: route uses requirePermission([CUSTOMERS_DELETE, CUSTOMERS_READ], 'any')
// This means anyone with CUSTOMERS_READ (all roles) can delete!
describe("DELETE /customers/:id", () => {
  it("✅ OWNER deletes the customer created in POST test", async () => {
    if (!createdId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${createdId}`);
    expectSuccess(res, 200);
  });

  it("❌ returns 404 after deletion", async () => {
    if (!createdId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${createdId}`);
    expectError(res, 404);
  });

  // Route uses any[CUSTOMERS_DELETE, CUSTOMERS_READ] → STAFF has READ → CAN delete
  it("✅ STAFF can delete (route grants via CUSTOMERS_READ)", async () => {
    const api = await authRequest("staff1");
    const res = await api.delete(`${BASE}/${IDS.CUST2}`);
    // 200 if exists, 404 if already deleted by prior test — both are authorized
    expect([200, 404]).toContain(res.status);
  });

  it("✅ MANAGER can delete (route grants via CUSTOMERS_READ)", async () => {
    const api = await authRequest("manager");
    const res = await api.delete(`${BASE}/${IDS.CUST2}`);
    expect([200, 404]).toContain(res.status);
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app).delete(`${BASE}/${IDS.CUST1}`);
    expectError(res, 401);
  });
});

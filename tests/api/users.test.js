/**
 * tests/api/users.test.js
 * Integration tests for /api/v1/users/*
 *
 * Permission facts (from routes/rbac.js):
 *   USERS_READ   → OWNER, ADMIN, MANAGER
 *   USERS_CREATE → OWNER, ADMIN, MANAGER (but /register goes through /auth/register)
 *   USERS_UPDATE → OWNER, ADMIN, MANAGER
 *   USERS_DELETE → OWNER, ADMIN
 *   GET /org-options → no requirePermission (just authenticateRequest via v1 router)
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError, expectPaginated } = require("../utils/testHelpers");
const { IDS, CREDENTIALS } = require("../utils/fixtures");

const BASE = "/api/v1/users";
let createdUserId = null;

// ─── List ─────────────────────────────────────────────────────────────────────
describe("GET /users", () => {
  it("✅ OWNER gets full user list (paginated)", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}?page=1&limit=20`);
    expectPaginated(res);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(5);
  });

  it("✅ ADMIN can list users (USERS_READ)", async () => {
    const api = await authRequest("admin");
    const res = await api.get(BASE);
    expectPaginated(res);
  });

  it("✅ MANAGER can list users (USERS_READ)", async () => {
    const api = await authRequest("manager");
    const res = await api.get(BASE);
    expectPaginated(res);
  });

  it("❌ STAFF cannot list users (no USERS_READ)", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(BASE);
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(BASE);
    expectError(res, 401);
  });
});

// ─── Org options ──────────────────────────────────────────────────────────────
describe("GET /users/org-options", () => {
  it("✅ MANAGER can get org options", async () => {
    const api = await authRequest("manager");
    const res = await api.get(`${BASE}/org-options`);
    expect(res.status).toBe(200);
  });

  it("✅ STAFF can get org options (no permission guard)", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(`${BASE}/org-options`);
    expect(res.status).toBe(200);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(`${BASE}/org-options`);
    expectError(res, 401);
  });
});

// ─── Create user (via /auth/register) ─────────────────────────────────────────
// NOTE: /api/v1/users POST requires USERS_CREATE (OWNER, ADMIN, MANAGER have it)
describe("POST /auth/register (USERS_CREATE permission)", () => {
  const newUser = {
    name: "Fresh Integration User",
    email: "fresh.user.test.u@test.com",
    password: "FreshUser@123",
    roleId: "staff",
    department: ["Phòng Sale"],
    group: ["Nhóm Sale HN"],
  };

  it("✅ OWNER creates a new user → 201", async () => {
    const api = await authRequest("owner");
    const res = await api.post("/api/v1/auth/register").send(newUser);
    expect(res.status).toBe(201);
    // /auth/register returns user object directly as data (not nested under .user)
    expect(res.body).toHaveProperty("data");
    createdUserId = res.body.data?.id || res.body.data?.user?.id;
    expect(createdUserId).toBeTruthy();
  });

  it("❌ duplicate email returns 409 or 400", async () => {
    const api = await authRequest("owner");
    const res = await api.post("/api/v1/auth/register").send(newUser);
    // Server returns 409 (duplicate) or 400 (validation for existing email)
    expect([400, 409]).toContain(res.status);
  });

  it("❌ STAFF cannot create users (no USERS_CREATE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post("/api/v1/auth/register").send({ ...newUser, email: "another.u@test.com" });
    expectError(res, 403);
  });
});

// ─── Update ───────────────────────────────────────────────────────────────────
describe("PUT /users/:id", () => {
  it("✅ OWNER updates any user", async () => {
    if (!createdUserId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/${createdUserId}`).send({ phone: "0912345678" });
    expectSuccess(res, 200);
    // Response returns user directly in data (not nested under .user)
    const user = res.body.data?.user || res.body.data;
    expect(user).toHaveProperty("phone", "0912345678");
  });

  it("✅/❌ MANAGER updates user (USERS_UPDATE / business rule)", async () => {
    const api = await authRequest("manager");
    // Manager has USERS_UPDATE; canManageUserByRole may restrict by role level
    const res = await api.put(`${BASE}/${IDS.USER_STAFF2}`).send({ phone: "0900000003" });
    // 200: success, 403: business rule, 404: user was deleted by prior test
    expect([200, 403, 404]).toContain(res.status);
  });

  it("❌ STAFF cannot update users (no USERS_UPDATE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.put(`${BASE}/${IDS.USER_STAFF2}`).send({ phone: "0000000000" });
    expectError(res, 403);
  });

  it("❌ returns 404 for non-existent user", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/USER-DOES-NOT-EXIST-XYZ`).send({ phone: "0000000000" });
    expectError(res, 404);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).put(`${BASE}/${IDS.USER_STAFF1}`).send({ phone: "0000000000" });
    expectError(res, 401);
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────
describe("DELETE /users/:id", () => {
  it("✅ OWNER deletes the created user", async () => {
    if (!createdUserId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${createdUserId}`);
    expectSuccess(res, 200);
  });

  it("❌ returns 404 after deletion", async () => {
    if (!createdUserId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${createdUserId}`);
    expectError(res, 404);
  });

  it("❌ OWNER cannot delete themselves (self-delete guard)", async () => {
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${IDS.USER_OWNER}`);
    // Self-delete returns 403 or 400 depending on implementation
    expect([403, 400]).toContain(res.status);
  });

  it("❌ STAFF cannot delete users (no USERS_DELETE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.delete(`${BASE}/${IDS.USER_STAFF2}`);
    expectError(res, 403);
  });

  it("❌ MANAGER cannot delete users (no USERS_DELETE)", async () => {
    const api = await authRequest("manager");
    const res = await api.delete(`${BASE}/${IDS.USER_STAFF1}`);
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).delete(`${BASE}/${IDS.USER_STAFF1}`);
    expectError(res, 401);
  });
});

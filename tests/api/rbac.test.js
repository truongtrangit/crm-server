/**
 * tests/api/rbac.test.js
 * Integration tests for /api/v1/rbac/*
 *
 * Permission facts:
 *   PERMISSIONS_READ → OWNER, ADMIN (GET /rbac)
 *   ROLES_READ       → OWNER, ADMIN (GET /rbac/roles)
 *   ROLES_MANAGE     → OWNER only (POST/PUT/DELETE /rbac/roles)
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError } = require("../utils/testHelpers");

const BASE = "/api/v1/rbac";
let createdRoleId = null;

// ─── Permissions ──────────────────────────────────────────────────────────────
describe("GET /rbac (list permissions)", () => {
  it("✅ OWNER can list all permissions", async () => {
    const api = await authRequest("owner");
    const res = await api.get(BASE);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });

  it("✅ ADMIN can list permissions (PERMISSIONS_READ)", async () => {
    const api = await authRequest("admin");
    const res = await api.get(BASE);
    expect(res.status).toBe(200);
  });

  it("❌ MANAGER cannot list permissions (no PERMISSIONS_READ)", async () => {
    const api = await authRequest("manager");
    const res = await api.get(BASE);
    expectError(res, 403);
  });

  it("❌ STAFF cannot list permissions (no PERMISSIONS_READ)", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(BASE);
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(BASE);
    expectError(res, 401);
  });
});

// ─── Roles List ───────────────────────────────────────────────────────────────
describe("GET /rbac/roles", () => {
  it("✅ OWNER lists all roles", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/roles`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    // Response is a direct array or { items }
    const items = Array.isArray(data) ? data : data.items;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(4); // OWNER, ADMIN, MANAGER, STAFF
  });

  it("✅ ADMIN can read roles (ROLES_READ)", async () => {
    const api = await authRequest("admin");
    const res = await api.get(`${BASE}/roles`);
    expect(res.status).toBe(200);
  });

  it("❌ MANAGER cannot list roles (no ROLES_READ)", async () => {
    const api = await authRequest("manager");
    const res = await api.get(`${BASE}/roles`);
    expectError(res, 403);
  });

  it("❌ STAFF cannot list roles (no ROLES_READ)", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(`${BASE}/roles`);
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(`${BASE}/roles`);
    expectError(res, 401);
  });
});

// ─── Get Role by ID ───────────────────────────────────────────────────────────
describe("GET /rbac/roles/:id", () => {
  it("✅ returns system role with permissions details", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/roles/owner`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("name", "OWNER");
    expect(res.body.data).toHaveProperty("permissions");
  });

  it("❌ returns 404 for non-existent role", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/roles/role-superadmin-xyz-notexist`);
    expectError(res, 404);
  });
});

// ─── Create Role ──────────────────────────────────────────────────────────────
describe("POST /rbac/roles (ROLES_MANAGE — OWNER only)", () => {
  it("✅ OWNER creates a custom role → 201", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/roles`).send({
      id: "role-integration-test",
      name: "INTEGRATION_TEST",
      description: "Integration test custom role",
      permissions: ["users_read", "events_read"],
      level: 0,
    });
    expect(res.status).toBe(201);
    createdRoleId = "role-integration-test";
  });

  it("❌ duplicate role ID → 409", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/roles`).send({
      id: "role-integration-test",
      name: "DUPLICATE",
      permissions: [],
      level: 0,
    });
    expectError(res, 409);
  });

  it("❌ returns 400 when id or name missing", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/roles`).send({ permissions: [] });
    expectError(res, 400);
  });

  it("❌ ADMIN cannot create roles (no ROLES_MANAGE)", async () => {
    const api = await authRequest("admin");
    const res = await api.post(`${BASE}/roles`).send({
      id: "role-admin-test",
      name: "ADMIN_CUSTOM",
      permissions: [],
      level: 0,
    });
    expectError(res, 403);
  });

  it("❌ MANAGER cannot create roles (no ROLES_MANAGE)", async () => {
    const api = await authRequest("manager");
    const res = await api.post(`${BASE}/roles`).send({
      id: "role-mgr-test",
      name: "MGR_CUSTOM",
      permissions: [],
      level: 0,
    });
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(`${BASE}/roles`).send({ id: "x", name: "X", permissions: [] });
    expectError(res, 401);
  });
});

// ─── Update Role ──────────────────────────────────────────────────────────────
describe("PUT /rbac/roles/:id", () => {
  it("✅ OWNER updates a non-system custom role", async () => {
    if (!createdRoleId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/roles/${createdRoleId}`).send({
      description: "Updated description",
      permissions: ["users_read"],
    });
    expectSuccess(res, 200);
  });

  it("❌ cannot update system role → 403", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/roles/owner`).send({ description: "Hack attempt" });
    expectError(res, 403);
  });

  it("❌ ADMIN cannot update roles (no ROLES_MANAGE)", async () => {
    if (!createdRoleId) return;
    const api = await authRequest("admin");
    const res = await api.put(`${BASE}/roles/${createdRoleId}`).send({ description: "X" });
    expectError(res, 403);
  });

  it("❌ returns 404 for non-existent role", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/roles/role-notexist-xyz`).send({ description: "X" });
    expectError(res, 404);
  });
});

// ─── Delete Role ──────────────────────────────────────────────────────────────
describe("DELETE /rbac/roles/:id", () => {
  it("❌ cannot delete system role → 403", async () => {
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/roles/staff`);
    expectError(res, 403);
  });

  it("❌ ADMIN cannot delete roles (no ROLES_MANAGE)", async () => {
    if (!createdRoleId) return;
    const api = await authRequest("admin");
    const res = await api.delete(`${BASE}/roles/${createdRoleId}`);
    expectError(res, 403);
  });

  it("✅ OWNER deletes the custom test role", async () => {
    if (!createdRoleId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/roles/${createdRoleId}`);
    expectSuccess(res, 200);
  });

  it("❌ returns 404 after deletion", async () => {
    if (!createdRoleId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/roles/${createdRoleId}`);
    expectError(res, 404);
  });
});

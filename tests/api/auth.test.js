/**
 * tests/api/auth.test.js
 * Integration tests for /api/v1/auth/*
 *
 * Covers: login, refresh, logout, /me (GET/PUT), change-password,
 *         forgot-password, reset-password, register (admin-only).
 */

const request = require("supertest");
const app = require("../../src/app");
const { loginAs, authRequest, expectSuccess, expectError, clearTokenCache } = require("../utils/testHelpers");
const { CREDENTIALS, IDS } = require("../utils/fixtures");

const BASE = "/api/v1/auth";

// ─── Login ────────────────────────────────────────────────────────────────────
describe("POST /auth/login", () => {
  it("✅ returns 200 + accessToken with valid credentials (owner)", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send(CREDENTIALS.owner);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("user");
    expect(res.body.data.user).toHaveProperty("email", CREDENTIALS.owner.email);
  });

  it("✅ login is case-insensitive for email", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: CREDENTIALS.staff1.email.toUpperCase(), password: CREDENTIALS.staff1.password });
    expect(res.status).toBe(200);
  });

  it("❌ returns 401 with wrong password", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: CREDENTIALS.owner.email, password: "WrongPass!" });
    expectError(res, 401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("❌ returns 401 with non-existent email", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: "nobody@test.com", password: "Pass123" });
    expectError(res, 401);
  });

  it("❌ returns 400 when email is missing", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ password: "Pass123" });
    expectError(res, 400);
  });

  it("❌ returns 400 when password is missing", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: CREDENTIALS.owner.email });
    expectError(res, 400);
  });

  it("❌ returns 400 with empty body", async () => {
    const res = await request(app).post(`${BASE}/login`).send({});
    expectError(res, 400);
  });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────
describe("GET /auth/me", () => {
  it("✅ returns current user profile when authenticated", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/me`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("user");
    expect(res.body.data.user).toHaveProperty("email", CREDENTIALS.owner.email);
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app).get(`${BASE}/me`);
    expectError(res, 401);
  });

  it("❌ returns 401 with invalid token", async () => {
    const res = await request(app)
      .get(`${BASE}/me`)
      .set("Authorization", "Bearer invalid_token_xyz");
    expectError(res, 401);
  });
});

// ─── PUT /me ──────────────────────────────────────────────────────────────────
describe("PUT /auth/me", () => {
  it("✅ updates own profile fields", async () => {
    const api = await authRequest("staff2");
    const res = await api.put(`${BASE}/me`).send({ phone: "0909111222" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("user");
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app).put(`${BASE}/me`).send({ phone: "0909000000" });
    expectError(res, 401);
  });
});

// ─── POST /change-password ────────────────────────────────────────────────────
describe("POST /auth/change-password", () => {
  // Use manager credentials for this test to avoid polluting other users
  it("✅ changes password successfully", async () => {
    const api = await authRequest("manager");
    const res = await api
      .post(`${BASE}/change-password`)
      .send({ currentPassword: CREDENTIALS.manager.password, newPassword: "NewManager@456" });
    expect(res.status).toBe(200);

    // Restore password (don't leave DB dirty for other tests)
    const loginRes = await request(app)
      .post(`${BASE}/login`)
      .send({ email: CREDENTIALS.manager.email, password: "NewManager@456" });
    expect(loginRes.status).toBe(200);
    const restoreToken = loginRes.body.data.accessToken;
    await request(app)
      .post(`${BASE}/change-password`)
      .set("Authorization", `Bearer ${restoreToken}`)
      .send({ currentPassword: "NewManager@456", newPassword: CREDENTIALS.manager.password });
    // Refresh manager token in cache
    clearTokenCache();
  });

  it("❌ returns 401 with wrong current password", async () => {
    const api = await authRequest("staff1");
    const res = await api
      .post(`${BASE}/change-password`)
      .send({ currentPassword: "WrongOld@123", newPassword: "NewPass@456" });
    expectError(res, 401);
    expect(res.body.code).toBe("INVALID_CURRENT_PASSWORD");
  });

  it("❌ returns 400 when new password same as current", async () => {
    const api = await authRequest("staff1");
    const res = await api
      .post(`${BASE}/change-password`)
      .send({ currentPassword: CREDENTIALS.staff1.password, newPassword: CREDENTIALS.staff1.password });
    expectError(res, 400);
  });

  it("❌ returns 400 when fields missing", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/change-password`).send({});
    expectError(res, 400);
  });

  it("❌ returns 401 without token", async () => {
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .send({ currentPassword: "a", newPassword: "b" });
    expectError(res, 401);
  });
});

// ─── POST /forgot-password ────────────────────────────────────────────────────
describe("POST /auth/forgot-password", () => {
  it("✅ returns 200 for existing email (token returned in dev)", async () => {
    const res = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: CREDENTIALS.staff1.email });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("email");
    expect(res.body.data).toHaveProperty("resetToken");
  });

  it("✅ returns 200 even for non-existent email (no enumeration)", async () => {
    const res = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: "nobody@test.com" });
    expect(res.status).toBe(200);
  });

  it("❌ returns 400 when email missing", async () => {
    const res = await request(app).post(`${BASE}/forgot-password`).send({});
    expectError(res, 400);
  });
});

// ─── POST /reset-password ─────────────────────────────────────────────────────
describe("POST /auth/reset-password", () => {
  it("✅ resets password with valid token", async () => {
    // 1. Request reset
    const forgotRes = await request(app)
      .post(`${BASE}/forgot-password`)
      .send({ email: CREDENTIALS.staff2.email });
    const { resetToken } = forgotRes.body.data;

    // 2. Reset
    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({
        email: CREDENTIALS.staff2.email,
        resetToken,
        newPassword: "NewStaff@456",
      });
    expect(res.status).toBe(200);

    // 3. Verify login works with new password
    const loginRes = await request(app)
      .post(`${BASE}/login`)
      .send({ email: CREDENTIALS.staff2.email, password: "NewStaff@456" });
    expect(loginRes.status).toBe(200);

    // 4. Restore original password
    const restoreToken = loginRes.body.data.accessToken;
    await request(app)
      .post(`${BASE}/change-password`)
      .set("Authorization", `Bearer ${restoreToken}`)
      .send({ currentPassword: "NewStaff@456", newPassword: CREDENTIALS.staff2.password });
    clearTokenCache();
  });

  it("❌ returns 400 with invalid reset token", async () => {
    const res = await request(app)
      .post(`${BASE}/reset-password`)
      .send({
        email: CREDENTIALS.owner.email,
        resetToken: "completelyfaketoken",
        newPassword: "NewPass@789",
      });
    expectError(res, 400);
    expect(res.body.code).toBe("INVALID_RESET_TOKEN");
  });

  it("❌ returns 400 with missing fields", async () => {
    const res = await request(app).post(`${BASE}/reset-password`).send({});
    expectError(res, 400);
  });
});

// ─── POST /logout ─────────────────────────────────────────────────────────────
describe("POST /auth/logout", () => {
  it("✅ logs out and returns 200", async () => {
    // Login fresh for logout test (don't use cached token — it gets invalidated)
    const loginRes = await request(app)
      .post(`${BASE}/login`)
      .send(CREDENTIALS.admin);
    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .post(`${BASE}/logout`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Token should no longer work
    const meRes = await request(app)
      .get(`${BASE}/me`)
      .set("Authorization", `Bearer ${token}`);
    expectError(meRes, 401);
  });

  it("✅ returns 200 even without token (graceful)", async () => {
    const res = await request(app).post(`${BASE}/logout`);
    expect(res.status).toBe(200);
  });
});

// ─── POST /refresh ────────────────────────────────────────────────────────────
describe("POST /auth/refresh", () => {
  it("❌ returns 400 without session cookies", async () => {
    const res = await request(app).post(`${BASE}/refresh`);
    expectError(res, 400);
  });
});

// ─── POST /register ───────────────────────────────────────────────────────────
describe("POST /auth/register", () => {
  const newUser = {
    name: "New Staff Register",
    email: "newstaff.register@test.com",
    password: "NewStaff@123",
    roleId: "staff",
    department: ["Phòng Sale"],
    group: ["Nhóm Sale HN"],
  };

  it("✅ OWNER can create new staff account", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/register`).send(newUser);
    expect(res.status).toBe(201);
  });

  it("✅ ADMIN can create new staff account", async () => {
    const api = await authRequest("admin");
    const res = await api.post(`${BASE}/register`).send({
      ...newUser,
      email: "newstaff.admin.reg@test.com",
    });
    expect(res.status).toBe(201);
  });

  it("❌ STAFF cannot register new user (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/register`).send(newUser);
    expectError(res, 403);
  });

  it("❌ returns 400 with missing required fields", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/register`).send({ name: "Missing Fields" });
    expectError(res, 400);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(`${BASE}/register`).send(newUser);
    expectError(res, 401);
  });
});

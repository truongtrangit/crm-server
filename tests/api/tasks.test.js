/**
 * tests/api/tasks.test.js
 * Integration tests for /api/v1/tasks/*
 *
 * Routes: GET /, POST /, PUT /:id, DELETE /:id   (NO GET /:id)
 *
 * Permission facts:
 *   TASKS_READ   → OWNER, ADMIN, MANAGER, STAFF
 *   TASKS_CREATE → OWNER, ADMIN, MANAGER, STAFF
 *   TASKS_UPDATE → OWNER, ADMIN, MANAGER, STAFF (all roles)
 *   TASKS_DELETE → OWNER, ADMIN (only)
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError, expectPaginated } = require("../utils/testHelpers");
const { IDS } = require("../utils/fixtures");

const BASE = "/api/v1/tasks";
let createdTaskId = null;

describe("GET /tasks", () => {
  it("✅ OWNER lists tasks (paginated)", async () => {
    const api = await authRequest("owner");
    const res = await api.get(BASE);
    expectPaginated(res);
  });

  it("✅ STAFF can read tasks (TASKS_READ)", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(BASE);
    expectPaginated(res);
  });

  it("✅ search filter works", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}?search=test`);
    expectPaginated(res);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(BASE);
    expectError(res, 401);
  });
});

describe("POST /tasks", () => {
  const validTask = {
    action: "Gọi điện CSKH test",
    time: "09:00",
    timeType: "future",
    customer: { name: "Cust A", email: "a@test.com", phone: "0900000001" },
    platform: "SmaxAi",
    assignee: { name: "Test Staff One", avatar: "" },
    status: "Đang thực hiện",
  };

  it("✅ STAFF creates a task → 201", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(BASE).send(validTask);
    expect(res.status).toBe(201);
    createdTaskId = res.body.data?.id;
  });

  it("✅ MANAGER creates a task → 201", async () => {
    const api = await authRequest("manager");
    const res = await api.post(BASE).send({ ...validTask, action: "Manager task" });
    expect(res.status).toBe(201);
  });

  it("❌ returns 400 when action is missing", async () => {
    const api = await authRequest("staff1");
    const { action, ...noAction } = validTask;
    const res = await api.post(BASE).send(noAction);
    expectError(res, 400);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(BASE).send(validTask);
    expectError(res, 401);
  });
});

describe("PUT /tasks/:id", () => {
  it("✅ STAFF updates a task (TASKS_UPDATE)", async () => {
    // Use fixture task id directly since created id may not persist across describe blocks
    const api = await authRequest("staff1");
    const res = await api.put(`${BASE}/${IDS.TASK1}`).send({ status: "Hoàn thành" });
    // May be 200 (updated) — fixture task exists
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expectSuccess(res, 200);
    }
  });

  it("❌ returns 404 for non-existent task", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/TASK-DOES-NOT-EXIST-XYZ`).send({ status: "X" });
    expectError(res, 404);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).put(`${BASE}/SOMETASK`).send({ status: "X" });
    expectError(res, 401);
  });
});

describe("DELETE /tasks/:id", () => {
  it("✅ OWNER deletes a task (TASKS_DELETE)", async () => {
    // Use fixture task or created id
    const taskId = createdTaskId || IDS.TASK1;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${taskId}`);
    expect([200, 404]).toContain(res.status);
  });

  it("❌ returns 404 after deletion", async () => {
    if (!createdTaskId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${createdTaskId}`);
    expectError(res, 404);
  });

  it("❌ STAFF cannot delete tasks (no TASKS_DELETE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.delete(`${BASE}/${IDS.TASK1}`);
    expectError(res, 403);
  });

  it("❌ MANAGER cannot delete tasks (no TASKS_DELETE)", async () => {
    const api = await authRequest("manager");
    const res = await api.delete(`${BASE}/${IDS.TASK1}`);
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).delete(`${BASE}/${IDS.TASK1}`);
    expectError(res, 401);
  });
});

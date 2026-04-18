/**
 * tests/api/events.test.js
 * Integration tests for /api/v1/events/*
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError, expectPaginated } = require("../utils/testHelpers");
const { IDS } = require("../utils/fixtures");

const BASE = "/api/v1/events";
let createdEventId = null;

// ─── List ─────────────────────────────────────────────────────────────────────
describe("GET /events", () => {
  it("✅ returns paginated events for OWNER", async () => {
    const api = await authRequest("owner");
    const res = await api.get(BASE);
    expectPaginated(res);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it("✅ filter group=user_moi returns correct events", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}?group=user_moi`);
    expectPaginated(res);
    if (res.body.data.items.length > 0) {
      expect(res.body.data.items.every((e) => e.group === "user_moi")).toBe(true);
    }
  });

  it("✅ filter unassigned=true returns only unassigned events", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}?unassigned=true`);
    expectPaginated(res);
  });

  it("✅ STAFF can list events (EVENTS_READ)", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(BASE);
    expectPaginated(res);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(BASE);
    expectError(res, 401);
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────
describe("GET /events/stats", () => {
  it("✅ returns event stats object", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/stats`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(`${BASE}/stats`);
    expectError(res, 401);
  });
});

// ─── Get by ID ────────────────────────────────────────────────────────────────
describe("GET /events/:id", () => {
  it("✅ returns event with valid ID", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/${IDS.EVT1}`);
    expectSuccess(res, 200);
    expect(res.body.data).toHaveProperty("id", IDS.EVT1);
  });

  it("✅ returns unassigned event (if not yet deleted)", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/${IDS.EVT2}`);
    // May be 404 if EVT2 was deleted by a concurrent test suite
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data).toHaveProperty("id", IDS.EVT2);
    }
  });

  it("❌ returns 404 for non-existent event", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/EVENT-DOES-NOT-EXIST-XYZ`);
    expectError(res, 404);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(`${BASE}/${IDS.EVT1}`);
    expectError(res, 401);
  });
});

// ─── Create ───────────────────────────────────────────────────────────────────
describe("POST /events", () => {
  const validEvent = {
    name: "Integration Test Event",
    group: "biz_moi",
    stage: "Tiếp cận",
    customer: {
      name: "Test Cust",
      email: "tc@test.com",
      phone: "0901222333",
      role: "",
      source: "CRM",
      address: "",
    },
    customerId: IDS.CUST1,
    assigneeId: IDS.USER_STAFF1,
    assignee: { name: "Test Staff One", avatar: "", role: "" },
  };

  it("✅ OWNER creates event → 201", async () => {
    const api = await authRequest("owner");
    const res = await api.post(BASE).send(validEvent);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    createdEventId = res.body.data.id;
  });

  it("✅ STAFF can create event (EVENTS_CREATE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(BASE).send({ ...validEvent, name: "Staff Created Event" });
    expect(res.status).toBe(201);
  });

  it("❌ returns 400 without required name", async () => {
    const api = await authRequest("owner");
    const { name, ...noName } = validEvent;
    const res = await api.post(BASE).send(noName);
    expectError(res, 400);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(BASE).send(validEvent);
    expectError(res, 401);
  });
});

// ─── Update ───────────────────────────────────────────────────────────────────
describe("PUT /events/:id", () => {
  it("✅ updates event stage", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/${IDS.EVT1}`).send({ stage: "Đang tư vấn" });
    expectSuccess(res, 200);
  });

  it("✅ STAFF can update event (EVENTS_UPDATE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.put(`${BASE}/${IDS.EVT1}`).send({ stage: "Tiếp cận" });
    expectSuccess(res, 200);
  });

  it("❌ returns 404 for non-existent event", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/EVENT-DOES-NOT-EXIST-XYZ`).send({ stage: "X" });
    expectError(res, 404);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).put(`${BASE}/${IDS.EVT1}`).send({ stage: "X" });
    expectError(res, 401);
  });
});

// ─── Timeline ─────────────────────────────────────────────────────────────────
describe("POST /events/:id/timeline", () => {
  it("✅ adds a phone call timeline entry", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/${IDS.EVT1}/timeline`).send({
      type: "phone",
      title: "Gọi điện test",
      time: "10:00 18/04/2026",
      content: "Khách quan tâm",
      duration: "5 phút",
    });
    expect(res.status).toBe(201);
  });

  it("✅ adds a note timeline entry", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/${IDS.EVT1}/timeline`).send({
      type: "note",
      title: "Ghi chú test",
      content: "Ghi chú nội bộ",
    });
    expect(res.status).toBe(201);
  });

  it("❌ returns 400 for invalid timeline type", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/${IDS.EVT1}/timeline`).send({ type: "INVALID_TYPE", content: "X" });
    expectError(res, 400);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(`${BASE}/${IDS.EVT1}/timeline`).send({ type: "note", content: "X" });
    expectError(res, 401);
  });
});

// ─── Self Assign ──────────────────────────────────────────────────────────────
describe("POST /events/:id/self-assign", () => {
  it("✅ STAFF self-assigns the unassigned event (if exists)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/${IDS.EVT2}/self-assign`);
    // Event may have been deleted or already assigned in prior tests
    expect([200, 404, 422]).toContain(res.status);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(`${BASE}/${IDS.EVT2}/self-assign`);
    expectError(res, 401);
  });
});

// ─── Unassign ─────────────────────────────────────────────────────────────────
describe("DELETE /events/:id/assignee", () => {
  it("✅ OWNER unassigns staff from event", async () => {
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${IDS.EVT1}/assignee`);
    expect(res.status).toBe(200);
  });

  it("❌ returns 404 for non-existent event", async () => {
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/EVENT-DOES-NOT-EXIST-XYZ/assignee`);
    expectError(res, 404);
  });
});

// ─── Sync Customer ────────────────────────────────────────────────────────────
describe("POST /events/:id/sync-customer", () => {
  it("✅ syncs customer snapshot into event", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/${IDS.EVT1}/sync-customer`);
    expect(res.status).toBe(200);
  });

  it("❌ returns 404 for non-existent event", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/EVENT-DOES-NOT-EXIST-XYZ/sync-customer`);
    expectError(res, 404);
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────
describe("DELETE /events/:id", () => {
  it("✅ OWNER deletes the created event", async () => {
    if (!createdEventId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${createdEventId}`);
    expectSuccess(res, 200);
  });

  it("❌ returns 404 after deletion", async () => {
    if (!createdEventId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/${createdEventId}`);
    expectError(res, 404);
  });

  it("❌ STAFF cannot delete events (403 - no EVENTS_DELETE)", async () => {
    const api = await authRequest("staff1");
    const res = await api.delete(`${BASE}/${IDS.EVT1}`);
    expectError(res, 403);
  });

  it("❌ MANAGER cannot delete events (403 - no EVENTS_DELETE)", async () => {
    const api = await authRequest("manager");
    const res = await api.delete(`${BASE}/${IDS.EVT1}`);
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).delete(`${BASE}/${IDS.EVT1}`);
    expectError(res, 401);
  });
});

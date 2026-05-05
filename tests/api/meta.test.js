/**
 * tests/api/meta.test.js
 * Integration tests for /api/v1/meta/*
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError, expectPaginated } = require("../utils/testHelpers");
const { IDS } = require("../utils/fixtures");

const BASE = "/api/v1/meta";

let createdConfigId = null;
let createdProgramId = null;
let createdMilestoneId = null;
let createdTaskId = null;
let createdAttachmentId = null;

// ─── Config CRUD ────────────────────────────────────────────────────────────
describe("GET /meta/config", () => {
  it("✅ returns config list", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/config`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});

describe("POST /meta/config", () => {
  it("✅ OWNER creates a config", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/config`).send({
      name: "Test Config",
      kpiType: "metric",
      metrics: [{ name: "Revenue" }],
      description: "Test description",
    });
    expectSuccess(res, 201);
    createdConfigId = res.body.data.id;
  });

  it("❌ STAFF cannot create a config", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/config`).send({
      name: "Test Config 2",
    });
    expectError(res, 403);
  });
});

describe("PUT /meta/config/:id", () => {
  it("✅ OWNER updates the config", async () => {
    if (!createdConfigId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/config/${createdConfigId}`).send({
      name: "Updated Config Name",
    });
    expectSuccess(res, 200);
    expect(res.body.data.name).toBe("Updated Config Name");
  });
});

// ─── Program CRUD ──────────────────────────────────────────────────────────
describe("GET /meta/programs", () => {
  it("✅ returns paginated programs", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/programs`);
    expectPaginated(res);
  });
});

describe("POST /meta/programs", () => {
  it("✅ OWNER creates a program", async () => {
    if (!createdConfigId) return;
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/programs`).send({
      name: "Test Program",
      typeId: createdConfigId,
      budgetType: "fixed",
      budget: 10000,
      kpiTargets: [{ metricName: "Revenue", target: 100, current: 0 }],
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
    });
    expectSuccess(res, 201);
    createdProgramId = res.body.data.id;
  });
});

describe("GET /meta/programs/:id", () => {
  it("✅ returns program details", async () => {
    if (!createdProgramId) return;
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/programs/${createdProgramId}`);
    expectSuccess(res, 200);
  });
});

describe("PUT /meta/programs/:id", () => {
  it("✅ OWNER updates the program", async () => {
    if (!createdProgramId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/programs/${createdProgramId}`).send({
      name: "Updated Program Name",
      budget: 20000,
    });
    expectSuccess(res, 200);
    expect(res.body.data.name).toBe("Updated Program Name");
    expect(res.body.data.budget).toBe(20000);
  });
});

// ─── Milestones ─────────────────────────────────────────────────────────────
describe("POST /meta/programs/:id/milestones", () => {
  it("✅ OWNER adds a milestone", async () => {
    if (!createdProgramId) return;
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/programs/${createdProgramId}/milestones`).send({
      name: "Test Milestone",
      metricName: "Revenue",
      valueAdded: 10,
      date: new Date().toISOString(),
    });
    expectSuccess(res, 201);
    createdMilestoneId = res.body.data.milestones[0]._id;
  });
});

describe("PUT /meta/programs/:id/milestones/:milestoneId", () => {
  it("✅ OWNER updates a milestone", async () => {
    if (!createdProgramId || !createdMilestoneId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/programs/${createdProgramId}/milestones/${createdMilestoneId}`).send({
      name: "Updated Milestone",
    });
    expectSuccess(res, 200);
  });
});

describe("DELETE /meta/programs/:id/milestones/:milestoneId", () => {
  it("✅ OWNER deletes a milestone", async () => {
    if (!createdProgramId || !createdMilestoneId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/programs/${createdProgramId}/milestones/${createdMilestoneId}`);
    expectSuccess(res, 200);
  });
});

// ─── Tasks ──────────────────────────────────────────────────────────────────
describe("POST /meta/programs/:id/tasks", () => {
  it("✅ OWNER adds a task", async () => {
    if (!createdProgramId) return;
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/programs/${createdProgramId}/tasks`).send({
      title: "Test Task",
      description: "Do something",
    });
    expectSuccess(res, 201);
    createdTaskId = res.body.data.tasks[0]._id;
  });
});

describe("PUT /meta/programs/:id/tasks/:taskId", () => {
  it("✅ OWNER updates a task", async () => {
    if (!createdProgramId || !createdTaskId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/programs/${createdProgramId}/tasks/${createdTaskId}`).send({
      title: "Updated Task",
      isCompleted: true,
    });
    expectSuccess(res, 200);
  });
});

describe("DELETE /meta/programs/:id/tasks/:taskId", () => {
  it("✅ OWNER deletes a task", async () => {
    if (!createdProgramId || !createdTaskId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/programs/${createdProgramId}/tasks/${createdTaskId}`);
    expectSuccess(res, 200);
  });
});

// ─── Attachments ────────────────────────────────────────────────────────────
describe("POST /meta/programs/:id/attachments", () => {
  it("✅ OWNER adds an attachment", async () => {
    if (!createdProgramId) return;
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/programs/${createdProgramId}/attachments`).send({
      fileName: "test.pdf",
      url: "http://example.com/test.pdf",
    });
    expectSuccess(res, 201);
    createdAttachmentId = res.body.data.attachments[0]._id;
  });
});

describe("DELETE /meta/programs/:id/attachments/:attachmentId", () => {
  it("✅ OWNER deletes an attachment", async () => {
    if (!createdProgramId || !createdAttachmentId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/programs/${createdProgramId}/attachments/${createdAttachmentId}`);
    expectSuccess(res, 200);
  });
});

// ─── Cleanup ────────────────────────────────────────────────────────────────
describe("DELETE /meta/programs/:id", () => {
  it("✅ OWNER deletes a program", async () => {
    if (!createdProgramId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/programs/${createdProgramId}`);
    expectSuccess(res, 200);
  });
});

describe("DELETE /meta/config/:id", () => {
  it("✅ OWNER deletes a config", async () => {
    if (!createdConfigId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/config/${createdConfigId}`);
    expectSuccess(res, 200);
  });
});

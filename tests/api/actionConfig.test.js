/**
 * tests/api/actionConfig.test.js
 * Integration tests for /api/v1/action-config/*
 * Covers: Results, Reasons, Actions, ActionChains
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError, expectPaginated } = require("../utils/testHelpers");
const { IDS } = require("../utils/fixtures");

const BASE = "/api/v1/action-config";
let createdResultId  = null;
let createdReasonId  = null;
let createdActionId  = null;
let createdChainId   = null;

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════
describe("Results — GET /action-config/results", () => {
  it("✅ returns paginated results", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/results`);
    expectPaginated(res);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it("✅ STAFF can read results (ACTIONS_CFG_READ permission)", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(`${BASE}/results`);
    expectPaginated(res);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(`${BASE}/results`);
    expectError(res, 401);
  });
});

describe("Results — POST /action-config/results", () => {
  it("✅ OWNER creates a result → 201", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/results`).send({
      name: "Integration Result",
      type: "success",
      description: "Created in test",
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    createdResultId = res.body.data.id;
  });

  it("❌ returns 400 when name missing", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/results`).send({ type: "success" });
    expectError(res, 400);
  });

  it("❌ returns 400 with invalid type", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/results`).send({ name: "Bad Type", type: "INVALID" });
    expectError(res, 400);
  });

  it("❌ STAFF cannot create (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/results`).send({ name: "No perm", type: "success" });
    expectError(res, 403);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(`${BASE}/results`).send({ name: "X" });
    expectError(res, 401);
  });
});

describe("Results — PUT /action-config/results/:id", () => {
  it("✅ updates result", async () => {
    if (!createdResultId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/results/${createdResultId}`).send({ name: "Updated Result" });
    expectSuccess(res, 200);
    expect(res.body.data).toHaveProperty("name", "Updated Result");
  });

  it("❌ returns 404 for non-existent ID", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/results/NOTEXIST`).send({ name: "X" });
    expectError(res, 404);
  });
});

// ═══════════════════════════════════════════════════════════════
// REASONS
// ═══════════════════════════════════════════════════════════════
describe("Reasons — GET /action-config/reasons", () => {
  it("✅ returns paginated reasons", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/reasons`);
    expectPaginated(res);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(`${BASE}/reasons`);
    expectError(res, 401);
  });
});

describe("Reasons — POST /action-config/reasons", () => {
  it("✅ creates a reason → 201", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/reasons`).send({
      name: "Integration Reason",
      description: "Created in test",
    });
    expect(res.status).toBe(201);
    createdReasonId = res.body.data.id;
  });

  it("❌ returns 400 when name missing", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/reasons`).send({});
    expectError(res, 400);
  });

  it("❌ STAFF cannot create (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/reasons`).send({ name: "No Perm" });
    expectError(res, 403);
  });
});

describe("Reasons — PUT /action-config/reasons/:id", () => {
  it("✅ updates a reason", async () => {
    if (!createdReasonId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/reasons/${createdReasonId}`).send({ name: "Updated Reason" });
    expectSuccess(res, 200);
  });

  it("❌ returns 404 for non-existent ID", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/reasons/NOTEXIST`).send({ name: "X" });
    expectError(res, 404);
  });
});

// ═══════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════
describe("Actions — GET /action-config/actions", () => {
  it("✅ returns paginated actions", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/actions`);
    expectPaginated(res);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(`${BASE}/actions`);
    expectError(res, 401);
  });
});

describe("Actions — POST /action-config/actions", () => {
  it("✅ creates an action → 201", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/actions`).send({
      name: "Integration Test Action",
      type: "call",
      category: "primary",
      description: "Test action",
      reasonIds: [],
    });
    expect(res.status).toBe(201);
    createdActionId = res.body.data.id;
  });

  it("❌ returns 400 for invalid action type", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/actions`).send({
      name: "Bad Type Action",
      type: "INVALID_TYPE",
    });
    expectError(res, 400);
  });

  it("❌ returns 400 when name missing", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/actions`).send({ type: "call" });
    expectError(res, 400);
  });

  it("❌ STAFF cannot create action (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/actions`).send({ name: "X", type: "call" });
    expectError(res, 403);
  });
});

// ═══════════════════════════════════════════════════════════════
// ACTION CHAINS
// ═══════════════════════════════════════════════════════════════
describe("ActionChains — GET /action-config/chains", () => {
  it("✅ returns paginated action chains", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/chains`);
    expectPaginated(res);
  });

  it("✅ STAFF can read action chains", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(`${BASE}/chains`);
    expectPaginated(res);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(`${BASE}/chains`);
    expectError(res, 401);
  });
});

describe("ActionChains — GET /action-config/chains/:id", () => {
  it("✅ returns chain detail", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/chains/${IDS.CHAIN1}`);
    expectSuccess(res, 200);
    expect(res.body.data).toHaveProperty("id", IDS.CHAIN1);
    expect(res.body.data).toHaveProperty("steps");
  });

  it("❌ returns 404 for non-existent chain", async () => {
    const api = await authRequest("owner");
    const res = await api.get(`${BASE}/chains/NOTEXIST`);
    expectError(res, 404);
  });
});

describe("ActionChains — POST /action-config/chains", () => {
  it("✅ creates a new action chain with steps", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/chains`).send({
      name: "Integration Chain",
      description: "Test chain",
      delayUnit: "immediate",
      active: true,
      steps: [
        {
          order: 1,
          actionId: IDS.ACT1,
          branches: [
            {
              resultId: IDS.RES1,
              order: 1,
              nextStepType: "next_in_chain",
              nextActionId: IDS.ACT2,
              closeOutcome: null,
              delayUnit: "hour",
              delayValue: 2,
            },
          ],
        },
      ],
    });
    expect(res.status).toBe(201);
    createdChainId = res.body.data.id;
  });

  it("❌ next_in_chain without nextActionId → 400 validation error", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/chains`).send({
      name: "Invalid Chain",
      steps: [
        {
          order: 1,
          actionId: IDS.ACT1,
          branches: [
            {
              resultId: IDS.RES1,
              order: 1,
              nextStepType: "next_in_chain",
              nextActionId: null, // ← VIOLATES business rule
              delayUnit: null,
              delayValue: null,
            },
          ],
        },
      ],
    });
    expectError(res, 400);
  });

  it("❌ returns 400 when name is missing", async () => {
    const api = await authRequest("owner");
    const res = await api.post(`${BASE}/chains`).send({ steps: [] });
    expectError(res, 400);
  });

  it("❌ STAFF cannot create chains (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.post(`${BASE}/chains`).send({ name: "No Perm", steps: [] });
    expectError(res, 403);
  });
});

describe("ActionChains — PUT /action-config/chains/:id (update)", () => {
  it("✅ updates chain metadata (name/active)", async () => {
    if (!createdChainId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/chains/${createdChainId}`).send({ active: false });
    expectSuccess(res, 200);
    expect(res.body.data).toHaveProperty("active", false);
  });

  it("❌ returns 404 for non-existent chain", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/chains/NOTEXIST`).send({ active: true });
    expectError(res, 404);
  });
});

describe("ActionChains — PUT /action-config/chains/:id/rule (save full rule)", () => {
  it("✅ saves full chain rule with steps and branches", async () => {
    if (!createdChainId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/chains/${createdChainId}/rule`).send({
      active: true,
      steps: [
        {
          order: 1,
          actionId: IDS.ACT1,
          branches: [
            {
              resultId: IDS.RES1,
              order: 1,
              nextStepType: "next_in_chain",
              nextActionId: IDS.ACT2,
              closeOutcome: null,
              delayUnit: "day",
              delayValue: 1,
            },
            {
              resultId: IDS.RES2,
              order: 2,
              nextStepType: "close_task",
              nextActionId: null,
              closeOutcome: "failure",
              delayUnit: null,
              delayValue: null,
            },
          ],
        },
      ],
    });
    expect(res.status).toBe(200);
  });

  it("❌ rejects rule with next_in_chain missing nextActionId → 400", async () => {
    if (!createdChainId) return;
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/chains/${createdChainId}/rule`).send({
      steps: [
        {
          order: 1,
          actionId: IDS.ACT1,
          branches: [
            {
              resultId: IDS.RES1,
              order: 1,
              nextStepType: "next_in_chain",
              nextActionId: null, // ← INVALID
            },
          ],
        },
      ],
    });
    expectError(res, 400);
  });

  it("❌ returns 404 for non-existent chain", async () => {
    const api = await authRequest("owner");
    const res = await api.put(`${BASE}/chains/NOTEXIST/rule`).send({ steps: [] });
    expectError(res, 404);
  });

  it("❌ STAFF cannot save rule (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.put(`${BASE}/chains/${IDS.CHAIN1}/rule`).send({ steps: [] });
    expectError(res, 403);
  });
});

describe("ActionChains — DELETE /action-config/chains/:id", () => {
  it("✅ deletes the created chain", async () => {
    if (!createdChainId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/chains/${createdChainId}`);
    expectSuccess(res, 200);
  });

  it("❌ returns 404 after deletion", async () => {
    if (!createdChainId) return;
    const api = await authRequest("owner");
    const res = await api.delete(`${BASE}/chains/${createdChainId}`);
    expectError(res, 404);
  });

  it("❌ STAFF cannot delete chains (403)", async () => {
    const api = await authRequest("staff1");
    const res = await api.delete(`${BASE}/chains/${IDS.CHAIN1}`);
    expectError(res, 403);
  });
});

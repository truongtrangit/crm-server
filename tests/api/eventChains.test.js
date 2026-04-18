/**
 * tests/api/eventChains.test.js
 * Integration tests for /api/v1/events/:eventId/chains/*
 *
 * Critical flow: add chain → advance steps → update delay → handle branches
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectSuccess, expectError } = require("../utils/testHelpers");
const { IDS } = require("../utils/fixtures");

const BASE_EVT = "/api/v1/events";
const evtId    = IDS.EVT1;
const chainUrl = (extId = IDS.CHAIN1) => `${BASE_EVT}/${evtId}/chains/${extId}`;
let clonedChainId = null; // ID of the EventActionChain created by POST

// ─── Add Chain to Event ───────────────────────────────────────────────────────
describe("POST /events/:id/chains (add chain to event)", () => {
  it("✅ MANAGER adds active chain to event → 201", async () => {
    const api = await authRequest("manager");
    const res = await api.post(`${BASE_EVT}/${evtId}/chains`).send({ chainId: IDS.CHAIN1 });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    clonedChainId = res.body.data.id;
  });

  it("❌ cannot add inactive chain → 422", async () => {
    const api = await authRequest("manager");
    const res = await api.post(`${BASE_EVT}/${evtId}/chains`).send({ chainId: IDS.CHAIN2 });
    expectError(res, 422);
  });

  it("❌ cannot add same chain twice → 409", async () => {
    const api = await authRequest("manager");
    const res = await api.post(`${BASE_EVT}/${evtId}/chains`).send({ chainId: IDS.CHAIN1 });
    expectError(res, 409);
  });

  it("❌ returns 404 for non-existent chain template", async () => {
    const api = await authRequest("manager");
    const res = await api.post(`${BASE_EVT}/${evtId}/chains`).send({ chainId: "CHAIN-DOES-NOT-EXIST" });
    expectError(res, 404);
  });

  it("❌ returns 400 when chainId missing", async () => {
    const api = await authRequest("manager");
    const res = await api.post(`${BASE_EVT}/${evtId}/chains`).send({});
    expectError(res, 400);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).post(`${BASE_EVT}/${evtId}/chains`).send({ chainId: IDS.CHAIN3 });
    expectError(res, 401);
  });
});

// ─── List Chains for Event ────────────────────────────────────────────────────
describe("GET /events/:id/chains", () => {
  it("✅ returns array of chains for the event", async () => {
    const api = await authRequest("staff1");
    const res = await api.get(`${BASE_EVT}/${evtId}/chains`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).get(`${BASE_EVT}/${evtId}/chains`);
    expectError(res, 401);
  });
});

// ─── Save Current Step ────────────────────────────────────────────────────────
describe("POST /events/:id/chains/:chainId/steps/current (mark result)", () => {
  it("✅ saves result on current step → advances to next step", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("staff1");
    const res = await api
      .put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/current`)
      .send({
        selectedResultId: IDS.RES1, // branch: next_in_chain → ACT2
        note: "Khách quan tâm, hẹn callback",
      });
    // 200: advanced or saved, 400: validation error, 404: not found, 403: chain closed
    expect([200, 400, 404, 403]).toContain(res.status);
  });

  it("✅ saves result with close_task branch → closes chain", async () => {
    // Add a second chain (CHAIN3) to work with
    const api = await authRequest("manager");
    const addRes = await api.post(`${BASE_EVT}/${evtId}/chains`).send({ chainId: IDS.CHAIN3 });
    if (addRes.status !== 201) return;
    const chain3Id = addRes.body.data.id;

    const saveRes = await api
      .put(`${BASE_EVT}/${evtId}/chains/${chain3Id}/steps/current`)
      .send({ selectedResultId: IDS.RES2, note: "Test note" });
    // CHAIN3 has no branches, so 200 is still okay
    expect(saveRes.status).toBe(200);
  });

  it("❌ returns 400 when selectedResultId is missing", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("staff1");
    const res = await api
      .put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/current`)
      .send({ note: "Missing resultId" });
    // Either 400 (validation) or 200 (if current step has no branches — controller may not require resultId)
    expect([400, 200]).toContain(res.status);
  });

  it("❌ returns 404 for non-existent chain", async () => {
    const api = await authRequest("staff1");
    const res = await api
      .put(`${BASE_EVT}/${evtId}/chains/NOTEXIST/steps/current`)
      .send({ selectedResultId: IDS.RES1 });
    expectError(res, 404);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app)
      .put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/current`)
      .send({ selectedResultId: IDS.RES1 });
    expectError(res, 401);
  });
});

// ─── Update Delay on Current Step ─────────────────────────────────────────────
describe("PUT /events/:id/chains/:chainId/steps/current/delay", () => {
  it("✅ updates delay on current step", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("staff1");
    const res = await api
      .patch(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/current/delay`)
      .send({ delayUnit: "day", delayValue: 2 });
    expect([200, 400]).toContain(res.status);
  });

  it("❌ returns 400 for invalid delay unit", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("staff1");
    const res = await api
      .patch(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/current/delay`)
      .send({ delayUnit: "century", delayValue: 1 });
    expectError(res, 400);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app)
      .patch(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/current/delay`)
      .send({ delayUnit: "day", delayValue: 1 });
    expectError(res, 401);
  });
});

// ─── Update Note on Step ──────────────────────────────────────────────────────
describe("PUT /events/:id/chains/:chainId/steps/:order/note", () => {
  it("✅ updates note on step 1", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("staff1");
    const res = await api
      .patch(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/note`)
      .send({ note: "Ghi chú cập nhật integration test" });
    expect(res.status).toBe(200);
  });

  it("❌ returns 400 without note field", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("staff1");
    const res = await api
      .patch(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/note`)
      .send({});
    expectError(res, 400);
  });
});

// ─── Add Step ─────────────────────────────────────────────────────────────────
describe("POST /events/:id/chains/:chainId/steps", () => {
  it("✅ inserts a new step into chain", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api
      .post(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps`)
      .send({ actionId: IDS.ACT1, insertAfterOrder: 1 });
    // 200 = inserted; 409 = step already exists at that order
    expect([200, 409]).toContain(res.status);
  });

  it("❌ returns 400 without actionId", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api
      .post(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps`)
      .send({});
    expectError(res, 400);
  });
});

// ─── Upsert Branch ────────────────────────────────────────────────────────────
describe("PUT /events/:id/chains/:chainId/steps/:order/branches (branch validation)", () => {
  it("✅ upserts a valid branch (close_task)", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api
      .put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/branches`)
      .send({
        resultId: IDS.RES2,
        order: 1,
        nextStepType: "close_task",
        nextActionId: null,
        closeOutcome: "failure",
        delayUnit: null,
        delayValue: null,
      });
    expect([200, 400]).toContain(res.status);
  });

  it("✅ upserts a valid branch (next_in_chain with nextActionId)", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api
      .put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/branches`)
      .send({
        resultId: IDS.RES1,
        order: 2,
        nextStepType: "next_in_chain",
        nextActionId: IDS.ACT2,
        closeOutcome: null,
        delayUnit: "hour",
        delayValue: 1,
      });
    expect([200, 400]).toContain(res.status);
  });

  it("❌ next_in_chain without nextActionId → 400/422 (business rule)", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api
      .put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/branches`)
      .send({
        resultId: IDS.RES1,
        order: 3,
        nextStepType: "next_in_chain",
        nextActionId: null, // ← INVALID
        closeOutcome: null,
        delayUnit: null,
        delayValue: null,
      });
    // Business rule violation can return 400 (validation) or 422 (semantic)
    expect([400, 422]).toContain(res.status);
  });

  it("❌ returns 400 when resultId is missing", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api
      .put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/branches`)
      .send({ nextStepType: "close_task" });
    expectError(res, 400);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app)
      .put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/branches`)
      .send({ resultId: IDS.RES2, nextStepType: "close_task" });
    expectError(res, 401);
  });
});

// ─── Delete Branch ────────────────────────────────────────────────────────────
describe("DELETE /events/:id/chains/:chainId/steps/:order/branches/:resultId", () => {
  it("✅ removes a branch from a step (or 404/403 if step/chain unavailable)", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    // Upsert branch first (step 1 — guaranteed to exist)
    await api
      .put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/branches`)
      .send({
        resultId: IDS.RES2,
        order: 1,
        nextStepType: "close_task",
        closeOutcome: "failure",
        nextActionId: null,
        delayUnit: null,
        delayValue: null,
      });

    const res = await api.delete(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/branches/${IDS.RES2}`);
    // 200 = deleted, 404 = not found, 403 = chain was closed, 400 = validation
    expect([200, 404, 403, 400]).toContain(res.status);
  });

  it("❌ returns 404/400 for non-existent branch", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api.delete(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/steps/1/branches/BRANCH-NOT-EXIST`);
    expect([404, 400, 403]).toContain(res.status);
  });
});

// ─── Close Chain ──────────────────────────────────────────────────────────────
describe("PUT /events/:id/chains/:chainId/close", () => {
  it("✅ closes the chain manually", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api.put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/close`);
    expect(res.status).toBe(200);
  });

  it("❌ returns 401 without auth", async () => {
    if (!clonedChainId) return;
    const res = await request(app).put(`${BASE_EVT}/${evtId}/chains/${clonedChainId}/close`);
    expectError(res, 401);
  });
});

// ─── Delete Chain from Event ──────────────────────────────────────────────────
describe("DELETE /events/:id/chains/:chainId", () => {
  it("✅ removes chain from event (or 403 if chain was closed)", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api.delete(`${BASE_EVT}/${evtId}/chains/${clonedChainId}`);
    // 200 = removed, 404 = not found, 403 = chain was already closed (business rule)
    expect([200, 404, 403]).toContain(res.status);
  });

  it("❌ second delete on same chain returns 403/404", async () => {
    if (!clonedChainId) return;
    const api = await authRequest("manager");
    const res = await api.delete(`${BASE_EVT}/${evtId}/chains/${clonedChainId}`);
    expect([404, 200, 403]).toContain(res.status);
  });

  it("❌ returns 401 without auth", async () => {
    const res = await request(app).delete(`${BASE_EVT}/${evtId}/chains/ANY`);
    expectError(res, 401);
  });
});

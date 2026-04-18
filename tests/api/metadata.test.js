/**
 * tests/api/metadata.test.js
 * Integration tests for /api/v1/metadata/*
 */

const request = require("supertest");
const app = require("../../src/app");
const { authRequest, expectError } = require("../utils/testHelpers");

const BASE = "/api/v1/metadata";

const endpoints = [
  { path: "",                    name: "all metadata bundle" },
  { path: "/roles",              name: "roles" },
  { path: "/departments",        name: "departments" },
  { path: "/department-groups",  name: "department-groups" },
  { path: "/customer-groups",    name: "customer-groups" },
];

describe("GET /metadata/*", () => {
  for (const { path, name } of endpoints) {
    it(`✅ returns ${name} for authenticated user`, async () => {
      const api = await authRequest("staff1");
      const res = await api.get(`${BASE}${path}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
    });
  }

  it("❌ returns 401 without auth on /metadata", async () => {
    const res = await request(app).get(BASE);
    expectError(res, 401);
  });

  it("❌ returns 401 without auth on /metadata/roles", async () => {
    const res = await request(app).get(`${BASE}/roles`);
    expectError(res, 401);
  });
});

/**
 * tests/api/webhooks.test.js
 * Integration tests for the Webhook endpoints.
 *
 * Endpoints:
 *   POST /api/v1/webhooks/new-registration
 *   POST /api/v1/webhooks/new-business
 *   POST /api/v1/webhooks/expiring-subscription
 *   POST /api/v1/webhooks/upgrade-required
 *
 * Security: Bearer token only.
 * X-Webhook-Delivery-Id: optional (auto-generated if missing).
 * Body = payload trực tiếp.
 */

const crypto = require("crypto");
const request = require("supertest");
const app = require("../../src/app");
const WebhookLog = require("../../src/models/WebhookLog");
const Event = require("../../src/models/Event");
const Customer = require("../../src/models/Customer");
const env = require("../../src/config/env");

const BASE_URL = "/api/v1/webhooks";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function webhookPost(eventSlug, body, options = {}) {
  const { token = env.webhookSecret, deliveryId } = options;

  const req = request(app)
    .post(`${BASE_URL}/${eventSlug}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);

  // Only set delivery ID header if explicitly provided
  if (deliveryId) {
    req.set("X-Webhook-Delivery-Id", deliveryId);
  }

  return req;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────────

describe("Webhook Endpoints", () => {
  beforeAll(async () => {
    // Rebuild indexes — ensures stale non-sparse unique index is replaced
    // with the new sparse unique index that allows multiple null deliveryIds
    try {
      await WebhookLog.collection.dropIndex("deliveryId_1");
    } catch (_e) { /* index may not exist */ }
    await WebhookLog.syncIndexes();
  });

  afterEach(async () => {
    await WebhookLog.deleteMany({});
    await Event.deleteMany({ source: "Webhook" });
    await Customer.deleteMany({ tags: "#Webhook" });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Authentication & Security
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Auth & Security", () => {
    it("should reject requests without Authorization header → 401", async () => {
      const res = await request(app)
        .post(`${BASE_URL}/new-registration`)
        .send({ customer: { name: "Test" } });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("WEBHOOK_AUTH_REQUIRED");
    });

    it("should reject requests with wrong token → 401", async () => {
      const res = await webhookPost(
        "new-registration",
        { customer: { name: "Test" } },
        { token: "wrong_token_value_here!" },
      );

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("WEBHOOK_INVALID_TOKEN");
    });

    it("should accept valid request without delivery ID → 201", async () => {
      const res = await webhookPost("new-registration", {
        customer: { name: "Test User", email: `no-id-${Date.now()}@test.com` },
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("deliveryId");
      expect(res.body.data).toHaveProperty("eventId");
      expect(res.body.data.eventType).toBe("user_moi");
    });

    it("should accept valid request with delivery ID → 201", async () => {
      const deliveryId = crypto.randomUUID();

      const res = await webhookPost("new-registration", {
        customer: { name: "Test User", email: `with-id-${Date.now()}@test.com` },
      }, { deliveryId });

      expect(res.status).toBe(201);
      expect(res.body.data.deliveryId).toBe(deliveryId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Idempotency
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Idempotency", () => {
    it("should reject duplicate deliveryId → 409", async () => {
      const deliveryId = crypto.randomUUID();
      const body = { customer: { name: "Dup Test", email: `dup-${Date.now()}@test.com` } };

      const res1 = await webhookPost("new-registration", body, { deliveryId });
      expect(res1.status).toBe(201);

      const res2 = await webhookPost("new-registration", body, { deliveryId });
      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe("WEBHOOK_DUPLICATE_DELIVERY");
    });

    it("should allow same payload with different deliveryId", async () => {
      const body = { customer: { name: "Same", email: `same-${Date.now()}@test.com` } };

      const res1 = await webhookPost("new-registration", body, { deliveryId: crypto.randomUUID() });
      const res2 = await webhookPost("new-registration", body, { deliveryId: crypto.randomUUID() });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
    });

    it("should allow requests without deliveryId (no duplicate check)", async () => {
      const body = { customer: { name: "No ID", email: `noid-${Date.now()}@test.com` } };

      const res1 = await webhookPost("new-registration", body);
      const res2 = await webhookPost("new-registration", body);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      // No delivery ID → null
      expect(res1.body.data.deliveryId).toBeNull();
      expect(res2.body.data.deliveryId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/new-registration
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /webhooks/new-registration", () => {
    it("should create Event with group=user_moi", async () => {
      const res = await webhookPost("new-registration", {
        customer: { name: "New User", email: `new-reg-${Date.now()}@test.com` },
      });

      expect(res.status).toBe(201);
      expect(res.body.data.eventType).toBe("user_moi");

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event).toBeTruthy();
      expect(event.group).toBe("user_moi");
      expect(event.source).toBe("Webhook");
    });

    it("should create new Customer if not found", async () => {
      const email = `webhook-new-${Date.now()}@test.com`;
      const res = await webhookPost("new-registration", {
        customer: { name: "New Webhook Customer", email, phone: "0909 888 777" },
      });

      expect(res.status).toBe(201);

      const customer = await Customer.findOne({ email });
      expect(customer).toBeTruthy();
      expect(customer.name).toBe("New Webhook Customer");
      expect(customer.tags).toContain("#Webhook");
    });

    it("should link existing Customer by email", async () => {
      const res = await webhookPost("new-registration", {
        customer: { name: "Should Match VIP", email: "vip@test.com" },
      });

      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customerId).toBe("TEST-CUST001");
    });

    it("should create WebhookLog with status=processed", async () => {
      const deliveryId = crypto.randomUUID();

      await webhookPost("new-registration", {
        customer: { name: "Log Test", email: `log-${Date.now()}@test.com` },
      }, { deliveryId });

      const log = await WebhookLog.findOne({ deliveryId });
      expect(log).toBeTruthy();
      expect(log.status).toBe("processed");
      expect(log.eventType).toBe("user_moi");
      expect(log.createdEventId).toBeTruthy();
      expect(log.processedAt).toBeTruthy();
      expect(log.error).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/new-business
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /webhooks/new-business", () => {
    it("should create Event with group=biz_moi", async () => {
      const res = await webhookPost("new-business", {
        customer: { name: "Biz Customer", email: "biz@test.com" },
        biz: { id: "BIZ-001", tags: ["ecommerce"] },
      });

      expect(res.status).toBe(201);
      expect(res.body.data.eventType).toBe("biz_moi");

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.group).toBe("biz_moi");
      expect(event.biz.id).toBe("BIZ-001");
    });

    it("should link existing Customer if found", async () => {
      const res = await webhookPost("new-business", {
        customer: { email: "vip@test.com" },
        biz: { id: "BIZ-002" },
      });

      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customerId).toBe("TEST-CUST001");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/expiring-subscription
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /webhooks/expiring-subscription", () => {
    it("should create Event with group=sap_het_han", async () => {
      const res = await webhookPost("expiring-subscription", {
        customer: { name: "Expiring Customer", email: "expire@test.com" },
        biz: { id: "BIZ-EXP-001" },
        plan: { name: "PRO", daysLeft: 5, expiryDate: "2026-05-01" },
      });

      expect(res.status).toBe(201);
      expect(res.body.data.eventType).toBe("sap_het_han");

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.group).toBe("sap_het_han");
      expect(event.plan.daysLeft).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/upgrade-required
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /webhooks/upgrade-required", () => {
    it("should create Event with group=can_nang_cap", async () => {
      const res = await webhookPost("upgrade-required", {
        customer: { name: "Upgrade Customer", email: "upgrade@test.com" },
        biz: { id: "BIZ-UPG-001" },
      });

      expect(res.status).toBe(201);
      expect(res.body.data.eventType).toBe("can_nang_cap");

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.group).toBe("can_nang_cap");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Flexible payload structure
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Flexible Payload Handling", () => {
    it("should handle flat customer fields in payload", async () => {
      const res = await webhookPost("new-registration", {
        customerName: "Flat Customer",
        customerEmail: `flat-${Date.now()}@test.com`,
        customerPhone: "0999 111 222",
      });

      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customer.name).toBe("Flat Customer");
    });

    it("should handle direct name/email in payload (fallback)", async () => {
      const res = await webhookPost("new-registration", {
        name: "Direct Customer",
        email: `direct-${Date.now()}@test.com`,
        phone: "0999 333 444",
      });

      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customer.name).toBe("Direct Customer");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Assignee Resolution
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Assignee Resolution", () => {
    it("should resolve assignee by assigneeId", async () => {
      const res = await webhookPost("new-registration", {
        customer: { name: "Cust A", email: `assignee-id-${Date.now()}@test.com` },
        assigneeId: "TEST-USER004",
      });

      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBe("TEST-USER004");
      expect(event.assignee.name).toBe("Test Staff One");
    });

    it("should resolve assignee by nested email", async () => {
      const res = await webhookPost("new-business", {
        customer: { name: "Cust B", email: "custb@test.com" },
        assignee: { email: "staff1@test.com" },
        biz: { id: "BIZ-ASG-001" },
      });

      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBe("TEST-USER004");
      expect(event.assignee.name).toBe("Test Staff One");
    });

    it("should resolve assignee by nested name", async () => {
      const res = await webhookPost("expiring-subscription", {
        customer: { name: "Cust C", email: "custc@test.com" },
        assignee: { name: "Test Manager" },
      });

      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBe("TEST-USER003");
    });

    it("should keep payload info when staff not found", async () => {
      const res = await webhookPost("upgrade-required", {
        customer: { name: "Cust D", email: "custd@test.com" },
        assignee: { name: "Unknown Staff", email: "notexist@test.com", role: "Sale" },
        biz: { id: "BIZ-ASG-002" },
      });

      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBeNull();
      expect(event.assignee.name).toBe("Unknown Staff");
    });

    it("should default to empty assignee when not provided", async () => {
      const res = await webhookPost("new-registration", {
        customer: { name: "No Assignee", email: `no-asgn-${Date.now()}@test.com` },
      });

      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBeNull();
      expect(event.assignee.name).toBe("");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WebhookLog tracking
  // ═══════════════════════════════════════════════════════════════════════════

  describe("WebhookLog", () => {
    it("should store the full payload in WebhookLog", async () => {
      const deliveryId = crypto.randomUUID();

      await webhookPost("new-registration", {
        customer: { name: "Log Test" },
        extra: { field: 123 },
      }, { deliveryId });

      const log = await WebhookLog.findOne({ deliveryId });
      expect(log).toBeTruthy();
      expect(log.payload).toBeTruthy();
      expect(log.payload.extra).toEqual({ field: 123 });
    });

    it("should store IP address in WebhookLog", async () => {
      const deliveryId = crypto.randomUUID();

      await webhookPost("new-registration", {
        customer: { name: "IP Test" },
      }, { deliveryId });

      const log = await WebhookLog.findOne({ deliveryId });
      expect(log).toBeTruthy();
      expect(log.ipAddress).toBeTruthy();
    });
  });
});

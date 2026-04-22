/**
 * tests/api/webhooks.test.js
 * Integration tests for the Webhook ingest endpoint.
 *
 * Covers:
 *  - Authentication (Bearer token)
 *  - HMAC signature verification
 *  - Idempotency (duplicate delivery rejection)
 *  - Validation (eventType, payload)
 *  - Processing for each event type (user_moi, biz_moi, sap_het_han, can_nang_cap)
 *  - WebhookLog creation and status tracking
 */

const crypto = require("crypto");
const request = require("supertest");
const app = require("../../src/app");
const WebhookLog = require("../../src/models/WebhookLog");
const Event = require("../../src/models/Event");
const Customer = require("../../src/models/Customer");
const env = require("../../src/config/env");

const INGEST_URL = "/api/v1/webhooks/ingest";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Generate HMAC-SHA256 signature for a payload body.
 */
function generateSignature(body, signingKey = env.webhookSigningKey) {
  const hmac = crypto
    .createHmac("sha256", signingKey)
    .update(JSON.stringify(body))
    .digest("hex");
  return `sha256=${hmac}`;
}

/**
 * Create a fully authenticated webhook request.
 */
function webhookPost(body, options = {}) {
  const {
    token = env.webhookSecret,
    signature,
    deliveryId = crypto.randomUUID(),
  } = options;

  const sig = signature || generateSignature(body);

  return request(app)
    .post(INGEST_URL)
    .set("Authorization", `Bearer ${token}`)
    .set("X-Webhook-Signature", sig)
    .set("X-Webhook-Delivery-Id", deliveryId)
    .send(body);
}

/**
 * Build a valid user_moi payload.
 */
function buildUserMoiPayload(overrides = {}) {
  return {
    eventType: "user_moi",
    payload: {
      customer: {
        name: "New Test User",
        email: `webhook-user-${Date.now()}@test.com`,
        phone: "0909 999 111",
      },
      ...overrides,
    },
  };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────────

describe("POST /api/v1/webhooks/ingest", () => {
  afterEach(async () => {
    // Clean up webhook logs and any events/customers created during tests
    await WebhookLog.deleteMany({});
    await Event.deleteMany({ source: "Webhook" });
    await Customer.deleteMany({ tags: "#Webhook" });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Authentication & Security
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Auth & Security", () => {
    it("should reject requests without Authorization header → 401", async () => {
      const body = buildUserMoiPayload();
      const sig = generateSignature(body);

      const res = await request(app)
        .post(INGEST_URL)
        .set("X-Webhook-Signature", sig)
        .set("X-Webhook-Delivery-Id", crypto.randomUUID())
        .send(body);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("WEBHOOK_AUTH_REQUIRED");
    });

    it("should reject requests with wrong token → 401", async () => {
      const body = buildUserMoiPayload();

      const res = await webhookPost(body, { token: "wrong_token_value_here!" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("WEBHOOK_INVALID_TOKEN");
    });

    it("should reject requests without X-Webhook-Signature → 401", async () => {
      const body = buildUserMoiPayload();

      const res = await request(app)
        .post(INGEST_URL)
        .set("Authorization", `Bearer ${env.webhookSecret}`)
        .set("X-Webhook-Delivery-Id", crypto.randomUUID())
        .send(body);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("WEBHOOK_SIGNATURE_REQUIRED");
    });

    it("should reject requests with invalid signature → 401", async () => {
      const body = buildUserMoiPayload();

      const res = await webhookPost(body, {
        signature: "sha256=invalid_hmac_value",
      });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("WEBHOOK_INVALID_SIGNATURE");
    });

    it("should reject requests without X-Webhook-Delivery-Id → 400", async () => {
      const body = buildUserMoiPayload();
      const sig = generateSignature(body);

      const res = await request(app)
        .post(INGEST_URL)
        .set("Authorization", `Bearer ${env.webhookSecret}`)
        .set("X-Webhook-Signature", sig)
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("WEBHOOK_MISSING_DELIVERY_ID");
    });

    it("should accept requests with valid token + signature + deliveryId", async () => {
      const body = buildUserMoiPayload();

      const res = await webhookPost(body);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("deliveryId");
      expect(res.body.data).toHaveProperty("eventId");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Idempotency
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Idempotency", () => {
    it("should reject duplicate deliveryId → 409", async () => {
      const deliveryId = crypto.randomUUID();
      const body = buildUserMoiPayload();

      // First request should succeed
      const res1 = await webhookPost(body, { deliveryId });
      expect(res1.status).toBe(201);

      // Second request with same deliveryId should be rejected
      const res2 = await webhookPost(body, { deliveryId });
      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe("WEBHOOK_DUPLICATE_DELIVERY");
    });

    it("should allow same payload with different deliveryId", async () => {
      const body = buildUserMoiPayload();

      const res1 = await webhookPost(body, { deliveryId: crypto.randomUUID() });
      const res2 = await webhookPost(body, { deliveryId: crypto.randomUUID() });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Validation", () => {
    it("should reject missing eventType → 400", async () => {
      const body = { payload: { name: "Test" } };
      const res = await webhookPost(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject invalid eventType → 400", async () => {
      const body = { eventType: "invalid_type", payload: { name: "Test" } };
      const res = await webhookPost(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject missing payload → 400", async () => {
      const body = { eventType: "user_moi" };
      const res = await webhookPost(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject payload that is not an object → 400", async () => {
      const body = { eventType: "user_moi", payload: "not_an_object" };
      const res = await webhookPost(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should accept arbitrary payload structure (flexible schema)", async () => {
      const body = {
        eventType: "user_moi",
        payload: {
          anyField: "anyValue",
          nested: { deep: { value: 42 } },
          array: [1, 2, 3],
        },
      };
      const res = await webhookPost(body);

      // Should succeed even with arbitrary fields
      expect(res.status).toBe(201);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Processing — user_moi
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Processing: user_moi", () => {
    it("should create Event with group=user_moi", async () => {
      const body = buildUserMoiPayload();
      const res = await webhookPost(body);

      expect(res.status).toBe(201);
      expect(res.body.data.eventType).toBe("user_moi");

      // Verify Event was created
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event).toBeTruthy();
      expect(event.group).toBe("user_moi");
      expect(event.source).toBe("Webhook");
    });

    it("should create new Customer if not found", async () => {
      const uniqueEmail = `webhook-new-${Date.now()}@test.com`;
      const body = {
        eventType: "user_moi",
        payload: {
          customer: {
            name: "New Webhook Customer",
            email: uniqueEmail,
            phone: "0909 888 777",
          },
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      // Verify Customer was created
      const customer = await Customer.findOne({ email: uniqueEmail });
      expect(customer).toBeTruthy();
      expect(customer.name).toBe("New Webhook Customer");
      expect(customer.tags).toContain("#Webhook");
    });

    it("should link existing Customer by email", async () => {
      // Use customer from fixtures (vip@test.com)
      const body = {
        eventType: "user_moi",
        payload: {
          customer: {
            name: "Should Match VIP Customer",
            email: "vip@test.com",
            phone: "0000000000",
          },
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event).toBeTruthy();
      expect(event.customerId).toBe("TEST-CUST001");
    });

    it("should create WebhookLog with status=processed", async () => {
      const deliveryId = crypto.randomUUID();
      const body = buildUserMoiPayload();

      await webhookPost(body, { deliveryId });

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
  // Event Processing — biz_moi
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Processing: biz_moi", () => {
    it("should create Event with group=biz_moi", async () => {
      const body = {
        eventType: "biz_moi",
        payload: {
          customer: { name: "Biz Customer", email: "biz@test.com" },
          biz: { id: "BIZ-001", tags: ["ecommerce"] },
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event).toBeTruthy();
      expect(event.group).toBe("biz_moi");
      expect(event.biz.id).toBe("BIZ-001");
    });

    it("should link existing Customer if found", async () => {
      const body = {
        eventType: "biz_moi",
        payload: {
          customer: { email: "vip@test.com" },
          biz: { id: "BIZ-002" },
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customerId).toBe("TEST-CUST001");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Processing — sap_het_han
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Processing: sap_het_han", () => {
    it("should create Event with group=sap_het_han", async () => {
      const body = {
        eventType: "sap_het_han",
        payload: {
          customer: { name: "Expiring Customer", email: "expire@test.com" },
          biz: { id: "BIZ-EXP-001" },
          plan: { name: "PRO", daysLeft: 5, expiryDate: "2026-05-01" },
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event).toBeTruthy();
      expect(event.group).toBe("sap_het_han");
      expect(event.plan.daysLeft).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Processing — can_nang_cap
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Processing: can_nang_cap", () => {
    it("should create Event with group=can_nang_cap", async () => {
      const body = {
        eventType: "can_nang_cap",
        payload: {
          customer: { name: "Upgrade Customer", email: "upgrade@test.com" },
          biz: { id: "BIZ-UPG-001" },
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event).toBeTruthy();
      expect(event.group).toBe("can_nang_cap");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Flexible payload structure
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Flexible Payload Handling", () => {
    it("should handle flat customer fields in payload", async () => {
      const body = {
        eventType: "user_moi",
        payload: {
          customerName: "Flat Customer",
          customerEmail: `flat-${Date.now()}@test.com`,
          customerPhone: "0999 111 222",
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customer.name).toBe("Flat Customer");
    });

    it("should handle direct name/email in payload (fallback)", async () => {
      const body = {
        eventType: "user_moi",
        payload: {
          name: "Direct Customer",
          email: `direct-${Date.now()}@test.com`,
          phone: "0999 333 444",
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customer.name).toBe("Direct Customer");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WebhookLog tracking
  // ═══════════════════════════════════════════════════════════════════════════

  describe("WebhookLog", () => {
    it("should store the full payload in WebhookLog", async () => {
      const deliveryId = crypto.randomUUID();
      const payloadData = { customer: { name: "Log Test" }, extra: { field: 123 } };
      const body = { eventType: "user_moi", payload: payloadData };

      await webhookPost(body, { deliveryId });

      const log = await WebhookLog.findOne({ deliveryId });
      expect(log).toBeTruthy();
      expect(log.payload).toBeTruthy();
      expect(log.payload.extra).toEqual({ field: 123 });
    });

    it("should store IP address in WebhookLog", async () => {
      const deliveryId = crypto.randomUUID();
      const body = buildUserMoiPayload();

      await webhookPost(body, { deliveryId });

      const log = await WebhookLog.findOne({ deliveryId });
      expect(log).toBeTruthy();
      expect(log.ipAddress).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Assignee Resolution
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Assignee Resolution", () => {
    it("should resolve assignee by assigneeId", async () => {
      const body = {
        eventType: "user_moi",
        payload: {
          customer: { name: "Cust A", email: `assignee-id-${Date.now()}@test.com` },
          assigneeId: "TEST-USER004", // Staff1 from fixtures
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBe("TEST-USER004");
      expect(event.assignee.name).toBe("Test Staff One");
    });

    it("should resolve assignee by nested email", async () => {
      const body = {
        eventType: "biz_moi",
        payload: {
          customer: { name: "Cust B", email: "custb@test.com" },
          assignee: { email: "staff1@test.com" },
          biz: { id: "BIZ-ASG-001" },
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBe("TEST-USER004");
      expect(event.assignee.name).toBe("Test Staff One");
    });

    it("should resolve assignee by nested name", async () => {
      const body = {
        eventType: "sap_het_han",
        payload: {
          customer: { name: "Cust C", email: "custc@test.com" },
          assignee: { name: "Test Manager" },
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBe("TEST-USER003");
      expect(event.assignee.name).toBe("Test Manager");
    });

    it("should keep payload info when staff not found", async () => {
      const body = {
        eventType: "can_nang_cap",
        payload: {
          customer: { name: "Cust D", email: "custd@test.com" },
          assignee: { name: "Unknown Staff", email: "notexist@test.com", role: "Sale" },
          biz: { id: "BIZ-ASG-002" },
        },
      };

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBeNull();
      expect(event.assignee.name).toBe("Unknown Staff");
      expect(event.assignee.role).toBe("Sale");
    });

    it("should default to empty assignee when not provided", async () => {
      const body = buildUserMoiPayload();

      const res = await webhookPost(body);
      expect(res.status).toBe(201);

      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBeNull();
      expect(event.assignee.name).toBe("");
    });
  });
});

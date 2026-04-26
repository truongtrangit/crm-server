/**
 * tests/api/webhooks.test.js
 * Integration tests for the Webhook endpoints.
 */

const crypto = require("crypto");
const request = require("supertest");
const app = require("../../src/app");
const WebhookLog = require("../../src/models/WebhookLog");
const Event = require("../../src/models/Event");
const Customer = require("../../src/models/Customer");
const Subscription = require("../../src/models/Subscription");
const env = require("../../src/config/env");

const BASE_URL = "/api/v1/webhooks";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function webhookPost(eventSlug, body, options = {}) {
  const { token = env.webhookSecret, deliveryId } = options;
  const req = request(app)
    .post(`${BASE_URL}/${eventSlug}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
  if (deliveryId) req.set("X-Webhook-Delivery-Id", deliveryId);
  return req;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────────

describe("Webhook Endpoints", () => {
  beforeAll(async () => {
    try { await WebhookLog.collection.dropIndex("deliveryId_1"); } catch (_e) { /* */ }
    await WebhookLog.syncIndexes();
  });

  afterEach(async () => {
    await WebhookLog.deleteMany({});
    await Event.deleteMany({ source: "Webhook" });
    await Customer.deleteMany({ tags: "#Webhook" });
    await Subscription.deleteMany({ source: "SmaxAi" });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Authentication & Security
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Auth & Security", () => {
    it("should reject requests without Authorization header → 401", async () => {
      const res = await request(app).post(`${BASE_URL}/new-registration`).send({ customer: { name: "Test" } });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("WEBHOOK_AUTH_REQUIRED");
    });

    it("should reject requests with wrong token → 401", async () => {
      const res = await webhookPost("new-registration", { customer: { name: "Test" } }, { token: "wrong_token!" });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("WEBHOOK_INVALID_TOKEN");
    });

    it("should accept valid request without delivery ID → 201", async () => {
      const res = await webhookPost("new-registration", {
        id: "ext-auth-001", name: "Test User", email: `no-id-${Date.now()}@test.com`,
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("deliveryId");
      expect(res.body.data.eventType).toBe("user_moi");
    });

    it("should accept valid request with delivery ID → 201", async () => {
      const deliveryId = crypto.randomUUID();
      const res = await webhookPost("new-registration", {
        id: "ext-auth-002", name: "Test User", email: `with-id-${Date.now()}@test.com`,
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
      const body = { id: "ext-dup-001", name: "Dup Test", email: `dup-${Date.now()}@test.com` };
      const res1 = await webhookPost("new-registration", body, { deliveryId });
      expect(res1.status).toBe(201);
      const res2 = await webhookPost("new-registration", body, { deliveryId });
      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe("WEBHOOK_DUPLICATE_DELIVERY");
    });

    it("should allow same payload with different deliveryId", async () => {
      const body = { id: "ext-same-001", name: "Same", email: `same-${Date.now()}@test.com` };
      const res1 = await webhookPost("new-registration", body, { deliveryId: crypto.randomUUID() });
      const res2 = await webhookPost("new-registration", body, { deliveryId: crypto.randomUUID() });
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
    });

    it("should allow requests without deliveryId (no duplicate check)", async () => {
      const body = { id: "ext-noid-001", name: "No ID", email: `noid-${Date.now()}@test.com` };
      const res1 = await webhookPost("new-registration", body);
      const res2 = await webhookPost("new-registration", body);
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.data.deliveryId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/new-registration
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /webhooks/new-registration (SmaxAi flat payload)", () => {
    it("should create Event with group=user_moi", async () => {
      const res = await webhookPost("new-registration", {
        id: "ext-user-001",
        name: "New User",
        email: `new-reg-${Date.now()}@test.com`,
        roles: ["USER"],
      });
      expect(res.status).toBe(201);
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event).toBeTruthy();
      expect(event.group).toBe("user_moi");
      expect(event.source).toBe("Webhook");
    });

    it("should create new Customer if not found", async () => {
      const email = `webhook-new-${Date.now()}@test.com`;
      const res = await webhookPost("new-registration", {
        id: "ext-user-002",
        name: "New Webhook Customer",
        email,
        phone: "0909 888 777",
        roles: ["USER"],
        created_at: "2026-01-01T00:00:00Z",
      });
      expect(res.status).toBe(201);
      const customer = await Customer.findOne({ email });
      expect(customer).toBeTruthy();
      expect(customer.name).toBe("New Webhook Customer");
      expect(customer.tags).toContain("#Webhook");
      expect(customer.extraInfo.thirdPartyId).toBe("ext-user-002");
    });

    it("should build name from first_name + last_name", async () => {
      const email = `fname-${Date.now()}@test.com`;
      const res = await webhookPost("new-registration", {
        id: "ext-user-003",
        first_name: "John",
        last_name: "Doe",
        email,
        roles: ["USER"],
      });
      expect(res.status).toBe(201);
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customer.name).toBe("John Doe");
    });

    it("should link existing Customer by email", async () => {
      const res = await webhookPost("new-registration", {
        id: "ext-user-004",
        name: "Should Match VIP",
        email: "vip@test.com",
      });
      expect(res.status).toBe(201);
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customerId).toBe("TEST-CUST001");
    });

    it("should create WebhookLog with status=processed", async () => {
      const deliveryId = crypto.randomUUID();
      await webhookPost("new-registration", {
        id: "ext-user-005",
        name: "Log Test",
        email: `log-${Date.now()}@test.com`,
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
  // POST /webhooks/new-business (SmaxAi payload format)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /webhooks/new-business", () => {
    const bizPayload = {
      name: "Test Business",
      alias: "test-business",
      author_id: "ext-author-001",
      country: "VN",
      users: [
        { id: "ext-author-001", email: `biz-user-${Date.now()}@test.com`, name: "Biz User", role: "ADMIN", picture: null },
      ],
      order: { id: `ext-order-${Date.now()}`, code: "TRIAL-TEST", type: "FREE", months: 1, members: 5, pages: 1, customers: 1000, cards: 5000, time_start: "2026-01-01", time_end: "2026-02-01", bot_available: false, chat_available: false, used_cards: 0, total_customers: 0 },
      modules: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    it("should create Event with group=biz_moi", async () => {
      const res = await webhookPost("new-business", bizPayload);
      expect(res.status).toBe(201);
      expect(res.body.data.eventType).toBe("biz_moi");
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.group).toBe("biz_moi");
    });

    it("should create Customer from users[] array", async () => {
      const email = `biz-new-${Date.now()}@test.com`;
      const payload = { ...bizPayload, users: [{ ...bizPayload.users[0], email }] };
      const res = await webhookPost("new-business", payload);
      expect(res.status).toBe(201);
      const customer = await Customer.findOne({ email });
      expect(customer).toBeTruthy();
      expect(customer.tags).toContain("#Webhook");
    });

    it("should link existing Customer by email from users[]", async () => {
      const payload = {
        ...bizPayload,
        users: [{ ...bizPayload.users[0], email: "vip@test.com" }],
      };
      const res = await webhookPost("new-business", payload);
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
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.group).toBe("can_nang_cap");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Flexible payload structure
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Flexible Payload Handling (expiring-subscription)", () => {
    it("should handle nested customer fields", async () => {
      const res = await webhookPost("expiring-subscription", {
        customer: { name: "Nested Customer", email: `nested-${Date.now()}@test.com` },
        plan: { name: "PRO", daysLeft: 3 },
      });
      expect(res.status).toBe(201);
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customer.name).toBe("Nested Customer");
    });

    it("should handle flat customerName/customerEmail", async () => {
      const res = await webhookPost("expiring-subscription", {
        customerName: "Flat Customer",
        customerEmail: `flat-${Date.now()}@test.com`,
      });
      expect(res.status).toBe(201);
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.customer.name).toBe("Flat Customer");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Assignee Resolution
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Assignee Resolution", () => {
    it("should resolve assignee by assigneeId", async () => {
      const res = await webhookPost("new-registration", {
        id: "ext-asgn-001",
        name: "Cust A",
        email: `assignee-id-${Date.now()}@test.com`,
        assigneeId: "TEST-USER004",
      });
      expect(res.status).toBe(201);
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBe("TEST-USER004");
      expect(event.assignee.name).toBe("Test Staff One");
    });

    it("should resolve assignee by nested email (expiring-subscription)", async () => {
      const res = await webhookPost("expiring-subscription", {
        customer: { name: "Cust B", email: "custb@test.com" },
        assignee: { email: "staff1@test.com" },
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
        id: "ext-asgn-none",
        name: "No Assignee",
        email: `no-asgn-${Date.now()}@test.com`,
      });
      expect(res.status).toBe(201);
      const event = await Event.findOne({ id: res.body.data.eventId });
      expect(event.assigneeId).toBeNull();
      expect(event.assignee.name).toBe("");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/order-create
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /webhooks/order-create", () => {
    const orderPayload = {
      id: `ext-order-${Date.now()}`,
      code: "SAI-TEST001",
      type: "ENTERPRISE",
      status: "NONE",
      order_type: "subcription",
      currency: "USD",
      total_amount: 8.25,
      payment_gate: "manual",
      is_first_order: false,
      author_id: "ext-author-999",
      biz_id: "ext-biz-001",
      parent_order_id: null,
      time_start: "2026-01-01T00:00:00Z",
      time_end: null,
      pkgtime: { month: 1 },
      pkgmember: { number: 50 },
      pkgpage: { number: 1, name: "1 Channel" },
      pkgcustomer: { number: 300000 },
      pkgcard: { number: 100000 },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    it("should create Subscription record → 201", async () => {
      const res = await webhookPost("order-create", orderPayload);
      expect(res.status).toBe(201);
      expect(res.body.data.eventType).toBe("order_create");
      expect(res.body.data.subscriptionId).toBeTruthy();
      expect(res.body.data.eventId).toBeNull();
    });

    it("should store correct fields in Subscription", async () => {
      const res = await webhookPost("order-create", orderPayload);
      const sub = await Subscription.findOne({ id: res.body.data.subscriptionId });
      expect(sub).toBeTruthy();
      expect(sub.externalId).toBe(orderPayload.id);
      expect(sub.code).toBe("SAI-TEST001");
      expect(sub.planType).toBe("ENTERPRISE");
      expect(sub.status).toBe("none");
      expect(sub.maxMembers).toBe(50);
      expect(sub.maxPages).toBe(1);
      expect(sub.maxCards).toBe(100000);
      expect(sub.totalAmount).toBe(8.25);
      expect(sub.currency).toBe("USD");
      expect(sub.source).toBe("SmaxAi");
    });

    it("should dedup by externalId on second call", async () => {
      const payload = { ...orderPayload, id: `dedup-${Date.now()}` };
      const res1 = await webhookPost("order-create", payload);
      const res2 = await webhookPost("order-create", payload);
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.data.subscriptionId).toBe(res2.body.data.subscriptionId);
      // Only 1 record in DB
      const count = await Subscription.countDocuments({ externalId: payload.id });
      expect(count).toBe(1);
    });

    it("should store WebhookLog with createdSubscriptionId", async () => {
      const deliveryId = crypto.randomUUID();
      const res = await webhookPost("order-create", orderPayload, { deliveryId });
      const log = await WebhookLog.findOne({ deliveryId });
      expect(log).toBeTruthy();
      expect(log.status).toBe("processed");
      expect(log.createdSubscriptionId).toBe(res.body.data.subscriptionId);
      expect(log.createdEventId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /webhooks/order-active
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /webhooks/order-active", () => {
    it("should update existing Subscription to active", async () => {
      const extId = `active-${Date.now()}`;
      // First create
      await webhookPost("order-create", {
        id: extId, code: "SAI-ACT01", type: "ENTERPRISE", status: "NONE",
        order_type: "subcription", currency: "USD", total_amount: 5,
        payment_gate: "manual", author_id: "x", biz_id: "b1",
        time_start: "2026-01-01T00:00:00Z", time_end: null,
        pkgtime: { month: 1 }, pkgmember: { number: 10 }, pkgpage: { number: 2 },
        pkgcustomer: { number: 1000 }, pkgcard: { number: 5000 },
      });

      // Then activate
      const res = await webhookPost("order-active", {
        id: extId, code: "SAI-ACT01", type: "ENTERPRISE", status: "PAID",
        order_type: "subcription", currency: "USD", total_amount: 8.25,
        payment_gate: "manual", author_id: "x", biz_id: "b1",
        time_start: "2026-01-15T00:00:00Z", time_end: "2026-02-15T00:00:00Z",
        pkgtime: { month: 1 }, pkgmember: { number: 10 }, pkgpage: { number: 2 },
        pkgcustomer: { number: 1000 }, pkgcard: { number: 5000 },
        biz: { order: { members: 10, pages: 2, customers: 1000, cards: 5000, months: 1, bot_available: true, chat_available: true, used_cards: 0, total_customers: 0 } },
      });

      expect(res.status).toBe(201);
      const sub = await Subscription.findOne({ externalId: extId });
      expect(sub.status).toBe("active");
      expect(sub.endDate).toBeTruthy();
      expect(sub.totalAmount).toBe(8.25);
      expect(sub.botAvailable).toBe(true);
      expect(sub.chatAvailable).toBe(true);
    });

    it("should create new Subscription if order-create was missed", async () => {
      const extId = `orphan-active-${Date.now()}`;
      const res = await webhookPost("order-active", {
        id: extId, code: "SAI-ORPHAN", type: "ENTERPRISE", status: "PAID",
        order_type: "subcription", currency: "USD", total_amount: 10,
        payment_gate: "manual", author_id: "x", biz_id: "b2",
        time_start: "2026-01-01T00:00:00Z", time_end: "2026-02-01T00:00:00Z",
        pkgtime: { month: 1 }, pkgmember: { number: 5 }, pkgpage: { number: 1 },
        pkgcustomer: { number: 500 }, pkgcard: { number: 1000 },
        biz: { order: { members: 5, pages: 1, customers: 500, cards: 1000, months: 1 } },
      });
      expect(res.status).toBe(201);
      const sub = await Subscription.findOne({ externalId: extId });
      expect(sub).toBeTruthy();
      expect(sub.status).toBe("active");
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
      expect(log.payload.extra).toEqual({ field: 123 });
    });

    it("should store IP address in WebhookLog", async () => {
      const deliveryId = crypto.randomUUID();
      await webhookPost("new-registration", { customer: { name: "IP Test" } }, { deliveryId });
      const log = await WebhookLog.findOne({ deliveryId });
      expect(log).toBeTruthy();
      expect(log.ipAddress).toBeTruthy();
    });
  });
});

const WebhookLog = require("../models/WebhookLog");
const Event = require("../models/Event");
const Customer = require("../models/Customer");
const User = require("../models/User");
const { WEBHOOK_EVENT_TYPES } = require("../constants/webhookEvents");
const { generateSequentialId } = require("../utils/id");
const { createHttpError } = require("../utils/http");
const logger = require("../utils/logger");

/**
 * WebhookService — Strategy-based event processor.
 *
 * Design for queue migration:
 *   processEvent() is the single entry point for ALL event processing.
 *   Whether called from a webhook controller or a queue consumer,
 *   the logic is identical. Only the ingestion layer changes.
 *
 * Adding a new event type:
 *   1. Add constant in constants/webhookEvents.js
 *   2. Add processor method in this class
 *   3. Register in constructor
 */
class WebhookService {
  /** @type {Map<string, Function>} */
  #processors = new Map();

  constructor() {
    this.registerProcessor(WEBHOOK_EVENT_TYPES.USER_MOI, this.#processUserMoi.bind(this));
    this.registerProcessor(WEBHOOK_EVENT_TYPES.BIZ_MOI, this.#processBizMoi.bind(this));
    this.registerProcessor(WEBHOOK_EVENT_TYPES.SAP_HET_HAN, this.#processSapHetHan.bind(this));
    this.registerProcessor(WEBHOOK_EVENT_TYPES.CAN_NANG_CAP, this.#processCanNangCap.bind(this));
  }

  /**
   * Register an event processor.
   * @param {string} eventType
   * @param {Function} handler — async (payload) => { eventId, customerId }
   */
  registerProcessor(eventType, handler) {
    this.#processors.set(eventType, handler);
  }

  /**
   * Main entry point — can be called from webhook route OR queue consumer.
   *
   * @param {string} eventType — event type from WEBHOOK_EVENT_TYPES
   * @param {object} payload   — raw payload (structure varies per eventType)
   * @param {string} deliveryId — unique delivery ID for idempotency
   * @param {string} ipAddress  — sender IP
   * @param {string} [source]   — optional source identifier
   * @returns {Promise<object>} — { webhookLog, event }
   */
  async processEvent(eventType, payload, deliveryId, ipAddress, source) {
    // 1. Create webhook log with 'received' status
    const webhookLog = await WebhookLog.create({
      deliveryId,
      eventType,
      source: source || "external",
      payload,
      status: "received",
      ipAddress: ipAddress || "",
    });

    // 2. Find processor
    const processor = this.#processors.get(eventType);
    if (!processor) {
      webhookLog.status = "failed";
      webhookLog.error = `No processor registered for event type: ${eventType}`;
      await webhookLog.save();
      throw createHttpError(400, `Unsupported event type: ${eventType}`, {
        code: "WEBHOOK_UNSUPPORTED_EVENT",
      });
    }

    // 3. Process
    try {
      webhookLog.status = "processing";
      await webhookLog.save();

      const result = await processor(payload);

      // 4. Update log with success
      webhookLog.status = "processed";
      webhookLog.processedAt = new Date();
      webhookLog.createdEventId = result.eventId || null;
      webhookLog.createdCustomerId = result.customerId || null;
      await webhookLog.save();

      logger.info("Webhook processed successfully", {
        deliveryId,
        eventType,
        eventId: result.eventId,
      });

      return { webhookLog, event: result.event };
    } catch (error) {
      webhookLog.status = "failed";
      webhookLog.error = error.message;
      await webhookLog.save();

      logger.error("Webhook processing failed", {
        deliveryId,
        eventType,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Get webhook logs with pagination.
   * Used by internal API for monitoring.
   */
  async getLogs(queryParams) {
    const { status, eventType, page = 1, limit = 20 } = queryParams;
    const query = {};

    if (status) query.status = status;
    if (eventType) query.eventType = eventType;

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, totalItems] = await Promise.all([
      WebhookLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      WebhookLog.countDocuments(query),
    ]);

    return { logs, totalItems, page: Number(page), limit: Number(limit) };
  }

  // ─── Event Processors ────────────────────────────────────────────────────────

  /**
   * user_moi — Khách hàng đăng ký mới.
   * Tạo Event group 'user_moi' và upsert Customer by email/phone.
   */
  async #processUserMoi(payload) {
    const customerData = this.#extractCustomerData(payload);
    const customer = await this.#upsertCustomer(customerData);
    const { assigneeId, assignee } = await this.#resolveAssignee(payload);

    const event = await Event.create({
      id: await generateSequentialId(Event, "EVT", 3),
      name: payload.name || `User mới: ${customerData.name || "N/A"}`,
      sub: payload.sub || "",
      group: WEBHOOK_EVENT_TYPES.USER_MOI,
      customerId: customer?.id || null,
      customer: {
        name: customerData.name || "Unknown",
        avatar: customerData.avatar || "",
        role: customerData.role || "",
        email: customerData.email || "",
        phone: customerData.phone || "",
        source: customerData.source || "Webhook",
        address: customerData.address || "",
      },
      assigneeId,
      assignee,
      biz: payload.biz || { id: "", tags: [] },
      stage: payload.stage || "",
      source: "Webhook",
      tags: payload.tags || [],
      plan: payload.plan || {
        name: "TRIAL",
        cycle: "Thanh toán theo tháng",
        price: "0 đ",
        daysLeft: 30,
        expiryDate: "",
      },
      services: payload.services || [],
      quotas: payload.quotas || [],
      timeline: [
        {
          type: "event",
          title: "Sự kiện tạo tự động từ Webhook",
          time: new Date().toLocaleString("vi-VN"),
          content: `Khách hàng đăng ký mới: ${customerData.name || "N/A"}`,
          createdBy: "Webhook System",
        },
      ],
    });

    return {
      eventId: event.id,
      customerId: customer?.id || null,
      event,
    };
  }

  /**
   * biz_moi — Khách hàng tạo biz mới.
   * Tạo Event group 'biz_moi', link tới Customer nếu tìm thấy.
   */
  async #processBizMoi(payload) {
    const customerData = this.#extractCustomerData(payload);
    const existingCustomer = await this.#findCustomer(customerData);
    const { assigneeId, assignee } = await this.#resolveAssignee(payload);

    const event = await Event.create({
      id: await generateSequentialId(Event, "EVT", 3),
      name: payload.name || `Biz mới: ${payload.biz?.id || "N/A"}`,
      sub: payload.sub || "",
      group: WEBHOOK_EVENT_TYPES.BIZ_MOI,
      customerId: existingCustomer?.id || null,
      customer: {
        name: customerData.name || existingCustomer?.name || "Unknown",
        avatar: customerData.avatar || existingCustomer?.avatar || "",
        role: customerData.role || "",
        email: customerData.email || existingCustomer?.email || "",
        phone: customerData.phone || existingCustomer?.phone || "",
        source: customerData.source || "Webhook",
        address: customerData.address || "",
      },
      assigneeId,
      assignee,
      biz: payload.biz || { id: "", tags: [] },
      stage: payload.stage || "",
      source: "Webhook",
      tags: payload.tags || [],
      plan: payload.plan || {},
      services: payload.services || [],
      quotas: payload.quotas || [],
      timeline: [
        {
          type: "event",
          title: "Sự kiện tạo tự động từ Webhook",
          time: new Date().toLocaleString("vi-VN"),
          content: `Biz mới được tạo: ${payload.biz?.id || "N/A"}`,
          createdBy: "Webhook System",
        },
      ],
    });

    return {
      eventId: event.id,
      customerId: existingCustomer?.id || null,
      event,
    };
  }

  /**
   * sap_het_han — Biz cần gia hạn.
   * Tạo Event group 'sap_het_han'.
   */
  async #processSapHetHan(payload) {
    const customerData = this.#extractCustomerData(payload);
    const existingCustomer = await this.#findCustomer(customerData);
    const { assigneeId, assignee } = await this.#resolveAssignee(payload);

    const event = await Event.create({
      id: await generateSequentialId(Event, "EVT", 3),
      name: payload.name || `Sắp hết hạn: ${payload.biz?.id || customerData.name || "N/A"}`,
      sub: payload.sub || "",
      group: WEBHOOK_EVENT_TYPES.SAP_HET_HAN,
      customerId: existingCustomer?.id || null,
      customer: {
        name: customerData.name || existingCustomer?.name || "Unknown",
        avatar: customerData.avatar || existingCustomer?.avatar || "",
        role: customerData.role || "",
        email: customerData.email || existingCustomer?.email || "",
        phone: customerData.phone || existingCustomer?.phone || "",
        source: customerData.source || "Webhook",
        address: customerData.address || "",
      },
      assigneeId,
      assignee,
      biz: payload.biz || { id: "", tags: [] },
      stage: payload.stage || "",
      source: "Webhook",
      tags: payload.tags || [],
      plan: payload.plan || {},
      services: payload.services || [],
      quotas: payload.quotas || [],
      timeline: [
        {
          type: "event",
          title: "Sự kiện tạo tự động từ Webhook",
          time: new Date().toLocaleString("vi-VN"),
          content: `Biz cần gia hạn: ${payload.biz?.id || "N/A"}`,
          createdBy: "Webhook System",
        },
      ],
    });

    return {
      eventId: event.id,
      customerId: existingCustomer?.id || null,
      event,
    };
  }

  /**
   * can_nang_cap — Biz cần nâng cấp.
   * Tạo Event group 'can_nang_cap'.
   */
  async #processCanNangCap(payload) {
    const customerData = this.#extractCustomerData(payload);
    const existingCustomer = await this.#findCustomer(customerData);
    const { assigneeId, assignee } = await this.#resolveAssignee(payload);

    const event = await Event.create({
      id: await generateSequentialId(Event, "EVT", 3),
      name: payload.name || `Cần nâng cấp: ${payload.biz?.id || customerData.name || "N/A"}`,
      sub: payload.sub || "",
      group: WEBHOOK_EVENT_TYPES.CAN_NANG_CAP,
      customerId: existingCustomer?.id || null,
      customer: {
        name: customerData.name || existingCustomer?.name || "Unknown",
        avatar: customerData.avatar || existingCustomer?.avatar || "",
        role: customerData.role || "",
        email: customerData.email || existingCustomer?.email || "",
        phone: customerData.phone || existingCustomer?.phone || "",
        source: customerData.source || "Webhook",
        address: customerData.address || "",
      },
      assigneeId,
      assignee,
      biz: payload.biz || { id: "", tags: [] },
      stage: payload.stage || "",
      source: "Webhook",
      tags: payload.tags || [],
      plan: payload.plan || {},
      services: payload.services || [],
      quotas: payload.quotas || [],
      timeline: [
        {
          type: "event",
          title: "Sự kiện tạo tự động từ Webhook",
          time: new Date().toLocaleString("vi-VN"),
          content: `Biz cần nâng cấp: ${payload.biz?.id || "N/A"}`,
          createdBy: "Webhook System",
        },
      ],
    });

    return {
      eventId: event.id,
      customerId: existingCustomer?.id || null,
      event,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Extract customer data from webhook payload.
   * Supports both flat and nested structures:
   *   { customer: { name, email, ... } }     — nested
   *   { customerName, customerEmail, ... }    — flat
   *   { name, email, ... }                    — direct in payload
   */
  #extractCustomerData(payload) {
    // Nested structure (preferred)
    if (payload.customer && typeof payload.customer === "object") {
      return {
        name: payload.customer.name || "",
        email: payload.customer.email || "",
        phone: payload.customer.phone || "",
        avatar: payload.customer.avatar || "",
        role: payload.customer.role || "",
        source: payload.customer.source || "",
        address: payload.customer.address || "",
      };
    }

    // Flat structure with prefix
    if (payload.customerName || payload.customerEmail) {
      return {
        name: payload.customerName || "",
        email: payload.customerEmail || "",
        phone: payload.customerPhone || "",
        avatar: payload.customerAvatar || "",
        role: payload.customerRole || "",
        source: payload.customerSource || "",
        address: payload.customerAddress || "",
      };
    }

    // Direct in payload (fallback)
    return {
      name: payload.name || "",
      email: payload.email || "",
      phone: payload.phone || "",
      avatar: payload.avatar || "",
      role: payload.role || "",
      source: payload.source || "",
      address: payload.address || "",
    };
  }

  /**
   * Find existing Customer by email or phone.
   */
  async #findCustomer(customerData) {
    const orConditions = [];
    if (customerData.email) orConditions.push({ email: customerData.email });
    if (customerData.phone) orConditions.push({ phone: customerData.phone });

    if (orConditions.length === 0) return null;

    return Customer.findOne({ $or: orConditions });
  }

  /**
   * Resolve assignee from webhook payload.
   * Looks up User by assigneeId, email, or name — follows same pattern as EventService.
   *
   * Supports:
   *   { assigneeId: "USER001" }                     — direct ID
   *   { assignee: { email: "staff@test.com" } }     — nested lookup
   *   { assignee: { name: "Staff Name" } }          — fallback lookup
   *
   * @returns {{ assigneeId: string|null, assignee: object }}
   */
  async #resolveAssignee(payload) {
    const defaultAssignee = { name: "", avatar: "", role: "", department: [], group: [] };
    const payloadAssignee = payload.assignee || {};
    const lookupId = payload.assigneeId || null;

    // Nothing to resolve
    if (!lookupId && !payloadAssignee.email && !payloadAssignee.phone && !payloadAssignee.name) {
      return { assigneeId: null, assignee: defaultAssignee };
    }

    // Build search query
    const staffQuery = [];
    if (lookupId) staffQuery.push({ id: lookupId });
    if (payloadAssignee.email) staffQuery.push({ email: payloadAssignee.email });
    if (payloadAssignee.name) staffQuery.push({ name: payloadAssignee.name });
    if (payloadAssignee.phone) staffQuery.push({ phone: payloadAssignee.phone });

    const staff = await User.findOne({ $or: staffQuery });

    if (!staff) {
      // Staff not found — keep info from payload but no link
      return {
        assigneeId: null,
        assignee: {
          name: payloadAssignee.name || "",
          avatar: payloadAssignee.avatar || "",
          role: payloadAssignee.role || "",
          department: [],
          group: [],
        },
      };
    }

    return {
      assigneeId: staff.id,
      assignee: {
        name: staff.name,
        avatar: staff.avatar || payloadAssignee.avatar || "",
        role: staff.roleId || payloadAssignee.role || "",
        department: staff.department || [],
        group: staff.group || [],
      },
    };
  }

  /**
   * Upsert Customer — create if not found, update if found.
   * Only creates Customer for user_moi events (new registrations).
   */
  async #upsertCustomer(customerData) {
    if (!customerData.email && !customerData.phone) return null;

    const existing = await this.#findCustomer(customerData);

    if (existing) {
      // Update with any new info
      if (customerData.name) existing.name = customerData.name;
      if (customerData.phone && !existing.phone) existing.phone = customerData.phone;
      if (customerData.avatar) existing.avatar = customerData.avatar;
      await existing.save();
      return existing;
    }

    // Create new Customer
    const customer = await Customer.create({
      id: await generateSequentialId(Customer, "CUST", 3),
      name: customerData.name || "Unknown",
      email: customerData.email || "",
      phone: customerData.phone || "",
      avatar:
        customerData.avatar ||
        `https://i.pravatar.cc/150?u=${encodeURIComponent(customerData.email || customerData.name || "unknown")}`,
      type: "New",
      biz: [],
      platforms: [],
      group: "",
      registeredAt: new Date().toLocaleDateString("vi-VN"),
      tags: ["#Webhook"],
    });

    return customer;
  }
}

module.exports = new WebhookService();

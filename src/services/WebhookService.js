const WebhookLog = require("../models/WebhookLog");
const Event = require("../models/Event");
const Customer = require("../models/Customer");
const User = require("../models/User");
const { WEBHOOK_EVENT_TYPES } = require("../constants/webhookEvents");
const { generateMonotonicId } = require("../utils/id");
const { createHttpError } = require("../utils/http");
const logger = require("../utils/logger");
const { CUSTOMER_TYPES_MAPPING } = require("../constants/appData");
const { resolvePagination, buildPaginatedResponse } = require("../utils/pagination");

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
    this.registerProcessor(WEBHOOK_EVENT_TYPES.USER_LOGIN, this.#processUserLogin.bind(this));
    this.registerProcessor(WEBHOOK_EVENT_TYPES.NEW_REGISTRATION, this.#processNewRegistration.bind(this));
    this.registerProcessor(WEBHOOK_EVENT_TYPES.NEW_BUSINESS, this.#processNewBiz.bind(this));
    this.registerProcessor(WEBHOOK_EVENT_TYPES.PLAN_EXPIRED, this.#processPlanExpired.bind(this));
    this.registerProcessor(WEBHOOK_EVENT_TYPES.PLAN_UPGRADE, this.#processPlanUpgrade.bind(this));
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
    // 1. Create webhook log with 'received' status — always log raw payload
    const webhookLog = await WebhookLog.create({
      ...(deliveryId ? { deliveryId } : {}),
      eventType,
      source: source || "external",
      payload,
      status: "received",
      ipAddress: ipAddress || "",
    });

    // Always log the raw payload for inspection
    logger.info("Webhook received — raw payload logged", {
      deliveryId,
      eventType,
      ipAddress,
      payload: JSON.stringify(payload, null, 2),
    });

    // 2. Find processor — if none registered, just log and return
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
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Get webhook logs with pagination.
   * Used by internal API for monitoring.
   */
  async getLogs(queryParams) {
    const { status, eventType } = queryParams;
    const { page, limit, skip } = resolvePagination(queryParams);
    const query = {};

    if (status) query.status = status;
    if (eventType) query.eventType = eventType;

    const [logs, totalItems] = await Promise.all([
      WebhookLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebhookLog.countDocuments(query),
    ]);

    return buildPaginatedResponse(logs, totalItems, page, limit);
  }

  // ─── Event Processors ────────────────────────────────────────────────────────

  /**
   * user_login — User đăng nhập.
   * Kiểm tra Customer theo email/phone, tạo mới nếu chưa có.
   * Cập nhật lastLoginAt và extraInfo.
   * Không tạo Event — chỉ sync dữ liệu Customer.
   */
  async #processUserLogin(payload) {
    const email = (payload.email || "").trim().toLowerCase();
    const phone = (payload.phone || "").trim();
    const name = payload.name || [payload.first_name, payload.last_name].filter(Boolean).join(" ") || "";
    const avatar = payload.picture || "";

    // Build extraInfo from third-party data
    const extraInfo = {
      thirdPartyId: payload.id || null,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      country: payload.country || null,
    };

    // Format dates — third-party sends ISO strings
    const registeredAt = payload.created_at
      ? new Date(payload.created_at).toLocaleDateString("vi-VN")
      : "";
    const lastLoginAt = payload.updated_at
      ? new Date(payload.updated_at).toLocaleDateString("vi-VN")
      : new Date().toLocaleDateString("vi-VN");

    // Find existing customer by email or phone
    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });

    let customer = null;

    if (orConditions.length > 0) {
      customer = await Customer.findOneWithDeleted({ $or: orConditions });
    }

    // Customer đã bị xóa mềm — không tạo mới, chỉ log cảnh báo
    if (customer?.isDeleted) {
      logger.warn("User login — customer was soft-deleted, skipping", {
        customerId: customer.id,
        email,
      });
      return {
        eventId: null,
        customerId: customer.id,
      };
    }

    if (customer) {
      // Update existing customer
      customer.lastLoginAt = lastLoginAt;
      customer.extraInfo = extraInfo;
      if (name && !customer.name) customer.name = name;
      if (phone && !customer.phone) customer.phone = phone;
      if (avatar && !customer.avatar) customer.avatar = avatar;
      await customer.save();

      logger.info("User login — existing customer updated", {
        customerId: customer.id,
        email,
      });
    } else {
      // Create new customer
      customer = await Customer.create({
        id: await generateMonotonicId("CUST"),
        name: name || "Unknown",
        email: email || "",
        phone: phone || "",
        avatar: avatar || `https://ui-avatars.com/api/?name=${name?.split(" ")?.join("+")}&background=random`,
        type: CUSTOMER_TYPES_MAPPING.NEW_CUSTOMER,
        biz: [],
        platforms: ["SmaxAi"],
        group: "",
        registeredAt,
        lastLoginAt,
        tags: ["#Webhook"],
        extraInfo,
      });

      logger.info("User login — new customer created", {
        customerId: customer.id,
        email,
      });
    }

    return {
      eventId: null,
      customerId: customer.id,
    };
  }

  /**
   * user_moi — Khách hàng đăng ký mới.
   * Tạo Event group 'user_moi' và upsert Customer by email/phone.
   */
  async #processNewRegistration(payload) {
    const customerData = this.#extractCustomerData(payload);
    const customer = await this.#upsertCustomer(customerData);
    const { assigneeId, assignee } = await this.#resolveAssignee(payload);

    const event = await Event.create({
      id: await generateMonotonicId("EVT"),
      name: payload.name || `User mới: ${customerData.name || "N/A"}`,
      sub: payload.sub || "",
      group: WEBHOOK_EVENT_TYPES.NEW_REGISTRATION,
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
  async #processNewBiz(payload) {
    const customerData = this.#extractCustomerData(payload);
    const existingCustomer = await this.#findCustomer(customerData);
    const { assigneeId, assignee } = await this.#resolveAssignee(payload);

    const event = await Event.create({
      id: await generateMonotonicId("EVT"),
      name: payload.name || `Biz mới: ${payload.biz?.id || "N/A"}`,
      sub: payload.sub || "",
      group: WEBHOOK_EVENT_TYPES.NEW_BUSINESS,
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
  async #processPlanExpired(payload) {
    const customerData = this.#extractCustomerData(payload);
    const existingCustomer = await this.#findCustomer(customerData);
    const { assigneeId, assignee } = await this.#resolveAssignee(payload);

    const event = await Event.create({
      id: await generateMonotonicId("EVT"),
      name: payload.name || `Sắp hết hạn: ${payload.biz?.id || customerData.name || "N/A"}`,
      sub: payload.sub || "",
      group: WEBHOOK_EVENT_TYPES.PLAN_EXPIRED,
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
  async #processPlanUpgrade(payload) {
    const customerData = this.#extractCustomerData(payload);
    const existingCustomer = await this.#findCustomer(customerData);
    const { assigneeId, assignee } = await this.#resolveAssignee(payload);

    const event = await Event.create({
      id: await generateMonotonicId("EVT"),
      name: payload.name || `Cần nâng cấp: ${payload.biz?.id || customerData.name || "N/A"}`,
      sub: payload.sub || "",
      group: WEBHOOK_EVENT_TYPES.PLAN_UPGRADE,
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
      id: await generateMonotonicId("CUST"),
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

const WebhookLog = require("../models/WebhookLog");
const Event = require("../models/Event");
const Customer = require("../models/Customer");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
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
    this.registerProcessor(WEBHOOK_EVENT_TYPES.ORDER_CREATE, this.#processOrderCreate.bind(this));
    this.registerProcessor(WEBHOOK_EVENT_TYPES.ORDER_ACTIVE, this.#processOrderActive.bind(this));
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
      webhookLog.createdSubscriptionId = result.subscriptionId || null;
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
    // ─── 1. Resolve Customer from users array ─────────────────────────────
    const users = Array.isArray(payload.users) ? payload.users : [];
    // Ưu tiên user trùng author_id, fallback lấy user đầu tiên
    const primaryUser =
      users.find((u) => u.id === payload.author_id) || users[0] || {};

    const userEmail = (primaryUser.email || "").trim().toLowerCase();
    const userPhone = (primaryUser.phone || "").trim();
    const userName = primaryUser.name || "";
    const userAvatar = primaryUser.picture || "";

    let customer = null;
    const orConditions = [];
    if (userEmail) orConditions.push({ email: userEmail });
    if (userPhone) orConditions.push({ phone: userPhone });

    if (orConditions.length > 0) {
      customer = await Customer.findOneWithDeleted({ $or: orConditions });
    }

    // Nếu customer đã bị soft-delete, chỉ log
    if (customer?.isDeleted) {
      logger.warn("Biz create — customer was soft-deleted, skipping customer link", {
        customerId: customer.id,
        email: userEmail,
      });
      customer = null;
    }

    if (!customer && (userEmail || userPhone)) {
      // Tạo customer mới từ user
      customer = await Customer.create({
        id: await generateMonotonicId("CUST"),
        name: userName || "Unknown",
        email: userEmail || "",
        phone: userPhone || "",
        avatar: userAvatar || `https://ui-avatars.com/api/?name=${userName?.split(" ")?.join("+")}&background=random`,
        type: CUSTOMER_TYPES_MAPPING.NEW_CUSTOMER,
        biz: [payload.name || ""],
        platforms: ["SmaxAi"],
        group: "",
        registeredAt: payload.created_at
          ? new Date(payload.created_at).toLocaleDateString("vi-VN")
          : "",
        lastLoginAt: payload.updated_at
          ? new Date(payload.updated_at).toLocaleDateString("vi-VN")
          : "",
        tags: ["#Webhook"],
        extraInfo: {
          thirdPartyId: primaryUser.id || null,
          roles: primaryUser.role ? [primaryUser.role] : [],
          country: payload.country || null,
        },
      });

      logger.info("Biz create — new customer created from users[]", {
        customerId: customer.id,
        email: userEmail,
      });
    } else if (customer) {
      // Cập nhật biz list cho customer đã tồn tại
      const bizName = payload.name || "";
      if (bizName && !customer.biz.includes(bizName)) {
        customer.biz.push(bizName);
        await customer.save();
      }
    }

    // ─── 2. Resolve Subscription from order ───────────────────────────────
    const order = payload.order || {};
    let subscription = null;

    if (order.id) {
      // Tìm subscription đã tồn tại theo externalId
      subscription = await Subscription.findOne({ externalId: order.id });

      if (!subscription) {
        const now = new Date();
        const endDate = order.time_end ? new Date(order.time_end) : null;
        const status = endDate && endDate > now ? "active" : "expired";

        subscription = await Subscription.create({
          id: await generateMonotonicId("SUB"),
          externalId: order.id,
          source: "SmaxAi",
          code: order.code || "",
          planType: order.type || "FREE",
          name: `${order.type || "FREE"} — ${order.code || "N/A"}`,
          months: order.months || 0,
          startDate: order.time_start ? new Date(order.time_start) : null,
          endDate,
          maxMembers: order.members || 0,
          maxPages: order.pages || 0,
          maxCustomers: order.customers || 0,
          maxCards: order.cards || 0,
          usedCards: order.used_cards || 0,
          totalCustomers: order.total_customers || 0,
          botAvailable: order.bot_available || false,
          chatAvailable: order.chat_available || false,
          customerId: customer?.id || null,
          status,
          metadata: order,
        });

        logger.info("Biz create — subscription created", {
          subscriptionId: subscription.id,
          externalId: order.id,
          planType: order.type,
        });
      } else {
        // Nếu đã có, cập nhật customerId nếu chưa link
        if (!subscription.customerId && customer) {
          subscription.customerId = customer.id;
          await subscription.save();
        }
      }
    }

    // ─── 3. Build plan snapshot cho Event ──────────────────────────────────
    const endDate = order.time_end ? new Date(order.time_end) : null;
    const daysLeft = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    const plan = {
      name: `${order.type} - ${order.code}`,
      cycle: `${order.months || 0} tháng`,
      price: order.type === "FREE" ? "0 đ" : "",
      daysLeft,
      expiryDate: endDate ? endDate.toLocaleDateString("vi-VN") : "",
    };

    // ─── 4. Build services & quotas ───────────────────────────────────────
    const services = [
      { name: "Bot", active: order.bot_available || false },
      { name: "Chat", active: order.chat_available || false },
    ];
    // Thêm modules từ payload
    // if (Array.isArray(payload.modules)) {
    //   for (const mod of payload.modules) {
    //     if (mod.alias) services.push({ name: mod.alias, active: true });
    //   }
    // }

    const quotas = [
      { name: "Members", used: (payload.users || []).length, total: order.members || 0, color: "blue" },
      { name: "Pages", used: (payload.page_pids || []).length, total: order.pages || 0, color: "green" },
      { name: "Customers", used: order.total_customers || 0, total: order.customers || 0, color: "purple" },
      { name: "Cards", used: order.used_cards || 0, total: order.cards || 0, color: "orange" },
    ];

    // ─── 5. Create Event ──────────────────────────────────────────────────
    const event = await Event.create({
      id: await generateMonotonicId("EVT"),
      name: payload.name || payload.alias || "Biz mới",
      sub: payload.desc || "",
      group: WEBHOOK_EVENT_TYPES.NEW_BUSINESS,
      customerId: customer?.id || null,
      customer: {
        name: customer?.name || userName || "Unknown",
        avatar: customer?.avatar || userAvatar || "",
        role: "",
        email: customer?.email || userEmail || "",
        phone: customer?.phone || userPhone || "",
        source: "SmaxAi",
        address: "",
      },
      biz: {
        id: payload.name || payload.alias || "",
        tags: [],
      },
      assigneeId: null,
      assignee: { name: "", avatar: "", role: "", department: [], group: [] },
      stage: "",
      source: "SmaxAi",
      subscriptionId: subscription?.id || null,
      tags: ["#Webhook", `#${order.type || "FREE"}`],
      plan,
      services,
      quotas,
      timeline: [
        {
          type: "event",
          title: "Biz mới tạo từ Webhook",
          time: new Date().toLocaleString("vi-VN"),
          content: `Biz "${payload.name || payload.alias || "N/A"}" được tạo bởi ${userName || "N/A"} — Gói: ${order.type || "FREE"} (${order.code || "N/A"})`,
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

  /**
   * order_create — Đơn hàng / subscription mới.
   * Chỉ tạo Subscription record, lưu DB. Không tạo Event.
   * Khi biz nào sử dụng subscriptionId thì link qua sau.
   */
  async #processOrderCreate(payload) {
    // ─── 1. Dedup: kiểm tra externalId ─────────────────────────────────────
    const existingSub = await Subscription.findOne({ externalId: payload.id });
    if (existingSub) {
      logger.info("Order create — subscription already exists, skipping", {
        subscriptionId: existingSub.id,
        externalId: payload.id,
      });
      return {
        eventId: null,
        customerId: existingSub.customerId || null,
        subscriptionId: existingSub.id,
      };
    }

    // ─── 2. Resolve Customer from author_id ────────────────────────────────
    // NOTE: Author maybe not Customer
    let customer = null;
    if (payload.author_id) {
      customer = await Customer.findOne({
        "extraInfo.thirdPartyId": payload.author_id,
      });
    }

    // ─── 3. Extract package quotas ─────────────────────────────────────────
    const pkgtime = payload.pkgtime || {};
    const pkgmember = payload.pkgmember || {};
    const pkgpage = payload.pkgpage || {};
    const pkgcustomer = payload.pkgcustomer || {};
    const pkgcard = payload.pkgcard || {};

    // ─── 4. Map status ─────────────────────────────────────────────────────
    const rawStatus = (payload.status || "").toLowerCase();
    const statusMap = {
      paid: "paid",
      none: "none",
      active: "active",
      expired: "expired",
      cancelled: "cancelled",
    };
    const status = statusMap[rawStatus] || "pending";

    // ─── 5. Build name ─────────────────────────────────────────────────────
    const planType = payload.type || "FREE";
    const name = [
      planType,
      payload.code || "",
      pkgpage.name ? `(${pkgpage.name})` : "",
    ]
      .filter(Boolean)
      .join(" — ");

    // ─── 6. Create Subscription ────────────────────────────────────────────
    const subscription = await Subscription.create({
      id: await generateMonotonicId("SUB"),
      externalId: payload.id,
      source: "SmaxAi",
      code: payload.code || "",
      planType,
      name,
      months: pkgtime.month || 0,
      startDate: payload.time_start ? new Date(payload.time_start) : null,
      endDate: payload.time_end ? new Date(payload.time_end) : null,
      maxMembers: pkgmember.number || 0,
      maxPages: pkgpage.number || 0,
      maxCustomers: pkgcustomer.number || 0,
      maxCards: pkgcard.number || 0,
      totalAmount: payload.total_amount || 0,
      currency: payload.currency || "USD",
      paymentGate: payload.payment_gate || "",
      orderType: payload.order_type || "",
      isFirstOrder: payload.is_first_order || false,
      customerId: customer?.id || null,
      externalBizId: payload.biz_id || null,
      externalAuthorId: payload.author_id || null,
      parentOrderId: payload.parent_order_id || null,
      status,
      metadata: payload,
      createdAt: payload.created_at ? new Date(payload.created_at) : null,
      updatedAt: payload.updated_at ? new Date(payload.updated_at) : null,
    });

    logger.info("Order create — subscription created", {
      subscriptionId: subscription.id,
      externalId: payload.id,
      code: payload.code,
      planType,
      status,
      customerId: customer?.id || null,
    });

    return {
      eventId: null,
      customerId: customer?.id || null,
      subscriptionId: subscription.id,
    };
  }

  /**
   * order_active — Kích hoạt đơn hàng (PAID).
   * Tìm Subscription đã tạo từ order_create và cập nhật status + dates + quotas.
   * Nếu chưa có thì tạo mới (edge case nếu order_create không đến).
   */
  async #processOrderActive(payload) {
    // ─── 1. Find existing Subscription ─────────────────────────────────────
    let subscription = await Subscription.findOne({ externalId: payload.id });

    // Thông tin quotas từ biz.order (chuẩn nhất khi đã active)
    const bizOrder = payload.biz?.order || {};
    const pkgtime = payload.pkgtime || {};
    const pkgmember = payload.pkgmember || {};
    const pkgpage = payload.pkgpage || {};
    const pkgcustomer = payload.pkgcustomer || {};
    const pkgcard = payload.pkgcard || {};

    if (subscription) {
      // ─── 2a. Update existing subscription ───────────────────────────────
      subscription.status = "active";
      subscription.startDate = payload.time_start
        ? new Date(payload.time_start)
        : subscription.startDate;
      subscription.endDate = payload.time_end
        ? new Date(payload.time_end)
        : subscription.endDate;

      // Refresh quotas từ biz.order (có dữ liệu chuẩn sau khi active)
      if (bizOrder.members) subscription.maxMembers = bizOrder.members;
      if (bizOrder.pages) subscription.maxPages = bizOrder.pages;
      if (bizOrder.customers) subscription.maxCustomers = bizOrder.customers;
      if (bizOrder.cards) subscription.maxCards = bizOrder.cards;
      if (bizOrder.used_cards !== undefined) subscription.usedCards = bizOrder.used_cards;
      if (bizOrder.total_customers !== undefined) subscription.totalCustomers = bizOrder.total_customers;
      if (bizOrder.bot_available !== undefined) subscription.botAvailable = bizOrder.bot_available;
      if (bizOrder.chat_available !== undefined) subscription.chatAvailable = bizOrder.chat_available;
      if (bizOrder.months) subscription.months = bizOrder.months;

      // Cập nhật amount & payment
      subscription.totalAmount = payload.total_amount || subscription.totalAmount;
      subscription.paymentGate = payload.payment_gate || subscription.paymentGate;

      // Lưu lại full payload mới vào metadata
      subscription.metadata = payload;

      await subscription.save();

      logger.info("Order active — subscription updated to active", {
        subscriptionId: subscription.id,
        externalId: payload.id,
        status: "active",
      });

      return {
        eventId: null,
        customerId: subscription.customerId || null,
        subscriptionId: subscription.id,
      };
    }

    // ─── 2b. Create new (edge case) ───────────────────────────────────────
    let customer = null;
    if (payload.author_id) {
      customer = await Customer.findOne({
        "extraInfo.thirdPartyId": payload.author_id,
      });
    }

    const planType = payload.type || "FREE";
    const name = [planType, payload.code || "", pkgpage.name ? `(${pkgpage.name})` : ""]
      .filter(Boolean)
      .join(" — ");

    subscription = await Subscription.create({
      id: await generateMonotonicId("SUB"),
      externalId: payload.id,
      source: "SmaxAi",
      code: payload.code || "",
      planType,
      name,
      months: bizOrder.months || pkgtime.month || 0,
      startDate: payload.time_start ? new Date(payload.time_start) : null,
      endDate: payload.time_end ? new Date(payload.time_end) : null,
      maxMembers: bizOrder.members || pkgmember.number || 0,
      maxPages: bizOrder.pages || pkgpage.number || 0,
      maxCustomers: bizOrder.customers || pkgcustomer.number || 0,
      maxCards: bizOrder.cards || pkgcard.number || 0,
      usedCards: bizOrder.used_cards || 0,
      totalCustomers: bizOrder.total_customers || 0,
      botAvailable: bizOrder.bot_available || false,
      chatAvailable: bizOrder.chat_available || false,
      totalAmount: payload.total_amount || 0,
      currency: payload.currency || "USD",
      paymentGate: payload.payment_gate || "",
      orderType: payload.order_type || "",
      isFirstOrder: payload.is_first_order || false,
      customerId: customer?.id || null,
      externalBizId: payload.biz_id || null,
      externalAuthorId: payload.author_id || null,
      parentOrderId: payload.parent_order_id || null,
      status: "active",
      metadata: payload,
      created_at: payload.created_at ? new Date(payload.created_at) : undefined,
      updated_at: payload.updated_at ? new Date(payload.updated_at) : undefined,
    });

    logger.info("Order active — subscription created (no prior order_create)", {
      subscriptionId: subscription.id,
      externalId: payload.id,
    });

    return {
      eventId: null,
      customerId: customer?.id || null,
      subscriptionId: subscription.id,
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

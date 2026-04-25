const Event = require("../models/Event");
const Customer = require("../models/Customer");
const User = require("../models/User");
const EventActionChain = require("../models/EventActionChain");
const { generateMonotonicId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { resolvePagination } = require("../utils/pagination");
const { createHttpError } = require("../utils/http");

class EventService {
  async getEvents(queryParams, currentUser) {
    const { search = "", group, stage, assignee } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams || {});

    // Dùng $and để tránh conflict giữa scope $or và search $or
    const andClauses = [];

    const role = (currentUser?.roleId || '').toUpperCase();
    const isAdminOrOwner = ['OWNER', 'ADMIN'].includes(role);
    const isManager = role === 'MANAGER';

    // Scope: MANAGER / STAFF thấy event của mình + event chưa assign (+ nhân viên dưới cấp nếu là Manager)
    if (!isAdminOrOwner) {
      const allowedUserIds = [currentUser?.id];
      if (isManager && currentUser?.id) {
        const subordinates = await User.find({ managerId: currentUser.id }).select("id");
        allowedUserIds.push(...subordinates.map(u => u.id));
      }

      andClauses.push({
        $or: [
          { assigneeId: { $in: allowedUserIds } },
          { assigneeId: null },
        ],
      });
    }

    // Search text
    if (searchRegex) {
      andClauses.push({
        $or: [
          { name: searchRegex },
          { id: searchRegex },
          { "customer.name": searchRegex },
          { "biz.id": searchRegex },
          { stage: searchRegex },
        ],
      });
    }

    const query = andClauses.length > 0 ? { $and: andClauses } : {};

    if (group)    query.group = group;
    if (stage)    query.stage = stage;
    if (assignee) query["assignee.name"] = assignee;

    const [events, totalItems] = await Promise.all([
      Event.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Event.countDocuments(query),
    ]);

    return { events, totalItems, page, limit };
  }

  async getEventStats(currentUser) {
    const groups = [
      "user_moi",
      "biz_moi",
      "can_nang_cap",
      "sap_het_han",
      "chuyen_khoan",
    ];

    const role = (currentUser?.roleId || '').toUpperCase();
    const isAdminOrOwner = ['OWNER', 'ADMIN'].includes(role);
    const isManager = role === 'MANAGER';

    let matchStage = {};

    if (!isAdminOrOwner) {
      const allowedUserIds = [currentUser?.id];
      if (isManager && currentUser?.id) {
        const subordinates = await User.find({ managerId: currentUser.id }).select("id");
        allowedUserIds.push(...subordinates.map(u => u.id));
      }
      matchStage = {
        $or: [
          { assigneeId: { $in: allowedUserIds } },
          { assigneeId: null }
        ]
      };
    }

    const counts = await Event.aggregate([
      { $match: matchStage },
      { $group: { _id: "$group", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    for (const item of counts) {
      countMap[item._id] = item.count;
    }

    const stats = {};
    let total = 0;
    for (const g of groups) {
      stats[g] = countMap[g] || 0;
      total += stats[g];
    }
    stats.all = total;

    return stats;
  }

  async getEventById(id) {
    const event = await Event.findOne({ id });
    if (!event) {
      throw createHttpError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
    }
    return event;
  }

  async createEvent(payload, currentUser) {
    let customerId = null;
    let assigneeId = null;

    // Build the mapped customer subdocument
    const payloadCust = payload.customer || {};
    const mappedCustomer = {
      name: payloadCust.name || "Unknown",
      avatar: payloadCust.avatar || `https://i.pravatar.cc/150?u=${encodeURIComponent(payloadCust.email || payloadCust.name || "unknown")}`,
      role: payloadCust.role || "",
      email: payloadCust.email || "",
      phone: payloadCust.phone || "",
      source: payloadCust.source || "",
      address: payloadCust.address || "",
    };

    // 1. Try to map Customer by email or phone
    const custSearch = {};
    if (mappedCustomer.email) custSearch.email = mappedCustomer.email;
    else if (mappedCustomer.phone) custSearch.phone = mappedCustomer.phone;
    
    if (Object.keys(custSearch).length > 0) {
      const existingCustomer = await Customer.findOne({ $or: [ { email: mappedCustomer.email }, { phone: mappedCustomer.phone } ].filter(c => Object.values(c)[0]) });
      if (existingCustomer) {
        customerId = existingCustomer.id;
        mappedCustomer.name = existingCustomer.name || mappedCustomer.name;
        mappedCustomer.avatar = existingCustomer.avatar || mappedCustomer.avatar;
      }
    }

    // Build the mapped assignee subdocument
    const payloadAssignee = payload.assignee || {};
    const mappedAssignee = {
      name: payloadAssignee.name || "",
      avatar: payloadAssignee.avatar || "",
      role: payloadAssignee.role || "",
      department: "",
      group: "",
    };

    // 2. Try to map Staff by assigneeId first, then email/name
    const staffLookupId = payload.assigneeId || null;
    if (staffLookupId || payloadAssignee.email || payloadAssignee.name) {
      const staffQuery = [];
      if (staffLookupId) staffQuery.push({ id: staffLookupId });
      if (payloadAssignee.email) staffQuery.push({ email: payloadAssignee.email });
      if (payloadAssignee.name) staffQuery.push({ name: payloadAssignee.name });

      const existingStaff = await User.findOne({ $or: staffQuery });
      if (existingStaff) {
        assigneeId = existingStaff.id;
        mappedAssignee.name = existingStaff.name;
        mappedAssignee.avatar = existingStaff.avatar || mappedAssignee.avatar;
        mappedAssignee.role = existingStaff.role || mappedAssignee.role;
        mappedAssignee.department = existingStaff.department || [];
        mappedAssignee.group = existingStaff.group || [];
      }
    }

    const event = await Event.create({
      id: await generateMonotonicId("EVT"),
      name: payload.name || "Sự kiện mới",
      sub: payload.sub || "",
      group: payload.group,
      customerId,
      customer: mappedCustomer,
      assigneeId,
      assignee: mappedAssignee,
      biz: payload.biz || { id: "", tags: [] },
      stage: payload.stage || "",
      source: payload.source || "CRM",
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
          title: "Sự kiện được tạo",
          time: new Date().toLocaleString("vi-VN"),
          content: null,
          duration: null,
          createdBy: currentUser?.name || "System",
        },
      ],
    });
    return event;
  }

  async updateEvent(id, payload) {
    const event = await Event.findOne({ id });
    if (!event) {
      throw createHttpError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
    }

    const body = payload;

    if (body.name !== undefined) event.name = body.name;
    if (body.sub !== undefined) event.sub = body.sub;
    if (body.group !== undefined) event.group = body.group;
    if (body.stage !== undefined) event.stage = body.stage;
    if (body.source !== undefined) event.source = body.source;
    if (body.tags !== undefined) event.tags = body.tags;

    if (body.customer) {
      event.customer = {
        name: body.customer.name ?? event.customer.name,
        avatar: body.customer.avatar ?? event.customer.avatar,
        role: body.customer.role ?? event.customer.role,
        email: body.customer.email ?? event.customer.email,
        phone: body.customer.phone ?? event.customer.phone,
        source: body.customer.source ?? event.customer.source,
        address: body.customer.address ?? event.customer.address,
      };

      const custSearch = {};
      if (event.customer.email) custSearch.email = event.customer.email;
      else if (event.customer.phone) custSearch.phone = event.customer.phone;
      
      if (Object.keys(custSearch).length > 0) {
        const existingCustomer = await Customer.findOne({ $or: [ { email: event.customer.email }, { phone: event.customer.phone } ].filter(c => Object.values(c)[0]) });
        if (existingCustomer) {
          event.customerId = existingCustomer.id;
          event.customer.name = existingCustomer.name || event.customer.name;
          event.customer.avatar = existingCustomer.avatar || event.customer.avatar;
        } else {
          event.customerId = null;
        }
      }
    }

    if (body.biz) {
      event.biz = {
        id: body.biz.id ?? event.biz.id,
        tags: body.biz.tags ?? event.biz.tags,
      };
    }

    if (body.assignee !== undefined || body.assigneeId !== undefined) {
      const incomingAssignee = body.assignee || {};
      event.assignee = {
        name: incomingAssignee.name ?? event.assignee.name,
        avatar: incomingAssignee.avatar ?? event.assignee.avatar,
        role: incomingAssignee.role ?? event.assignee.role,
        department: event.assignee.department || "",
        group: event.assignee.group || "",
      };

      // Lookup by assigneeId first, then email/name
      const lookupId = body.assigneeId || null;
      if (lookupId || incomingAssignee.email || event.assignee.name) {
        const staffQuery = [];
        if (lookupId) staffQuery.push({ id: lookupId });
        if (incomingAssignee.email) staffQuery.push({ email: incomingAssignee.email });
        if (event.assignee.name) staffQuery.push({ name: event.assignee.name });

        const existingStaff = await User.findOne({ $or: staffQuery });
        if (existingStaff) {
          event.assigneeId = existingStaff.id;
          event.assignee.name = existingStaff.name;
          event.assignee.avatar = existingStaff.avatar || event.assignee.avatar;
          event.assignee.role = existingStaff.role || event.assignee.role;
          event.assignee.department = existingStaff.department || [];
          event.assignee.group = existingStaff.group || [];
        } else {
          event.assigneeId = null;
          event.assignee.department = [];
          event.assignee.group = [];
        }
      }
    }

    if (body.plan) {
      event.plan = {
        name: body.plan.name ?? event.plan.name,
        cycle: body.plan.cycle ?? event.plan.cycle,
        price: body.plan.price ?? event.plan.price,
        daysLeft: body.plan.daysLeft ?? event.plan.daysLeft,
        expiryDate: body.plan.expiryDate ?? event.plan.expiryDate,
      };
    }

    if (body.services !== undefined) event.services = body.services;
    if (body.quotas !== undefined) event.quotas = body.quotas;

    await event.save();
    return event;
  }

  async addEventTimeline(id, entryData, currentUser) {
    const event = await Event.findOne({ id });
    if (!event) {
      throw createHttpError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
    }

    const entry = {
      type: entryData.type || "note",
      title: entryData.title,
      time: entryData.time || new Date().toLocaleString("vi-VN"),
      content: entryData.content || null,
      duration: entryData.duration || null,
      createdBy: currentUser?.name || "",
    };

    event.timeline.unshift(entry);
    await event.save();
    return event;
  }

  async deleteEvent(id) {
    const event = await Event.findOne({ id });
    if (!event) {
      throw createHttpError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
    }

    // ━ Cascade: soft-delete all EventActionChains belonging to this event
    const chains = await EventActionChain.find({ eventId: id });
    for (const chain of chains) {
      await chain.softDelete();
    }

    await event.softDelete();
  }

  async syncCustomer(id) {
    const event = await Event.findOne({ id });
    if (!event) {
      throw createHttpError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
    }

    const { email, phone } = event.customer;
    if (!email && !phone) {
      throw createHttpError(400, "Sự kiện này không có email hoặc số điện thoại để đồng bộ");
    }

    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });

    const existingCustomer = await Customer.findOne({ $or: orConditions });

    if (!existingCustomer) {
      throw createHttpError(404, "Không tìm thấy khách hàng nào trong hệ thống khớp với thông tin này");
    }

    event.customerId = existingCustomer.id;
    event.customer.name = existingCustomer.name || event.customer.name;
    event.customer.avatar = existingCustomer.avatar || event.customer.avatar;
    event.customer.role = existingCustomer.role || event.customer.role;
    event.customer.email = existingCustomer.email || event.customer.email;
    event.customer.phone = existingCustomer.phone || event.customer.phone;
    event.customer.source = event.customer.source || existingCustomer.source || "CRM";
    event.customer.address = existingCustomer.address || event.customer.address;
    
    await event.save();
    return event;
  }
}

module.exports = new EventService();

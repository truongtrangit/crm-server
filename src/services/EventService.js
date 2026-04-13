const Event = require("../models/Event");
const Customer = require("../models/Customer");
const User = require("../models/User");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { resolvePagination } = require("../utils/pagination");
const { createHttpError } = require("../utils/http");

class EventService {
  async getEvents(queryParams) {
    const { search = "", group, stage, assignee } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams || {});
    const query = {};

    if (searchRegex) {
      query.$or = [
        { name: searchRegex },
        { id: searchRegex },
        { "customer.name": searchRegex },
        { "biz.id": searchRegex },
        { stage: searchRegex },
      ];
    }

    if (group) {
      query.group = group;
    }

    if (stage) {
      query.stage = stage;
    }

    if (assignee) {
      query["assignee.name"] = assignee;
    }

    const [events, totalItems] = await Promise.all([
      Event.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Event.countDocuments(query),
    ]);

    return { events, totalItems, page, limit };
  }

  async getEventStats() {
    const groups = [
      "user_moi",
      "biz_moi",
      "can_nang_cap",
      "sap_het_han",
      "chuyen_khoan",
    ];

    const counts = await Event.aggregate([
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
    };

    // 2. Try to map Staff by email or name
    if (payloadAssignee.email || payloadAssignee.name) {
      const staffQuery = [];
      if (payloadAssignee.email) staffQuery.push({ email: payloadAssignee.email });
      if (payloadAssignee.name) staffQuery.push({ name: payloadAssignee.name });
      
      const existingStaff = await User.findOne({ $or: staffQuery });
      if (existingStaff) {
        assigneeId = existingStaff.id;
        mappedAssignee.name = existingStaff.name;
        mappedAssignee.avatar = existingStaff.avatar || mappedAssignee.avatar;
        mappedAssignee.role = existingStaff.role || mappedAssignee.role;
      }
    }

    const event = await Event.create({
      id: await generateSequentialId(Event, "EVT", 3),
      name: payload.name || "Sự kiện mới",
      sub: payload.sub || "",
      group: payload.group,
      customerId,
      customer: mappedCustomer,
      assigneeId,
      assignee: mappedAssignee,
      biz: payload.biz || { id: "", tags: [] },
      stage: payload.stage || "",
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

    if (body.assignee) {
      event.assignee = {
        name: body.assignee.name ?? event.assignee.name,
        avatar: body.assignee.avatar ?? event.assignee.avatar,
        role: body.assignee.role ?? event.assignee.role,
      };

      if (event.assignee.name || body.assignee.email) {
        const staffQuery = [];
        if (body.assignee.email) staffQuery.push({ email: body.assignee.email });
        if (event.assignee.name) staffQuery.push({ name: event.assignee.name });
        
        const existingStaff = await User.findOne({ $or: staffQuery });
        if (existingStaff) {
          event.assigneeId = existingStaff.id;
          event.assignee.name = existingStaff.name;
          event.assignee.avatar = existingStaff.avatar || event.assignee.avatar;
          event.assignee.role = existingStaff.role || event.assignee.role;
        } else {
          event.assigneeId = null;
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
    const deleted = await Event.findOneAndDelete({ id });
    if (!deleted) {
      throw createHttpError(404, "Event not found", { code: "EVENT_NOT_FOUND" });
    }
  }
}

module.exports = new EventService();

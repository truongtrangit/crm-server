const Event = require('./event.model');
const EventGroupService = require('../eventGroup/eventGroup.service');
const Customer = require('../../customer/customer/customer.model');
const User = require('../../system/user/user.model');
const StaffFunction = require('../../hr/function/staffFunction.model');
const Lead = require('../../lead/lead/lead.model');
const Task = require('../../job/task/task.model');
const EventActionChain = require('../eventActionChain/eventActionChain.model');
const TaskService = require('../../job/task/task.service');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { buildSearchRegex } = require('../../../core/utils/query');
const {
  resolvePagination,
  buildPaginatedResponse,
  resolveSort,
} = require('../../../core/utils/pagination');
const { createHttpError } = require('../../../core/utils/http');
const { computeChanges } = require('../../../core/utils/diff');
const { getDefaultAvatar } = require('../../../core/utils/avatar');

class EventService {
  async getEvents(queryParams, scopeFilter = {}) {
    const { search = '', group, stage, assignee, isArchived } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams || {});

    // Dùng $and để tránh conflict giữa scope $or và search $or
    const andClauses = [];

    // Scope: MANAGER / STAFF thấy event của mình + event chưa assign + event mình tạo (+ nhân viên dưới cấp nếu là Manager)
    if (scopeFilter.$or) {
      andClauses.push(scopeFilter);
    }

    // Search text
    if (searchRegex) {
      andClauses.push({
        $or: [
          { name: searchRegex },
          { id: searchRegex },
          { 'customer.name': searchRegex },
          { 'biz.id': searchRegex },
          { stage: searchRegex },
          { 'assignees.userName': searchRegex },
        ],
      });
    }

    const query = andClauses.length > 0 ? { $and: andClauses } : {};

    if (isArchived === 'true') {
      query.isArchived = true;
    } else if (isArchived === 'false' || !isArchived) {
      query.isArchived = { $ne: true };
    }

    if (group) query.group = group;
    if (stage) query.stage = stage;
    if (assignee) query['assignees.userId'] = assignee;

    const sortObj = resolveSort(queryParams, [
      'createdAt',
      'name',
      'updatedAt',
      'customer.name',
      'stage',
    ]);

    const [events, totalItems] = await Promise.all([
      Event.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
      Event.countDocuments(query),
    ]);

    return buildPaginatedResponse(events, totalItems, page, limit);
  }

  async getEventStats(scopeFilter = {}) {
    const allGroups = await EventGroupService.listGroups();
    const groups = allGroups.map((g) => g.id);

    const counts = await Event.aggregate([
      { $match: { ...scopeFilter, isArchived: { $ne: true } } },
      { $group: { _id: '$group', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    for (const c of counts) {
      if (c._id) countMap[c._id] = c.count;
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
      throw createHttpError(404, 'Event not found', {
        code: 'EVENT_NOT_FOUND',
      });
    }
    return event;
  }

  async createEvent(payload, currentUser) {
    let customerId = null;

    // Build the mapped customer subdocument
    const payloadCust = payload.customer || {};
    const mappedCustomer = {
      name: payloadCust.name || 'Unknown',
      avatar:
        payloadCust.avatar ||
        getDefaultAvatar(payloadCust.name || payloadCust.email || 'unknown'),
      role: payloadCust.role || '',
      email: payloadCust.email || '',
      phone: payloadCust.phone || '',
      source: payloadCust.source || '',
      address: payloadCust.address || '',
    };

    // 1. Try to map Customer by email or phone
    const custSearch = {};
    if (mappedCustomer.email) custSearch.email = mappedCustomer.email;
    else if (mappedCustomer.phone) custSearch.phone = mappedCustomer.phone;

    if (Object.keys(custSearch).length > 0) {
      const existingCustomer = await Customer.findOne({
        $or: [
          { email: mappedCustomer.email },
          { phone: mappedCustomer.phone },
        ].filter((c) => Object.values(c)[0]),
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
        mappedCustomer.name = existingCustomer.name || mappedCustomer.name;
        mappedCustomer.avatar =
          existingCustomer.avatar || mappedCustomer.avatar;
      }
    }

    // 2. Resolve assignees — enrich from DB (same pattern as LeadService)
    const assignees = await this._resolveAssignees(payload.assignees || []);

    const event = await Event.create({
      id: await generateMonotonicId(ID_PREFIXES.EVENT),
      name: payload.name || 'Sự kiện mới',
      sub: payload.sub || '',
      group: payload.group,
      customerId,
      customer: mappedCustomer,
      assignees,
      biz: payload.biz || { id: '', tags: [] },
      stage: payload.stage || '',
      source: payload.source || 'CRM',
      createdBy: currentUser?.id || null,
      tags: payload.tags || [],
      plan: payload.plan || {
        name: 'TRIAL',
        cycle: 'Thanh toán theo tháng',
        price: '0 đ',
        daysLeft: 30,
        expiryDate: '',
      },
      services: payload.services || [],
      quotas: payload.quotas || [],
      timeline: [
        {
          type: 'event',
          title: 'Sự kiện được tạo',
          time: new Date().toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
          }),
          content: null,
          duration: null,
          createdBy: currentUser?.name || 'System',
        },
      ],
    });
    return event;
  }

  async updateEvent(id, payload) {
    const event = await Event.findOne({ id });
    if (!event) {
      throw createHttpError(404, 'Event not found', {
        code: 'EVENT_NOT_FOUND',
      });
    }

    // Capture old state for diffing
    const oldState = event.toObject();

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
        const existingCustomer = await Customer.findOne({
          $or: [
            { email: event.customer.email },
            { phone: event.customer.phone },
          ].filter((c) => Object.values(c)[0]),
        });
        if (existingCustomer) {
          event.customerId = existingCustomer.id;
          event.customer.name = existingCustomer.name || event.customer.name;
          event.customer.avatar =
            existingCustomer.avatar || event.customer.avatar;
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

    // Resolve assignees nếu có gửi lên
    if (body.assignees !== undefined) {
      event.assignees = await this._resolveAssignees(body.assignees || []);
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

    // Compute diff
    const newState = event.toObject();
    const keysToCheck = [
      'name',
      'sub',
      'group',
      'stage',
      'source',
      'tags',
      'customer',
      'biz',
      'assignees',
      'plan',
      'services',
      'quotas',
    ];
    const changes = computeChanges(oldState, newState, keysToCheck);

    return { event, changes };
  }

  async addEventTimeline(id, entryData, currentUser) {
    const event = await Event.findOne({ id });
    if (!event) {
      throw createHttpError(404, 'Event not found', {
        code: 'EVENT_NOT_FOUND',
      });
    }

    const entry = {
      type: entryData.type || 'note',
      title: entryData.title,
      time:
        entryData.time ||
        new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      content: entryData.content || null,
      duration: entryData.duration || null,
      createdBy: currentUser?.name || '',
    };

    event.timeline.unshift(entry);
    await event.save();
    return event;
  }

  async deleteEventTimeline(eventId, timelineId) {
    const event = await Event.findOne({ id: eventId });
    if (!event) {
      throw createHttpError(404, 'Event not found', {
        code: 'EVENT_NOT_FOUND',
      });
    }

    const initialLength = event.timeline.length;
    const timelineEntry = event.timeline.find(
      (entry) => entry._id.toString() === timelineId,
    );

    event.timeline = event.timeline.filter(
      (entry) => entry._id.toString() !== timelineId,
    );

    if (event.timeline.length === initialLength) {
      throw createHttpError(404, 'Timeline entry not found');
    }

    await event.save();
    return { event, timelineEntry };
  }

  async deleteEvent(id, currentUser) {
    const event = await Event.findOne({ id });
    if (!event) {
      throw createHttpError(404, 'Event not found', {
        code: 'EVENT_NOT_FOUND',
      });
    }

    // ━ Cascade: soft-delete all EventActionChains belonging to this event
    const chains = await EventActionChain.find({ eventId: id });
    for (const chain of chains) {
      await chain.softDelete();
    }

    // ━ Cascade: close all active Tasks linked to this Event
    try {
      const activeTasks = await Task.find({
        'linkedEvents.eventId': id,
        status: { $ne: 'closed' },
      });
      for (const task of activeTasks) {
        const performer = currentUser || {
          id: 'system',
          name: 'System',
          email: '',
        };
        await TaskService.closeTask(task.id, performer).catch((err) => {
          console.error(
            `Failed to close task ${task.id} cascading from event ${id}`,
            err,
          );
        });
      }
    } catch (err) {
      console.error('Error during cascading task close for event', err);
    }

    await event.softDelete();
  }

  async archiveEvent(id, currentUser) {
    const event = await Event.findOne({ id });
    if (!event)
      throw createHttpError(404, 'Event not found', {
        code: 'EVENT_NOT_FOUND',
      });
    event.isArchived = true;
    event.timeline.unshift({
      type: 'note',
      title: 'Lưu trữ sự kiện',
      time: new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
      content: null,
      createdBy: currentUser?.name || 'System',
    });
    await event.save();
    return event;
  }

  async unarchiveEvent(id, currentUser) {
    const event = await Event.findOne({ id });
    if (!event)
      throw createHttpError(404, 'Event not found', {
        code: 'EVENT_NOT_FOUND',
      });
    event.isArchived = false;
    event.timeline.unshift({
      type: 'note',
      title: 'Khôi phục sự kiện từ lưu trữ',
      time: new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
      content: null,
      createdBy: currentUser?.name || 'System',
    });
    await event.save();
    return event;
  }

  async syncCustomer(id) {
    const event = await Event.findOne({ id });
    if (!event) {
      throw createHttpError(404, 'Event not found', {
        code: 'EVENT_NOT_FOUND',
      });
    }

    const { email, phone } = event.customer;
    if (!email && !phone) {
      throw createHttpError(
        400,
        'Sự kiện này không có email hoặc số điện thoại để đồng bộ',
      );
    }

    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });

    const existingCustomer = await Customer.findOne({ $or: orConditions });

    if (!existingCustomer) {
      throw createHttpError(
        404,
        'Không tìm thấy khách hàng nào trong hệ thống khớp với thông tin này',
      );
    }

    event.customerId = existingCustomer.id;
    event.customer.name = existingCustomer.name || event.customer.name;
    event.customer.avatar = existingCustomer.avatar || event.customer.avatar;
    event.customer.role = existingCustomer.role || event.customer.role;
    event.customer.email = existingCustomer.email || event.customer.email;
    event.customer.phone = existingCustomer.phone || event.customer.phone;
    event.customer.source =
      event.customer.source || existingCustomer.source || 'CRM';
    event.customer.address = existingCustomer.address || event.customer.address;

    await event.save();
    return event;
  }

  /**
   * Bỏ phân công 1 user khỏi event.
   * - STAFF: chỉ bỏ chính mình
   * - MANAGER: bỏ mình hoặc nhân viên trực thuộc
   * - ADMIN/OWNER: bỏ bất kỳ ai
   * Nếu không truyền userId trong body, mặc định bỏ currentUser.
   */
  async unassignEvent(id, currentUser, targetUserId) {
    const removeUserId = targetUserId || currentUser?.id;

    const event = await Event.findOne({ id });
    if (!event) throw createHttpError(404, 'Event not found');

    const existingAssignee = event.assignees.find(
      (a) => a.userId === removeUserId,
    );
    if (!existingAssignee) {
      throw createHttpError(400, 'Người này chưa được phân công trong sự kiện');
    }

    event.assignees = event.assignees.filter((a) => a.userId !== removeUserId);
    await event.save();
    return event;
  }

  /**
   * Tự gán bản thân vào event.
   * Cho phép nhiều người cùng assign vào 1 event (multi-assignee).
   */
  async selfAssignEvent(id, functionId, currentUser) {
    const event = await Event.findOne({ id });
    if (!event) throw createHttpError(404, 'Event not found');

    // Kiểm tra vai trò của người dùng nếu là STAFF hoặc MANAGER
    const userRole = (currentUser.roleId || '').toUpperCase();
    if (['STAFF', 'MANAGER'].includes(userRole)) {
      const userFuncs = currentUser.functions || [];
      if (!functionId || !userFuncs.includes(functionId)) {
        throw createHttpError(
          403,
          'Tài khoản của bạn chưa được cấu hình vai trò này. Vui lòng liên hệ Admin.',
        );
      }
    }

    // Kiểm tra đã assign chưa
    const alreadyAssigned = event.assignees.some(
      (a) => a.userId === currentUser.id && a.functionId === functionId,
    );
    if (alreadyAssigned) {
      throw createHttpError(
        409,
        'Bạn đã được phân công trong sự kiện này với vai trò này',
      );
    }

    // Resolve thông tin user
    const resolved = await this._resolveAssignees([
      { userId: currentUser.id, functionId },
    ]);
    if (resolved.length > 0) {
      event.assignees.push(resolved[0]);
    } else {
      // Fallback nếu không tìm thấy trong DB (edge case)
      event.assignees.push({
        userId: currentUser.id,
        userName: currentUser.name || '',
        userAvatar: currentUser.avatar || '',
        functionId: functionId || null,
        functionTitle: '',
      });
    }

    await event.save();
    return event;
  }

  // ─── Private Helpers ───

  /**
   * Resolve raw assignees [{ userId, functionId }] → enrich from DB.
   * Đồng bộ logic với LeadService._resolveAssignees().
   */
  async _resolveAssignees(rawAssignees) {
    if (!rawAssignees || rawAssignees.length === 0) return [];

    const userIds = rawAssignees.map((a) => a.userId).filter(Boolean);
    const funcIds = rawAssignees.map((a) => a.functionId).filter(Boolean);

    const [users, funcs] = await Promise.all([
      userIds.length > 0
        ? User.find({ id: { $in: userIds }, isActive: { $ne: false } })
            .select('id name avatar')
            .lean()
        : [],
      funcIds.length > 0
        ? StaffFunction.find({ id: { $in: funcIds } })
            .select('id title')
            .lean()
        : [],
    ]);

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const funcMap = Object.fromEntries(funcs.map((f) => [f.id, f]));

    return rawAssignees
      .filter((a) => a.userId && userMap[a.userId]) // chỉ lấy user hợp lệ + active
      .map((a) => ({
        userId: a.userId,
        userName: userMap[a.userId]?.name || '',
        userAvatar: userMap[a.userId]?.avatar || '',
        functionId: a.functionId || null,
        functionTitle: a.functionId ? funcMap[a.functionId]?.title || '' : '',
      }));
  }
}

module.exports = new EventService();

const createHttpError = require('http-errors');
const OrderWebhookRule = require('./orderWebhookRule.model');
const OrderWebhookDeliveryLog = require('./orderWebhookDeliveryLog.model');
const User = require('../../system/user/user.model');
const { generateMonotonicId } = require('../../../core/utils/id');
const { ID_PREFIXES } = require('../../../core/utils/id');
const { buildPaginatedResponse } = require('../../../core/utils/pagination');
const { escapeRegex } = require('../../../core/utils/query');
const {
  ORDER_WEBHOOK_EVENTS,
  ORDER_WEBHOOK_SCOPE_TYPES,
  COURSE_TYPES,
} = require('../../../core/constants/appData');

class OrderWebhookService {
  // ─── Rules CRUD ─────────────────────────────────────────────────────────────

  async getRules(query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { url: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (query.scopeType) {
      filter['scope.type'] = query.scopeType;
    }
    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;

    const [items, total] = await Promise.all([
      OrderWebhookRule.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OrderWebhookRule.countDocuments(filter),
    ]);

    // Resolve createdBy IDs to user names
    const creatorIds = [
      ...new Set(items.map((r) => r.createdBy).filter(Boolean)),
    ];
    let userMap = {};
    if (creatorIds.length > 0) {
      const users = await User.find(
        { id: { $in: creatorIds } },
        'id name',
      ).lean();
      userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
    }

    for (const item of items) {
      if (item.createdBy) {
        item.createdByName = userMap[item.createdBy] || item.createdBy;
      }
    }

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getRuleById(id) {
    const rule = await OrderWebhookRule.findOne({ id }).lean();
    if (!rule) throw createHttpError(404, 'Không tìm thấy cấu hình webhook');
    return rule;
  }

  async createRule(data, userId) {
    const id = await generateMonotonicId(ID_PREFIXES.ORDER_WEBHOOK_RULE);
    const rule = await OrderWebhookRule.create({
      ...data,
      id,
      createdBy: userId,
    });
    return rule.toObject();
  }

  async updateRule(id, data) {
    const rule = await OrderWebhookRule.findOneAndUpdate(
      { id },
      { $set: data },
      { new: true, runValidators: true },
    ).lean();
    if (!rule) throw createHttpError(404, 'Không tìm thấy cấu hình webhook');
    return rule;
  }

  async toggleRule(id) {
    const rule = await OrderWebhookRule.findOne({ id });
    if (!rule) throw createHttpError(404, 'Không tìm thấy cấu hình webhook');

    rule.isActive = !rule.isActive;
    await rule.save();
    return rule.toObject();
  }

  async deleteRule(id) {
    const rule = await OrderWebhookRule.findOneAndDelete({ id }).lean();
    if (!rule) throw createHttpError(404, 'Không tìm thấy cấu hình webhook');
    return rule;
  }

  // ─── Delivery Logs ──────────────────────────────────────────────────────────

  async getDeliveryLogs(query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.ruleId) filter.ruleId = query.ruleId;
    if (query.orderId) filter.orderId = query.orderId;
    if (query.status) filter.status = query.status;

    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { ruleName: { $regex: escaped, $options: 'i' } },
        { targetUrl: { $regex: escaped, $options: 'i' } },
        { orderId: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      OrderWebhookDeliveryLog.find(filter)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OrderWebhookDeliveryLog.countDocuments(filter),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  // ─── Sample Payload ─────────────────────────────────────────────────────────

  getSamplePayload() {
    return {
      event: ORDER_WEBHOOK_EVENTS.COMPLETED,
      order_id: 'TXG-2026-0001',
      status: 'complete',
      customer: {
        name: 'Nguyen Van A',
        email: 'a.nguyen@example.com',
        phone: '0987654321',
      },
      course: {
        id: 'CRS-01',
        name: 'Bootcamp AI Automation Thực Chiến',
        type: 'offline',
        price: 3500000,
      },
      payment_method: 'mainCredit',
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new OrderWebhookService();

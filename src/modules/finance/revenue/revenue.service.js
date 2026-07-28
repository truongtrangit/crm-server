const Revenue = require('./revenue.model');
const RevenueCategory = require('./revenueCategory.model');
const Company = require('../../hr/company/company.model');
const ExpectedRevenue = require('./expectedRevenue.model');
const Counter = require('../../../core/models/Counter');
const {
  resolvePagination,
  buildPaginatedResponse,
} = require('../../../core/utils/pagination');
const { createHttpError } = require('../../../core/utils/http');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { REVENUE_STATUSES } = require('../../../core/constants/finance');
const { computeChanges } = require('../../../core/utils/diff');
const { escapeRegex } = require('../../../core/utils/query');

const FinanceCategoryBaseService = require('../finance_category_base.service');
const FinanceStatsService = require('../finance_stats.service');

class RevenueService {
  constructor() {
    this.categoryService = new FinanceCategoryBaseService(
      RevenueCategory,
      Revenue,
      ID_PREFIXES.REVENUE_CATEGORY,
      'doanh thu',
    );
    this.statsService = new FinanceStatsService(
      Revenue,
      RevenueCategory,
      ['customerName', 'orderId', 'details'],
      REVENUE_STATUSES.CANCELLED,
      'Khác'
    );
  }

  // ─── Revenue Categories ──────────────────────────────────────────────────

  async getCategories(query = {}) {
    return this.categoryService.getCategories(query);
  }

  async createCategory(data) {
    return this.categoryService.createCategory(data);
  }

  async updateCategory(id, data) {
    return this.categoryService.updateCategory(id, data);
  }

  async deleteCategory(id, force = false) {
    return this.categoryService.deleteCategory(id, force);
  }

  // ─── Expected Revenues ────────────────────────────────────────────────────

  async getExpectedRevenues(query = {}) {
    const filter = {};
    if (query.search) {
      filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
    }
    const expected = await ExpectedRevenue.find(filter)
      .populate('category', 'id name')
      .sort({ createdAt: -1 })
      .lean();
    return expected;
  }

  async _removeExpectedRevenues(expectedRevenueId, force = false) {
    if (!force) {
      const completed = await Revenue.findOne({
        expectedRevenueId,
        status: REVENUE_STATUSES.COMPLETE,
      }).lean();
      if (completed) {
        throw createHttpError(
          400,
          'Đã có doanh thu được ghi nhận cho khoản này. Vui lòng xác nhận ghi đè.',
          { code: 'RESOURCE_APPROVED_FORCE_REQUIRED' },
        );
      }
    }
    await Revenue.deleteMany({ expectedRevenueId });
  }

  async _generateExpectedRevenues(expected) {
    switch (expected.type) {
      case 'single': {
        if (!expected.expectedDate) return;
        const orderId = await this._generateOrderId(expected.category);
        const revenue = new Revenue({
          orderId,
          customerName: expected.name,
          category: expected.category,
          details: expected.name,
          amount: expected.amount,
          companyProportions: expected.companyProportions,
          recordDate: expected.expectedDate,
          status: REVENUE_STATUSES.PENDING,
          isExpected: true,
          expectedRevenueId: expected._id,
        });
        await revenue.save();
        break;
      }
      case 'yearly': {
        const currentYear = new Date().getFullYear();
        const months = expected.allocatedMonths || [];
        if (months.length === 0) return;

        const baseAmount = Math.floor(expected.amount / months.length);
        const remainder = expected.amount - baseAmount * months.length;

        const sortedMonths = [...months].sort((a, b) => a - b);

        for (let i = 0; i < sortedMonths.length; i++) {
          const m = sortedMonths[i];
          let monthAmount = baseAmount;
          if (i === sortedMonths.length - 1) {
            monthAmount += remainder;
          }

          const recordDate = new Date(currentYear, m - 1, 1);
          const orderId = await this._generateOrderId(expected.category);

          const revenue = new Revenue({
            orderId,
            customerName: expected.name,
            category: expected.category,
            details: expected.name,
            amount: monthAmount,
            companyProportions: expected.companyProportions,
            recordDate,
            status: REVENUE_STATUSES.PENDING,
            isExpected: true,
            expectedRevenueId: expected._id,
          });
          await revenue.save();
        }
        break;
      }
    }
  }

  async createExpectedRevenue(data) {
    if (!data.companyProportions || data.companyProportions.length === 0) {
      throw createHttpError(400, 'Vui lòng phân bổ công ty');
    }
    const sum = data.companyProportions.reduce(
      (acc, curr) => acc + curr.percentage,
      0,
    );
    if (sum !== 100)
      throw createHttpError(
        400,
        'Tổng tỷ lệ phần trăm các công ty phải bằng 100',
      );

    const companyIds = data.companyProportions.map((c) => c.company);
    const companies = await Company.find({ id: { $in: companyIds } }).lean();
    if (companies.length !== companyIds.length) {
      throw createHttpError(400, 'Một hoặc nhiều công ty không tồn tại');
    }

    if (data.categoryId) {
      const category = await RevenueCategory.findOne({ id: data.categoryId }).lean();
      if (!category) throw createHttpError(400, 'Danh mục không hợp lệ');
      data.category = category._id;
    }

    const expected = new ExpectedRevenue(data);
    await expected.save();
    await this._generateExpectedRevenues(expected);
    return expected.populate('category', 'id name');
  }

  async updateExpectedRevenue(id, data) {
    const expected = await ExpectedRevenue.findById(id);
    if (!expected)
      throw createHttpError(404, 'Không tìm thấy dự kiến doanh thu');

    const updateData = { ...data };

    if (data.companyProportions) {
      if (data.companyProportions.length === 0) {
        throw createHttpError(400, 'Vui lòng phân bổ công ty');
      }
      const sum = data.companyProportions.reduce(
        (acc, curr) => acc + curr.percentage,
        0,
      );
      if (sum !== 100)
        throw createHttpError(
          400,
          'Tổng tỷ lệ phần trăm các công ty phải bằng 100',
        );

      const companyIds = data.companyProportions.map((c) => c.company);
      const companies = await Company.find({ id: { $in: companyIds } }).lean();
      if (companies.length !== companyIds.length) {
        throw createHttpError(400, 'Một hoặc nhiều công ty không tồn tại');
      }
    }

    if (data.categoryId !== undefined) {
      if (data.categoryId) {
        const category = await RevenueCategory.findOne({ id: data.categoryId }).lean();
        if (!category) throw createHttpError(400, 'Danh mục không hợp lệ');
        updateData.category = category._id;
      } else {
        updateData.category = null;
      }
    }

    await this._removeExpectedRevenues(id, data.forceUpdate);

    Object.assign(expected, updateData);
    await expected.save();

    await this._generateExpectedRevenues(expected);

    return expected.populate('category', 'id name');
  }

  async deleteExpectedRevenue(id, force = false) {
    const expected = await ExpectedRevenue.findById(id);
    if (!expected)
      throw createHttpError(404, 'Không tìm thấy dự kiến doanh thu');

    await this._removeExpectedRevenues(id, force);
    await expected.deleteOne();
    return expected;
  }

  // ─── Revenues ─────────────────────────────────────────────────────────────

  async getRevenues(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.search) {
      filter.$or = [
        { customerName: { $regex: escapeRegex(query.search), $options: 'i' } },
        { orderId: { $regex: escapeRegex(query.search), $options: 'i' } },
        { details: { $regex: escapeRegex(query.search), $options: 'i' } },
      ];
    }
    if (query.category && query.category !== 'all') {
      if (query.category === 'empty') {
        filter.category = null; // matches null or unset
      } else {
        const cat = await RevenueCategory.findOne({
          id: query.category,
        }).lean();
        if (cat) {
          filter.category = cat._id;
        }
      }
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.company && query.company !== 'all') {
      filter['companyProportions.company'] = query.company;
    }
    if (query.month && query.year) {
      const startDate = new Date(
        parseInt(query.year),
        parseInt(query.month) - 1,
        1,
      );
      const endDate = new Date(parseInt(query.year), parseInt(query.month), 1);
      filter.recordDate = { $gte: startDate, $lt: endDate };
    } else if (query.year) {
      const startDate = new Date(parseInt(query.year), 0, 1);
      const endDate = new Date(parseInt(query.year) + 1, 0, 1);
      filter.recordDate = { $gte: startDate, $lt: endDate };
    }

    const [items, total] = await Promise.all([
      Revenue.find(filter)
        .populate('category', 'id name')
        .sort({ recordDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Revenue.countDocuments(filter),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getRevenueById(id) {
    const revenue = await Revenue.findById(id)
      .populate('category', 'id name')
      .lean();
    if (!revenue) throw createHttpError(404, 'Không tìm thấy doanh thu');
    return revenue;
  }

  async _generateOrderId(categoryId) {
    let prefix = 'REV';
    if (categoryId) {
      const cat = await RevenueCategory.findById(categoryId).lean();
      if (cat) {
      }
    }
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yymm = `${yy}${mm}`;

    const counterKey = `REV_${yymm}`;
    const counter = await Counter.findByIdAndUpdate(
      counterKey,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const stt = String(counter.seq - 1).padStart(2, '0');
    return `${prefix}-${yymm}-${stt}`;
  }

  async createRevenue(data) {
    if (!data.companyProportions || data.companyProportions.length === 0) {
      throw createHttpError(400, 'Vui lòng phân bổ công ty');
    }
    const sum = data.companyProportions.reduce(
      (acc, curr) => acc + curr.percentage,
      0,
    );
    if (sum !== 100)
      throw createHttpError(
        400,
        'Tổng tỷ lệ phần trăm các công ty phải bằng 100',
      );

    const companyIds = data.companyProportions.map((c) => c.company);
    const companies = await Company.find({ id: { $in: companyIds } }).lean();
    if (companies.length !== companyIds.length) {
      throw createHttpError(400, 'Một hoặc nhiều công ty không tồn tại');
    }

    if (!data.categoryId) {
      throw createHttpError(400, 'Vui lòng chọn danh mục');
    }

    const category = await RevenueCategory.findOne({ id: data.categoryId }).lean();
    if (!category) throw createHttpError(400, 'Danh mục không hợp lệ');

    const orderId = await this._generateOrderId(category);

    const revenue = new Revenue({
      ...data,
      category: category._id,
      orderId,
    });
    await revenue.save();
    return revenue.populate('category', 'id name');
  }

  async updateRevenue(id, data) {
    const updateData = { ...data };

    if (!data.companyProportions || data.companyProportions.length === 0) {
      throw createHttpError(400, 'Vui lòng phân bổ công ty');
    }
    const sum = data.companyProportions.reduce(
      (acc, curr) => acc + curr.percentage,
      0,
    );
    if (sum !== 100)
      throw createHttpError(
        400,
        'Tổng tỷ lệ phần trăm các công ty phải bằng 100',
      );

    const companyIds = data.companyProportions.map((c) => c.company);
    const companies = await Company.find({ id: { $in: companyIds } }).lean();
    if (companies.length !== companyIds.length) {
      throw createHttpError(400, 'Một hoặc nhiều công ty không tồn tại');
    }

    if (data.categoryId) {
      const category = await RevenueCategory.findOne({ id: data.categoryId }).lean();
      if (!category) throw createHttpError(400, 'Danh mục không hợp lệ');
      updateData.category = category._id;
    }

    const revenue = await Revenue.findById(id).populate('category', 'id name');
    if (!revenue) throw createHttpError(404, 'Không tìm thấy doanh thu');

    const oldState = revenue.toObject();
    Object.assign(revenue, updateData);
    await revenue.save();
    await revenue.populate('category', 'id name');
    const newState = revenue.toObject();
    const changes = computeChanges(oldState, newState);

    return { revenue, changes };
  }

  async deleteRevenue(id) {
    const revenue = await Revenue.findById(id);
    if (!revenue) throw createHttpError(404, 'Không tìm thấy doanh thu');
    await revenue.deleteOne();
    return revenue;
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  async getRevenueStats(query) {
    return this.statsService.getStats(query);
  }
}

module.exports = new RevenueService();

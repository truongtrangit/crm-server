const Expense = require('./expense.model');
const ExpenseCategory = require('./expenseCategory.model');
const Company = require('../../hr/company/company.model');
const ExpectedExpense = require('./expectedExpense.model');
const Counter = require('../../../core/models/Counter');
const User = require('../../system/user/user.model');
const {
  resolvePagination,
  buildPaginatedResponse,
} = require('../../../core/utils/pagination');
const { createHttpError } = require('../../../core/utils/http');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const { EXPENSE_STATUSES } = require('../../../core/constants/finance');
const { computeChanges } = require('../../../core/utils/diff');
const { escapeRegex } = require('../../../core/utils/query');
const { dayjs, VIETNAM_TZ } = require('../../../core/utils/date');

const FinanceCategoryBaseService = require('../finance_category_base.service');
const FinanceStatsService = require('../finance_stats.service');

class ExpenseService {
  constructor() {
    this.categoryService = new FinanceCategoryBaseService(
      ExpenseCategory,
      Expense,
      ID_PREFIXES.EXPENSE_CATEGORY,
      'phiếu chi',
    );
    this.statsService = new FinanceStatsService(
      Expense,
      ExpenseCategory,
      ['transactionId', 'description'],
      EXPENSE_STATUSES.CANCELLED,
      'Chưa phân loại',
    );
  }

  // ─── Expense Categories ──────────────────────────────────────────────────

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

  // ─── Expected Expenses ────────────────────────────────────────────────────

  async getExpectedExpenses(query = {}) {
    const filter = {};
    if (query.search) {
      filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
    }
    const expected = await ExpectedExpense.find(filter)
      .populate('category', 'id name')
      .sort({ createdAt: -1 })
      .lean();
    return expected;
  }

  async _generateExpectedExpenses(expected) {
    const currentYear = dayjs().tz(VIETNAM_TZ).year();
    const months = expected.allocatedMonths || [];
    if (months.length === 0) return;

    let baseAmount = expected.amount;
    let remainder = 0;

    if (expected.type === 'yearly') {
      baseAmount = Math.floor(expected.amount / months.length);
      remainder = expected.amount - baseAmount * months.length;
    }

    const sortedMonths = [...months].sort((a, b) => {
      if (typeof a === 'number') return a - b;
      const [mA, yA] = String(a).split('/');
      const [mB, yB] = String(b).split('/');
      if (yA !== yB) return Number(yA) - Number(yB);
      return Number(mA) - Number(mB);
    });

    for (let i = 0; i < sortedMonths.length; i++) {
      let m, y;
      if (typeof sortedMonths[i] === 'number') {
        m = sortedMonths[i];
        y = currentYear;
      } else {
        const parts = String(sortedMonths[i]).split('/');
        m = Number(parts[0]);
        y = Number(parts[1]);
      }

      let monthAmount = baseAmount;

      if (expected.type === 'yearly' && i === sortedMonths.length - 1) {
        monthAmount += remainder;
      }

      const recordDate = dayjs.tz(`${y}-${String(m).padStart(2, '0')}-01`, VIETNAM_TZ).toDate();
      const transactionId = await this._generateTransactionId(recordDate);

      const expense = new Expense({
        transactionId,
        recordDate,
        category: expected.category,
        description: expected.name,
        amount: monthAmount,
        companyProportions: expected.companyProportions,
        status: EXPENSE_STATUSES.PENDING,
        isExpected: true,
        expectedExpenseId: expected._id,
      });
      await expense.save();
    }
  }

  async _removeExpectedExpenses(expectedExpenseId, force = false) {
    if (!force) {
      const approved = await Expense.findOne({
        expectedExpenseId,
        status: EXPENSE_STATUSES.APPROVED,
      }).lean();
      if (approved) {
        throw createHttpError(
          400,
          'Đã có chi phí được duyệt cho khoản này. Vui lòng xác nhận ghi đè.',
          { code: 'RESOURCE_APPROVED_FORCE_REQUIRED' },
        );
      }
    }
    await Expense.deleteMany({ expectedExpenseId });
  }

  async createExpectedExpense(data) {
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

    const category = await ExpenseCategory.findOne({ id: data.categoryId });
    if (!category) throw createHttpError(400, 'Danh mục không hợp lệ');

    const id = await generateMonotonicId(ID_PREFIXES.EXPECTED_EXPENSE);
    const expected = new ExpectedExpense({
      ...data,
      id,
      category: category._id,
    });
    await expected.save();
    await this._generateExpectedExpenses(expected);
    return expected.populate('category', 'id name');
  }

  async updateExpectedExpense(id, data, force = false) {
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
      const category = await ExpenseCategory.findOne({ id: data.categoryId });
      if (!category) throw createHttpError(400, 'Danh mục không hợp lệ');
      updateData.category = category._id;
    }

    const expected = await ExpectedExpense.findOne({ id }).populate(
      'category',
      'id name',
    );
    if (!expected) throw createHttpError(404, 'Không tìm thấy chi phí dự kiến');

    await this._removeExpectedExpenses(expected._id, force);

    const oldState = expected.toObject();
    Object.assign(expected, updateData);
    await expected.save();
    await expected.populate('category', 'id name');
    const newState = expected.toObject();
    const changes = computeChanges(oldState, newState);

    await this._generateExpectedExpenses(expected);

    return { expected, changes };
  }

  async deleteExpectedExpense(id, force = false) {
    const expected = await ExpectedExpense.findOne({ id });
    if (!expected) throw createHttpError(404, 'Không tìm thấy chi phí dự kiến');

    await this._removeExpectedExpenses(expected._id, force);
    await ExpectedExpense.findByIdAndDelete(expected._id);
    return expected;
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  async getExpenses(query) {
    const { page, limit, skip } = resolvePagination(query || {});
    const filter = {};

    if (query.search) {
      filter.$or = [
        { transactionId: { $regex: escapeRegex(query.search), $options: 'i' } },
        { description: { $regex: escapeRegex(query.search), $options: 'i' } },
      ];
    }
    if (query.category && query.category !== 'all') {
      if (query.category === 'empty') {
        filter.category = null;
      } else {
        const cat = await ExpenseCategory.findOne({
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
    // Time filter (year/month)
    if (query.month && query.year) {
      const m = String(query.month).padStart(2, '0');
      const startDate = dayjs.tz(`${query.year}-${m}-01`, VIETNAM_TZ).startOf('day').toDate();
      const endDate = dayjs.tz(`${query.year}-${m}-01`, VIETNAM_TZ).add(1, 'month').startOf('day').toDate();
      filter.recordDate = { $gte: startDate, $lt: endDate };
    } else if (query.year) {
      const startDate = dayjs.tz(`${query.year}-01-01`, VIETNAM_TZ).startOf('day').toDate();
      const endDate = dayjs.tz(`${parseInt(query.year) + 1}-01-01`, VIETNAM_TZ).startOf('day').toDate();
      filter.recordDate = { $gte: startDate, $lt: endDate };
    }

    const [items, total] = await Promise.all([
      Expense.find(filter)
        .populate('category', 'id name')
        .sort({ recordDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Expense.countDocuments(filter),
    ]);

    // Format assignee if needed (if we want to populate User, we need to do it)
    // Note: assigneeId is String matching User.id. We can't use simple populate if User.id is string while we use mongoose ref.
    // Wait, the assigneeId field is: `assigneeId: { type: String, ref: "User", default: null }`
    // If User schema has `_id` as ObjectId and `id` as String, this won't populate automatically unless we use localField/foreignField or just map it.
    // I'll fetch Users manually.
    const userIds = [
      ...new Set(items.map((i) => i.assigneeId).filter(Boolean)),
    ];
    if (userIds.length > 0) {
      const users = await User.find(
        { id: { $in: userIds } },
        'id fullName avatar',
      ).lean();
      const userMap = users.reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {});
      items.forEach((item) => {
        if (item.assigneeId) {
          item.assignee = userMap[item.assigneeId] || {
            fullName: item.assigneeId,
          };
        }
      });
    }

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getExpenseById(id) {
    const expense = await Expense.findById(id)
      .populate('category', 'id name')
      .lean();
    if (!expense) throw createHttpError(404, 'Không tìm thấy chi phí');
    if (expense.assigneeId) {
      expense.assignee = (await User.findOne(
        { id: expense.assigneeId },
        'id fullName avatar',
      ).lean()) || { fullName: expense.assigneeId };
    }
    return expense;
  }

  async _generateTransactionId(inputDate = null) {
    const d = inputDate ? dayjs(inputDate).tz(VIETNAM_TZ) : dayjs().tz(VIETNAM_TZ);
    const yy = String(d.year()).slice(-2);
    const mm = String(d.month() + 1).padStart(2, '0');
    const yymm = `${yy}${mm}`;

    const prefix = 'EXP';

    const counterKey = `EXP_${yymm}`;
    const counter = await Counter.findByIdAndUpdate(
      counterKey,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const stt = String(counter.seq - 1).padStart(2, '0');
    return `${prefix}-${yymm}-${stt}`;
  }

  async createExpense(data) {
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

    let categoryObj = null;
    if (data.categoryId) {
      categoryObj = await ExpenseCategory.findOne({ id: data.categoryId });
      if (!categoryObj) throw createHttpError(400, 'Danh mục không hợp lệ');
    }

    const transactionId = await this._generateTransactionId(data.recordDate);

    const expense = new Expense({
      ...data,
      category: categoryObj ? categoryObj._id : null,
      transactionId,
    });
    await expense.save();
    return expense.populate('category', 'id name');
  }

  async updateExpense(id, data) {
    const existingExpense = await Expense.findById(id);
    if (!existingExpense) throw createHttpError(404, 'Không tìm thấy chi phí');

    const oldState = existingExpense.toObject();

    if (existingExpense.isExpected) {
      existingExpense.status = data.status;
      await existingExpense.save();
      await existingExpense.populate('category', 'id name');
      const newState = existingExpense.toObject();
      const changes = computeChanges(oldState, newState);
      return { expense: existingExpense, changes };
    }

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

    if (data.categoryId !== undefined) {
      if (data.categoryId) {
        const category = await ExpenseCategory.findOne({ id: data.categoryId });
        if (!category) throw createHttpError(400, 'Danh mục không hợp lệ');
        updateData.category = category._id;
      } else {
        updateData.category = null;
      }
    }

    Object.assign(existingExpense, updateData);
    await existingExpense.save();
    await existingExpense.populate('category', 'id name');
    const newState = existingExpense.toObject();
    const changes = computeChanges(oldState, newState);

    return { expense: existingExpense, changes };
  }

  async deleteExpense(id) {
    const expense = await Expense.findById(id);
    if (!expense) throw createHttpError(404, 'Không tìm thấy chi phí');
    await expense.deleteOne();
    return expense;
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  async getExpenseStats(query) {
    return this.statsService.getStats(query);
  }
}

module.exports = new ExpenseService();

const Expense = require("../models/Expense");
const ExpenseCategory = require("../models/ExpenseCategory");
const ExpectedExpense = require("../models/ExpectedExpense");
const Counter = require("../models/Counter");
const { resolvePagination, buildPaginatedResponse } = require("../utils/pagination");
const { createHttpError } = require("../utils/http");
const { generateMonotonicId, ID_PREFIXES } = require("../utils/id");

class ExpenseService {
  // ─── Expense Categories ──────────────────────────────────────────────────

  async getCategories(query = {}) {
    const filter = {};
    if (query.search) {
      filter.name = { $regex: query.search, $options: "i" };
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === "true" || query.isActive === true;
    }
    const categories = await ExpenseCategory.find(filter).sort({ createdAt: -1 }).lean();
    return categories;
  }

  async createCategory(data) {
    const id = await generateMonotonicId(ID_PREFIXES.EXPENSE_CATEGORY);
    const category = new ExpenseCategory({ ...data, id });
    await category.save();
    return category;
  }

  async updateCategory(id, data) {
    const category = await ExpenseCategory.findOneAndUpdate({ id }, data, { new: true }).lean();
    if (!category) {
      throw createHttpError(404, "Không tìm thấy danh mục");
    }
    return category;
  }

  async deleteCategory(id, force = false) {
    const category = await ExpenseCategory.findOne({ id }).lean();
    if (!category) {
      throw createHttpError(404, "Không tìm thấy danh mục");
    }
    const isUsed = await Expense.exists({ category: category._id });
    if (isUsed && !force) {
      throw createHttpError(400, "Danh mục đang được sử dụng, không thể xóa", { code: "RESOURCE_IN_USE" });
    }
    
    if (isUsed && force) {
      await Expense.updateMany({ category: category._id }, { $set: { category: null } });
    }
    
    await ExpenseCategory.deleteOne({ id });
    return { success: true };
  }

  // ─── Expected Expenses ────────────────────────────────────────────────────

  async getExpectedExpenses(query = {}) {
    const filter = {};
    if (query.search) {
      filter.name = { $regex: query.search, $options: "i" };
    }
    const expected = await ExpectedExpense.find(filter)
      .populate("category", "id name")
      .sort({ createdAt: -1 })
      .lean();
    return expected;
  }

  async _generateExpectedExpenses(expected) {
    const currentYear = new Date().getFullYear();
    const months = expected.allocatedMonths || [];
    if (months.length === 0) return;

    let baseAmount = expected.amount;
    let remainder = 0;

    if (expected.type === "yearly") {
      baseAmount = Math.floor(expected.amount / months.length);
      remainder = expected.amount - (baseAmount * months.length);
    }

    const sortedMonths = [...months].sort((a, b) => a - b);

    for (let i = 0; i < sortedMonths.length; i++) {
      const month = sortedMonths[i];
      let monthAmount = baseAmount;

      if (expected.type === "yearly" && i === sortedMonths.length - 1) {
        monthAmount += remainder;
      }

      const recordDate = new Date(currentYear, month - 1, 1);
      const transactionId = await this._generateTransactionId();

      const expense = new Expense({
        transactionId,
        recordDate,
        category: expected.category,
        description: expected.name,
        amount: monthAmount,
        status: "Chờ duyệt",
        isExpected: true,
        expectedExpenseId: expected._id
      });
      await expense.save();
    }
  }

  async _removeExpectedExpenses(expectedExpenseId) {
    await Expense.deleteMany({ expectedExpenseId });
  }

  async createExpectedExpense(data) {
    const category = await ExpenseCategory.findOne({ id: data.categoryId });
    if (!category) throw createHttpError(400, "Danh mục không hợp lệ");

    const id = await generateMonotonicId(ID_PREFIXES.EXPECTED_EXPENSE);
    const expected = new ExpectedExpense({
      ...data,
      id,
      category: category._id
    });
    await expected.save();
    await this._generateExpectedExpenses(expected);
    return expected.populate("category", "id name");
  }

  async updateExpectedExpense(id, data) {
    const updateData = { ...data };
    if (data.categoryId) {
      const category = await ExpenseCategory.findOne({ id: data.categoryId });
      if (!category) throw createHttpError(400, "Danh mục không hợp lệ");
      updateData.category = category._id;
    }

    const expected = await ExpectedExpense.findOneAndUpdate({ id }, updateData, { new: true })
      .populate("category", "id name")
      .lean();
    if (!expected) throw createHttpError(404, "Không tìm thấy chi phí dự kiến");
    
    await this._removeExpectedExpenses(expected._id);
    await this._generateExpectedExpenses(expected);
    
    return expected;
  }

  async deleteExpectedExpense(id) {
    const expected = await ExpectedExpense.findOneAndDelete({ id });
    if (!expected) throw createHttpError(404, "Không tìm thấy chi phí dự kiến");
    await this._removeExpectedExpenses(expected._id);
    return { success: true };
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  async getExpenses(query) {
    const { page, limit, skip } = resolvePagination(query || {});
    const filter = {};

    if (query.search) {
      filter.$or = [
        { transactionId: { $regex: query.search, $options: "i" } },
        { description: { $regex: query.search, $options: "i" } }
      ];
    }
    if (query.category && query.category !== "all") {
      if (query.category === "empty") {
        filter.category = null;
      } else {
        const cat = await ExpenseCategory.findOne({ id: query.category }).lean();
        if (cat) {
          filter.category = cat._id;
        }
      }
    }
    if (query.status && query.status !== "all") {
      filter.status = query.status;
    }
    // Time filter (year/month)
    if (query.month && query.year) {
      const startDate = new Date(parseInt(query.year), parseInt(query.month) - 1, 1);
      const endDate = new Date(parseInt(query.year), parseInt(query.month), 1);
      filter.recordDate = { $gte: startDate, $lt: endDate };
    } else if (query.year) {
      const startDate = new Date(parseInt(query.year), 0, 1);
      const endDate = new Date(parseInt(query.year) + 1, 0, 1);
      filter.recordDate = { $gte: startDate, $lt: endDate };
    }

    const [items, total] = await Promise.all([
      Expense.find(filter)
        .populate("category", "id name")
        .sort({ recordDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Expense.countDocuments(filter)
    ]);

    // Format assignee if needed (if we want to populate User, we need to do it)
    // Note: assigneeId is String matching User.id. We can't use simple populate if User.id is string while we use mongoose ref.
    // Wait, the assigneeId field is: `assigneeId: { type: String, ref: "User", default: null }`
    // If User schema has `_id` as ObjectId and `id` as String, this won't populate automatically unless we use localField/foreignField or just map it.
    // I'll fetch Users manually.
    const userIds = [...new Set(items.map(i => i.assigneeId).filter(Boolean))];
    if (userIds.length > 0) {
      const User = require("../models/User");
      const users = await User.find({ id: { $in: userIds } }, "id fullName avatar").lean();
      const userMap = users.reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {});
      items.forEach(item => {
        if (item.assigneeId) {
          item.assignee = userMap[item.assigneeId] || null;
        }
      });
    }

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getExpenseById(id) {
    const expense = await Expense.findById(id).populate("category", "id name").lean();
    if (!expense) throw createHttpError(404, "Không tìm thấy chi phí");
    if (expense.assigneeId) {
      const User = require("../models/User");
      expense.assignee = await User.findOne({ id: expense.assigneeId }, "id fullName avatar").lean();
    }
    return expense;
  }

  async _generateTransactionId() {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yymm = `${yy}${mm}`;

    const prefix = 'EXP';

    const counterKey = `EXP_${yymm}`;
    const counter = await Counter.findByIdAndUpdate(
      counterKey,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const stt = String(counter.seq).padStart(2, '0');
    return `${prefix}-${yymm}-${stt}`;
  }

  async createExpense(data) {
    let categoryObj = null;
    if (data.categoryId) {
        categoryObj = await ExpenseCategory.findOne({ id: data.categoryId });
        if (!categoryObj) throw createHttpError(400, "Danh mục không hợp lệ");
    }

    const transactionId = await this._generateTransactionId();

    const expense = new Expense({
      ...data,
      category: categoryObj ? categoryObj._id : null,
      transactionId
    });
    await expense.save();
    return expense.populate("category", "id name");
  }

  async updateExpense(id, data) {
    const existingExpense = await Expense.findById(id).lean();
    if (!existingExpense) throw createHttpError(404, "Không tìm thấy chi phí");

    if (existingExpense.isExpected) {
      const expense = await Expense.findByIdAndUpdate(id, { status: data.status }, { new: true })
        .populate("category", "id name")
        .lean();
      return expense;
    }

    const updateData = { ...data };
    if (data.categoryId !== undefined) {
      if (data.categoryId) {
        const category = await ExpenseCategory.findOne({ id: data.categoryId });
        if (!category) throw createHttpError(400, "Danh mục không hợp lệ");
        updateData.category = category._id;
      } else {
        updateData.category = null;
      }
    }

    const expense = await Expense.findByIdAndUpdate(id, updateData, { new: true })
      .populate("category", "id name")
      .lean();
    
    return expense;
  }

  async deleteExpense(id) {
    const result = await Expense.findByIdAndDelete(id);
    if (!result) throw createHttpError(404, "Không tìm thấy chi phí");
    return { success: true };
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  async getExpenseStats(query) {
    const filter = {};
    if (query.year) {
      const startDate = new Date(parseInt(query.year), parseInt(query.month || 1) - 1, 1);
      const endDate = query.month 
        ? new Date(parseInt(query.year), parseInt(query.month), 1)
        : new Date(parseInt(query.year) + 1, 0, 1);
      filter.recordDate = { $gte: startDate, $lt: endDate };
    }

    const expenses = await Expense.find(filter).populate('category', 'name id').lean();

    let totalAmount = 0;
    const categoryMap = {};

    for (const exp of expenses) {
      if (exp.status === 'Đã hủy') continue;

      totalAmount += exp.amount || 0;
      
      const catName = exp.category?.name || "Chưa phân loại";
      if (!categoryMap[catName]) {
        categoryMap[catName] = 0;
      }
      categoryMap[catName] += exp.amount || 0;
    }

    const categoriesStat = Object.keys(categoryMap).map(name => ({
      name,
      total: categoryMap[name]
    }));

    return {
      totalAmount,
      categories: categoriesStat
    };
  }
}

module.exports = new ExpenseService();

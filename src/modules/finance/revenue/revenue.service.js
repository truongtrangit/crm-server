const Revenue = require('./revenue.model');
const RevenueCategory = require('./revenueCategory.model');
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

class RevenueService {
  // ─── Revenue Categories ──────────────────────────────────────────────────

  async getCategories(query = {}) {
    const filter = {};
    if (query.search) {
      filter.name = { $regex: query.search, $options: "i" };
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === "true" || query.isActive === true;
    }
    const categories = await RevenueCategory.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    return categories;
  }

  async createCategory(data) {
    const id = await generateMonotonicId(ID_PREFIXES.REVENUE_CATEGORY);
    const category = new RevenueCategory({ ...data, id });
    await category.save();
    return category;
  }

  async updateCategory(id, data) {
    const category = await RevenueCategory.findOne({ id });
    if (!category) {
      throw createHttpError(404, "Không tìm thấy danh mục");
    }
    const oldState = category.toObject();
    Object.assign(category, data);
    await category.save();
    const newState = category.toObject();
    const changes = computeChanges(oldState, newState);
    return { category, changes };
  }

  async deleteCategory(id, force = false) {
    // Check if category is used
    const category = await RevenueCategory.findOne({ id });
    if (!category) {
      throw createHttpError(404, "Không tìm thấy danh mục");
    }
    const isUsed = await Revenue.exists({ category: category._id });
    if (isUsed && !force) {
      throw createHttpError(400, "Danh mục đang được sử dụng, không thể xóa", {
        code: "RESOURCE_IN_USE",
      });
    }

    if (isUsed && force) {
      // Remove category reference from all revenues using this category
      await Revenue.updateMany(
        { category: category._id },
        { $set: { category: null } },
      );
    }

    await RevenueCategory.deleteOne({ id });
    return category;
  }

  // ─── Expected Revenues ────────────────────────────────────────────────────

  async getExpectedRevenues(query = {}) {
    const filter = {};
    if (query.search) {
      filter.name = { $regex: query.search, $options: "i" };
    }
    const expected = await ExpectedRevenue.find(filter)
      .populate("category", "id name")
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
          "Đã có doanh thu được ghi nhận cho khoản này. Vui lòng xác nhận ghi đè.",
          { code: "RESOURCE_APPROVED_FORCE_REQUIRED" },
        );
      }
    }
    await Revenue.deleteMany({ expectedRevenueId });
  }

  async _generateExpectedRevenues(expected) {
    if (expected.type === "single") {
      if (!expected.expectedDate) return;
      const orderId = await this._generateOrderId(expected.category);
      const revenue = new Revenue({
        orderId,
        customerName: expected.name,
        category: expected.category,
        amount: expected.amount,
        recordDate: expected.expectedDate,
        status: REVENUE_STATUSES.PENDING,
        isExpected: true,
        expectedRevenueId: expected._id,
      });
      await revenue.save();
    } else if (expected.type === "allocated") {
      const months = expected.allocatedMonths || [];
      if (months.length === 0) return;

      const sortedMonths = [...months].sort((a, b) => {
        const [mA, yA] = a.split("/");
        const [mB, yB] = b.split("/");
        if (yA !== yB) return Number(yA) - Number(yB);
        return Number(mA) - Number(mB);
      });

      const baseAmount = Math.floor(expected.amount / months.length);
      const remainder = expected.amount - baseAmount * months.length;

      for (let i = 0; i < sortedMonths.length; i++) {
        const [m, y] = sortedMonths[i].split("/");
        let monthAmount = baseAmount;

        if (i === sortedMonths.length - 1) {
          monthAmount += remainder;
        }

        const recordDate = new Date(Number(y), Number(m) - 1, 1);
        const orderId = await this._generateOrderId(expected.category);
        const revenue = new Revenue({
          orderId,
          customerName: expected.name,
          category: expected.category,
          amount: monthAmount,
          recordDate,
          status: REVENUE_STATUSES.PENDING,
          isExpected: true,
          expectedRevenueId: expected._id,
        });
        await revenue.save();
      }
    }
  }

  async createExpectedRevenue(data) {
    const category = await RevenueCategory.findOne({ id: data.categoryId });
    if (!category) throw createHttpError(400, "Danh mục không hợp lệ");

    const id = await generateMonotonicId(ID_PREFIXES.EXPECTED_REVENUE);
    const expected = new ExpectedRevenue({
      ...data,
      id,
      category: category._id,
    });
    await expected.save();
    await this._generateExpectedRevenues(expected);
    return expected.populate("category", "id name");
  }

  async updateExpectedRevenue(id, data, force = false) {
    const updateData = { ...data };
    if (data.categoryId) {
      const category = await RevenueCategory.findOne({ id: data.categoryId });
      if (!category) throw createHttpError(400, "Danh mục không hợp lệ");
      updateData.category = category._id;
    }

    const expected = await ExpectedRevenue.findOne({ id }).populate(
      "category",
      "id name",
    );
    if (!expected)
      throw createHttpError(404, "Không tìm thấy doanh thu dự kiến");

    await this._removeExpectedRevenues(expected._id, force);

    const oldState = expected.toObject();
    Object.assign(expected, updateData);
    await expected.save();
    await expected.populate("category", "id name");
    const newState = expected.toObject();
    const changes = computeChanges(oldState, newState);

    await this._generateExpectedRevenues(expected);
    return { expected, changes };
  }

  async deleteExpectedRevenue(id, force = false) {
    const expected = await ExpectedRevenue.findOne({ id });
    if (!expected)
      throw createHttpError(404, "Không tìm thấy doanh thu dự kiến");

    await this._removeExpectedRevenues(expected._id, force);
    await ExpectedRevenue.findByIdAndDelete(expected._id);
    return expected;
  }

  // ─── Revenues ─────────────────────────────────────────────────────────────

  async getRevenues(query) {
    const { page, limit, skip } = resolvePagination(query || {});
    const filter = {};

    if (query.search) {
      filter.$or = [
        { customerName: { $regex: query.search, $options: "i" } },
        { orderId: { $regex: query.search, $options: "i" } },
        { details: { $regex: query.search, $options: "i" } },
      ];
    }
    if (query.category && query.category !== "all") {
      if (query.category === "empty") {
        filter.category = null; // matches null or unset
      } else {
        // Find category by ID first if query passes the string id
        const cat = await RevenueCategory.findOne({
          id: query.category,
        }).lean();
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
        .populate("category", "id name")
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
      .populate("category", "id name")
      .lean();
    if (!revenue) throw createHttpError(404, "Không tìm thấy doanh thu");
    return revenue;
  }

  async _generateOrderId(categoryObj) {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yymm = `${yy}${mm}`;

    // Use a fixed prefix 'REV' for all revenues to avoid confusion if category name changes
    const prefix = "REV";

    const counterKey = `REV_${yymm}`;
    const counter = await Counter.findByIdAndUpdate(
      counterKey,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const stt = String(counter.seq).padStart(2, "0");
    return `${prefix}-${yymm}-${stt}`;
  }

  async createRevenue(data) {
    const category = await RevenueCategory.findOne({ id: data.categoryId });
    if (!category) throw createHttpError(400, "Danh mục không hợp lệ");

    const orderId = await this._generateOrderId(category);

    const revenue = new Revenue({
      ...data,
      category: category._id,
      orderId,
    });
    await revenue.save();
    return revenue.populate("category", "id name");
  }

  async updateRevenue(id, data) {
    const updateData = { ...data };
    if (data.categoryId) {
      const category = await RevenueCategory.findOne({ id: data.categoryId });
      if (!category) throw createHttpError(400, "Danh mục không hợp lệ");
      updateData.category = category._id;
    }

    const revenue = await Revenue.findById(id).populate("category", "id name");
    if (!revenue) throw createHttpError(404, "Không tìm thấy doanh thu");

    const oldState = revenue.toObject();
    Object.assign(revenue, updateData);
    await revenue.save();
    await revenue.populate("category", "id name");
    const newState = revenue.toObject();
    const changes = computeChanges(oldState, newState);

    return { revenue, changes };
  }

  async deleteRevenue(id) {
    const revenue = await Revenue.findById(id);
    if (!revenue) throw createHttpError(404, "Không tìm thấy doanh thu");
    await revenue.deleteOne();
    return revenue;
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  async getRevenueStats(query) {
    const filter = {};
    if (query.year) {
      const startDate = new Date(
        parseInt(query.year),
        parseInt(query.month || 1) - 1,
        1,
      );
      const endDate = query.month
        ? new Date(parseInt(query.year), parseInt(query.month), 1)
        : new Date(parseInt(query.year) + 1, 0, 1);
      filter.recordDate = { $gte: startDate, $lt: endDate };
    }

    const revenues = await Revenue.find(filter)
      .populate("category", "name id")
      .lean();

    let totalAmount = 0;
    const categoryMap = {};

    for (const rev of revenues) {
      // Only count Complete (Hoàn thành) revenue for main stats, or all? Let's count all that are not cancelled.
      if (rev.status === REVENUE_STATUSES.CANCELLED) continue;

      totalAmount += rev.amount || 0;

      const catName = rev.category?.name || "Khác";
      if (!categoryMap[catName]) {
        categoryMap[catName] = 0;
      }
      categoryMap[catName] += rev.amount || 0;
    }

    const categoriesStat = Object.keys(categoryMap).map((name) => ({
      name,
      total: categoryMap[name],
    }));

    return {
      totalAmount,
      categories: categoriesStat,
    };
  }
}

module.exports = new RevenueService();

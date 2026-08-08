const { escapeRegex } = require('../../core/utils/query');
const { dayjs, VIETNAM_TZ } = require('../../core/utils/date');

class FinanceStatsService {
  constructor(Model, CategoryModel, searchFields, cancelledStatus, emptyCategoryName = 'Khác') {
    this.Model = Model;
    this.CategoryModel = CategoryModel;
    this.searchFields = searchFields;
    this.cancelledStatus = cancelledStatus;
    this.emptyCategoryName = emptyCategoryName;
  }

  async getStats(query) {
    const filter = {};

    if (query.search) {
      filter.$or = this.searchFields.map((field) => ({
        [field]: { $regex: escapeRegex(query.search), $options: 'i' },
      }));
    }

    if (query.category && query.category !== 'all') {
      if (query.category === 'empty') {
        filter.category = null;
      } else {
        const cat = await this.CategoryModel.findOne({
          id: query.category,
        }).lean();
        if (cat) filter.category = cat._id;
      }
    }

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.company && query.company !== 'all') {
      filter['companyProportions.company'] = query.company;
    }

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

    const records = await this.Model.find(filter)
      .populate('category', 'name id')
      .lean();

    let totalAmount = 0;
    const categoryMap = {};

    for (const record of records) {
      if (record.status === this.cancelledStatus) continue;

      let amount = record.amount || 0;
      if (
        query.company &&
        query.company !== 'all' &&
        record.companyProportions &&
        record.companyProportions.length > 0
      ) {
        const prop = record.companyProportions.find(
          (c) => c.company === query.company,
        );
        if (prop) {
          amount = amount * (prop.percentage / 100);
        } else {
          amount = 0;
        }
      } else if (
        query.company &&
        query.company !== 'all' &&
        (!record.companyProportions || record.companyProportions.length === 0)
      ) {
        amount = 0;
      }

      totalAmount += amount;

      const catName = record.category?.name || this.emptyCategoryName;
      if (!categoryMap[catName]) {
        categoryMap[catName] = 0;
      }
      categoryMap[catName] += amount;
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

module.exports = FinanceStatsService;

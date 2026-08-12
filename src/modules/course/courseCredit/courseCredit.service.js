const CreditTransaction = require('../../customer/credit/creditTransaction.model');
const Customer = require('../../customer/customer/customer.model');
const {
  CREDIT_TRANSACTION_TYPES,
  CREDIT_TYPES,
  CREDIT_TRANSACTION_STATUS,
} = require('../../../core/constants/appData');
const { createHttpError } = require('../../../core/utils/http');

class CourseCreditService {
  /**
   * Get credit topup history for CRM Admin with pagination, filtering & statistics
   * @param {object} query 
   */
  async getTopupHistory(query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const {
      search,
      creditType,
      source,
      status,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Base match query for topups
    // Note: softDeletePlugin auto-filters isDeleted for find/countDocuments,
    // but aggregate bypasses middleware so we add isDeleted filter there explicitly.
    const matchQuery = {
      transactionType: CREDIT_TRANSACTION_TYPES.IN,
    };

    if (creditType) {
      matchQuery.creditType = creditType;
    }

    if (source) {
      if (source === 'other') {
        matchQuery.source = { $nin: ['bank_transfer', 'voucher', 'smaxai'] };
      } else {
        matchQuery.source = source;
      }
    }

    if (status) {
      matchQuery.status = status;
    }

    if (fromDate || toDate) {
      matchQuery.createdAt = {};
      if (fromDate) matchQuery.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        matchQuery.createdAt.$lte = endDate;
      }
    }

    // Handle customer search or reference search if provided
    let matchingUserIds = null;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      // Search matching customers first
      const customers = await Customer.find({
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { email: searchRegex },
          { id: searchRegex },
        ],
      })
        .select('id')
        .lean();

      matchingUserIds = customers.map((c) => c.id);

      matchQuery.$or = [
        { reference: searchRegex },
        { description: searchRegex },
        { userId: { $in: matchingUserIds } },
      ];
    }

    const sortOption = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // 1. Calculate overall summary statistics for topups under current date/source filters
    const statsMatchQuery = { ...matchQuery };
    delete statsMatchQuery.creditType; // Exclude creditType filter to show overall breakdown across all 3 credit types

    const statsAggregation = await CreditTransaction.aggregate([
      { $match: { ...statsMatchQuery, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$creditType',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalMainAmount = 0;
    let totalRewardAmount = 0;
    let totalEduAmount = 0;
    let totalTransactionsCount = 0;

    statsAggregation.forEach((stat) => {
      totalTransactionsCount += stat.count;
      if (stat._id === CREDIT_TYPES.MAIN) totalMainAmount += stat.totalAmount;
      if (stat._id === CREDIT_TYPES.REWARD) totalRewardAmount += stat.totalAmount;
      if (stat._id === CREDIT_TYPES.EDU) totalEduAmount += stat.totalAmount;
    });

    // 2. Fetch paginated transactions
    const [transactions, total] = await Promise.all([
      CreditTransaction.find(matchQuery)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      CreditTransaction.countDocuments(matchQuery),
    ]);

    // 3. Populate customer info
    const userIds = [...new Set(transactions.map((t) => t.userId))];
    const customerMap = {};

    if (userIds.length > 0) {
      const customerDocs = await Customer.find({ id: { $in: userIds } })
        .select('id name phone email avatar mainType subType isEduAccount')
        .lean();
      customerDocs.forEach((c) => {
        customerMap[c.id] = c;
      });
    }

    const items = transactions.map((t) => ({
      _id: t._id,
      userId: t.userId,
      customer: customerMap[t.userId] || {
        id: t.userId,
        name: 'Khách hàng',
        phone: '',
        email: '',
        avatar: '',
      },
      amount: t.amount,
      creditType: t.creditType,
      transactionType: t.transactionType,
      source: t.source,
      reference: t.reference,
      transactionGroupId: t.transactionGroupId,
      idempotencyKey: t.idempotencyKey,
      status: t.status,
      description: t.description,
      createdAt: t.createdAt,
    }));

    return {
      items,
      stats: {
        totalMainAmount,
        totalRewardAmount,
        totalEduAmount,
        totalTransactionsCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

module.exports = new CourseCreditService();

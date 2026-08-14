const createHttpError = require('http-errors');
const FavoriteCourse = require('./favoriteCourse.model');
const CourseChallenge = require('../courseChallenge/courseChallenge.model');
const CourseOnline = require('../courseOnline/courseOnline.model');
const CourseOffline = require('../courseOffline/courseOffline.model');
const { COURSE_TYPES } = require('../../../core/constants/appData');
const { ID_PREFIXES, generateMonotonicId } = require('../../../core/utils/id');
const {
  SYSTEM_SOURCES,
  SYSTEM_EVENT_TYPES,
} = require('../../../core/constants/integrationConfig');

class FavoriteCourseService {
  /**
   * Lấy danh sách khoá học yêu thích của một customer.
   * Populate thông tin cơ bản của course (title, cover, status).
   */
  async getMyFavorites(customerId) {
    const favorites = await FavoriteCourse.find({ customerId })
      .sort({ addedAt: -1 })
      .lean();

    if (favorites.length === 0) return [];

    // Batch-load course details
    const challengeIds = [];
    const onlineIds = [];
    const offlineIds = [];

    for (const fav of favorites) {
      switch (fav.courseType) {
        case COURSE_TYPES.CHALLENGE:
          challengeIds.push(fav.courseId);
          break;
        case COURSE_TYPES.ONLINE:
          onlineIds.push(fav.courseId);
          break;
        case COURSE_TYPES.OFFLINE:
          offlineIds.push(fav.courseId);
          break;
      }
    }

    const courseFields = 'id title name cover covers status packages';
    const [challenges, onlines, offlines] = await Promise.all([
      challengeIds.length
        ? CourseChallenge.find({
            id: { $in: challengeIds },
            isDeleted: { $ne: true },
          })
            .select(courseFields)
            .lean()
        : [],
      onlineIds.length
        ? CourseOnline.find({
            id: { $in: onlineIds },
            isDeleted: { $ne: true },
          })
            .select(courseFields)
            .lean()
        : [],
      offlineIds.length
        ? CourseOffline.find({
            id: { $in: offlineIds },
            isDeleted: { $ne: true },
          })
            .select(courseFields)
            .lean()
        : [],
    ]);

    const courseMap = new Map();
    [...challenges, ...onlines, ...offlines].forEach((c) => {
      courseMap.set(c.id, c);
    });

    return favorites.map((fav) => ({
      ...fav,
      course: courseMap.get(fav.courseId) || null,
    }));
  }

  /**
   * Thêm khoá học vào yêu thích.
   * Idempotent: nếu đã tồn tại thì trả về item hiện có (không lỗi).
   */
  async addFavorite(customerId, courseId, courseType) {
    // Validate course tồn tại
    const course = await this._findCourse(courseId, courseType);
    if (!course) {
      return null; // Silent fail for UX
    }

    // Check đã tồn tại chưa (idempotent)
    const existing = await FavoriteCourse.findOne({
      customerId,
      courseId,
    }).lean();
    if (existing) {
      return existing;
    }

    const id = await generateMonotonicId(ID_PREFIXES.FAVORITE_COURSE);
    const favorite = await FavoriteCourse.create({
      id,
      customerId,
      courseId,
      courseType,
    });

    // Bắn event vào CRM (fire-and-forget)
    require('../../../core/services/CrmEventEmitter').emit(
      SYSTEM_SOURCES?.BOTVN,
      SYSTEM_EVENT_TYPES?.BOTVN_YEU_THICH,
      {
        customerId,
        courseId,
        courseName: course.name || course.title || '',
      },
    );

    return favorite.toObject();
  }

  /**
   * Xoá khoá học khỏi yêu thích.
   */
  async removeFavorite(customerId, courseId) {
    const result = await FavoriteCourse.deleteOne({ customerId, courseId });
    if (result.deletedCount === 0) {
      return null; // Silent fail for UX
    }
  }

  /**
   * Batch check xem các courseIds nào đang trong danh sách yêu thích.
   * Trả về Set-like object { courseId: true/false }
   */
  async checkFavorites(customerId, courseIds) {
    const favorites = await FavoriteCourse.find({
      customerId,
      courseId: { $in: courseIds },
    })
      .select('courseId packageId')
      .lean();

    const result = {};
    for (const cid of courseIds) {
      const fav = favorites.find((f) => f.courseId === cid);
      result[cid] = fav
        ? { isFavorite: true, packageId: fav.packageId }
        : { isFavorite: false };
    }
    return result;
  }

  // ─── CRM Internal Methods ───────────────────────────────────────────

  /**
   * Lấy tất cả favorites cho CRM staff (có phân trang, lọc).
   */
  async getAllFavorites({
    page = 1,
    limit = 20,
    search,
    courseType,
    courseId,
    customerId,
    fromDate,
    toDate,
    sortBy = 'addedAt',
    sortOrder = 'desc',
  }) {
    const filter = {};

    if (courseType) filter.courseType = courseType;
    if (courseId) filter.courseId = courseId;
    if (customerId) filter.customerId = customerId;

    if (fromDate || toDate) {
      filter.addedAt = {};
      if (fromDate) filter.addedAt.$gte = new Date(fromDate);
      if (toDate) filter.addedAt.$lte = new Date(toDate);
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FavoriteCourse.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      FavoriteCourse.countDocuments(filter),
    ]);

    if (items.length === 0) {
      return { data: [], pagination: { page, limit, total, totalPages: 0 } };
    }

    // Batch-load course + customer details
    const Customer = require('../../customer/customer/customer.model');

    const customerIds = [...new Set(items.map((i) => i.customerId))];
    const challengeIds = [];
    const onlineIds = [];
    const offlineIds = [];

    for (const item of items) {
      switch (item.courseType) {
        case COURSE_TYPES.CHALLENGE:
          challengeIds.push(item.courseId);
          break;
        case COURSE_TYPES.ONLINE:
          onlineIds.push(item.courseId);
          break;
        case COURSE_TYPES.OFFLINE:
          offlineIds.push(item.courseId);
          break;
      }
    }

    const courseFields = 'id title name cover covers status';
    const customerFields = 'id name email phone avatar';
    const [challenges, onlines, offlines, customers] = await Promise.all([
      challengeIds.length
        ? CourseChallenge.find({ id: { $in: challengeIds } })
            .select(courseFields)
            .lean()
        : [],
      onlineIds.length
        ? CourseOnline.find({ id: { $in: onlineIds } })
            .select(courseFields)
            .lean()
        : [],
      offlineIds.length
        ? CourseOffline.find({ id: { $in: offlineIds } })
            .select(courseFields)
            .lean()
        : [],
      customerIds.length
        ? Customer.find({ id: { $in: customerIds } })
            .select(customerFields)
            .lean()
        : [],
    ]);

    const courseMap = new Map();
    [...challenges, ...onlines, ...offlines].forEach((c) =>
      courseMap.set(c.id, c),
    );

    const customerMap = new Map();
    customers.forEach((c) => customerMap.set(c.id, c));

    // Search filter (post-query on customer name / course title)
    let enriched = items.map((item) => ({
      ...item,
      course: courseMap.get(item.courseId) || null,
      customer: customerMap.get(item.customerId) || null,
    }));

    if (search) {
      const q = search.toLowerCase();
      enriched = enriched.filter((item) => {
        const courseName = (
          item.course?.title ||
          item.course?.name ||
          ''
        ).toLowerCase();
        const customerName = (item.customer?.name || '').toLowerCase();
        const customerEmail = (item.customer?.email || '').toLowerCase();
        const customerPhone = item.customer?.phone || '';
        return (
          courseName.includes(q) ||
          customerName.includes(q) ||
          customerEmail.includes(q) ||
          customerPhone.includes(q)
        );
      });
    }

    return {
      data: enriched,
      pagination: {
        page,
        limit,
        total: search ? enriched.length : total,
        totalPages: Math.ceil((search ? enriched.length : total) / limit),
      },
    };
  }

  /**
   * Thống kê favorites cho CRM dashboard.
   */
  async getFavoriteStats({ courseType, fromDate, toDate }) {
    const filter = {};
    if (courseType) filter.courseType = courseType;
    if (fromDate || toDate) {
      filter.addedAt = {};
      if (fromDate) filter.addedAt.$gte = new Date(fromDate);
      if (toDate) filter.addedAt.$lte = new Date(toDate);
    }

    const [total, byCourseType] = await Promise.all([
      FavoriteCourse.countDocuments(filter),
      FavoriteCourse.aggregate([
        { $match: filter },
        { $group: { _id: '$courseType', count: { $sum: 1 } } },
      ]),
    ]);

    const byType = {};
    for (const item of byCourseType) {
      byType[item._id] = item.count;
    }

    return { total, byType };
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  async _findCourse(courseId, courseType) {
    const orQ = [{ id: courseId }];

    switch (courseType) {
      case COURSE_TYPES.CHALLENGE:
        return CourseChallenge.findOne({
          $or: orQ,
          isTemplate: false,
          isDeleted: { $ne: true },
        }).lean();
      case COURSE_TYPES.ONLINE:
        return CourseOnline.findOne({
          $or: orQ,
          isDeleted: { $ne: true },
        }).lean();
      case COURSE_TYPES.OFFLINE:
        return CourseOffline.findOne({
          $or: orQ,
          isDeleted: { $ne: true },
        }).lean();
      default:
        return null;
    }
  }
}

module.exports = new FavoriteCourseService();

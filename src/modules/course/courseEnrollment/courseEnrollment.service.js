const CourseEnrollment = require('../courseChallenge/courseEnrollment.model');
const Customer = require('../../customer/customer/customer.model');
const createHttpError = require('http-errors');
const {
  resolvePagination,
  buildPaginatedResponse,
} = require('../../../core/utils/pagination');
const { COURSE_ENROLLMENT_STATUS } = require('../../../core/constants/appData');
const { getStartOfDayVN, getEndOfDayVN } = require('../../../core/utils/date');
const { escapeRegex } = require('../../../core/utils/query');

class CourseEnrollmentService {
  async getEnrollmentsByCourseId(courseId, query) {
    const { page, limit, skip } = resolvePagination(query);
    const filter = { courseId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.packageId) {
      filter.packageId = query.packageId;
    }

    if (query.search) {
      const escaped = escapeRegex(query.search);
      const searchRegex = new RegExp(escaped, 'i');
      const matchedCustomers = await Customer.find({ name: searchRegex })
        .select('id')
        .lean();
      const matchedIds = matchedCustomers.map((c) => c.id);

      filter.$or = [
        { studentId: searchRegex },
        { studentId: { $in: matchedIds } },
      ];
    }

    const [enrollments, total] = await Promise.all([
      CourseEnrollment.aggregate([
        { $match: filter },
        { $sort: { enrolledAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'customers',
            localField: 'studentId',
            foreignField: 'id',
            as: 'customer',
          },
        },
        {
          $addFields: {
            customerId: { $arrayElemAt: ['$customer', 0] },
          },
        },
        {
          $lookup: {
            from: 'coursesubmissions',
            let: { eId: '$id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$enrollmentId', '$$eId'] },
                      { $eq: ['$isDeleted', false] },
                    ],
                  },
                },
              },
              {
                $project: {
                  id: 1,
                  targetId: 1,
                  status: 1,
                  submissionLevel: 1,
                  submittedAt: 1,
                },
              },
            ],
            as: 'submissions',
          },
        },
        {
          $project: {
            customer: 0,
          },
        },
      ]),
      CourseEnrollment.countDocuments(filter),
    ]);

    return buildPaginatedResponse(enrollments, total, page, limit);
  }

  /**
   * Admin: Get all course enrollments across all courses
   */
  async getAllEnrollments(query = {}) {
    const { page, limit, skip } = resolvePagination(query);
    const filter = {};

    if (query.courseType) {
      filter.courseType = query.courseType;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.paymentMethod) {
      filter.paymentMethod = query.paymentMethod;
    }

    if (query.courseId) {
      filter.courseId = query.courseId;
    }

    const from = query.fromDate || query.startDate;
    const to = query.toDate || query.endDate;
    if (from || to) {
      filter.enrolledAt = {};
      if (from) filter.enrolledAt.$gte = getStartOfDayVN(from);
      if (to) filter.enrolledAt.$lte = getEndOfDayVN(to);
    }

    if (query.search) {
      const escaped = escapeRegex(query.search);
      const searchRegex = new RegExp(escaped, 'i');
      const matchedCustomers = await Customer.find({
        $or: [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }],
      })
        .select('id')
        .lean();
      const matchedCustomerIds = matchedCustomers.map((c) => c.id);

      filter.$or = [
        { id: searchRegex },
        { studentId: searchRegex },
        { studentId: { $in: matchedCustomerIds } },
        { courseId: searchRegex },
      ];
    }

    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy || 'enrolledAt';

    const [enrollments, total] = await Promise.all([
      CourseEnrollment.aggregate([
        { $match: filter },
        { $sort: { [sortBy]: sortOrder } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'customers',
            localField: 'studentId',
            foreignField: 'id',
            as: 'customerArr',
          },
        },
        {
          $lookup: {
            from: 'courseonlines',
            localField: 'courseId',
            foreignField: 'id',
            as: 'onlineCourse',
          },
        },
        {
          $lookup: {
            from: 'coursechallenges',
            localField: 'courseId',
            foreignField: 'id',
            as: 'challengeCourse',
          },
        },
        {
          $lookup: {
            from: 'courseofflines',
            localField: 'courseId',
            foreignField: 'id',
            as: 'offlineCourse',
          },
        },
        {
          $addFields: {
            customer: { $arrayElemAt: ['$customerArr', 0] },
            courseDetails: {
              $switch: {
                branches: [
                  {
                    case: { $in: ['$courseType', ['CourseOnline', 'ONLINE']] },
                    then: { $arrayElemAt: ['$onlineCourse', 0] },
                  },
                  {
                    case: { $in: ['$courseType', ['CourseOffline', 'OFFLINE']] },
                    then: { $arrayElemAt: ['$offlineCourse', 0] },
                  },
                  {
                    case: { $in: ['$courseType', ['CourseChallenge', 'CHALLENGE']] },
                    then: { $arrayElemAt: ['$challengeCourse', 0] },
                  },
                ],
                default: { $arrayElemAt: ['$challengeCourse', 0] },
              },
            },
          },
        },
        {
          $project: {
            customerArr: 0,
            onlineCourse: 0,
            challengeCourse: 0,
            offlineCourse: 0,
            'customer.billingInfo': 0,
          },
        },
      ]),
      CourseEnrollment.countDocuments(filter),
    ]);

    return buildPaginatedResponse(enrollments, total, page, limit);
  }

  /**
   * Admin: Get statistics for course enrollments
   */
  async getEnrollmentStats(query = {}) {
    const filter = {};

    if (query.courseType) {
      filter.courseType = query.courseType;
    }

    if (query.courseId) {
      filter.courseId = query.courseId;
    }

    if (query.paymentMethod) {
      filter.paymentMethod = query.paymentMethod;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { studentId: searchRegex },
        { 'customer.name': searchRegex },
        { 'customer.phone': searchRegex },
        { 'customer.email': searchRegex },
      ];
    }

    const from = query.fromDate || query.startDate;
    const to = query.toDate || query.endDate;
    if (from || to) {
      filter.enrolledAt = {};
      if (from) filter.enrolledAt.$gte = getStartOfDayVN(from);
      if (to) filter.enrolledAt.$lte = getEndOfDayVN(to);
    }

    const [total, active, inactive, locked, expired, cancelled, totalAmountResult] = await Promise.all([
      CourseEnrollment.countDocuments(filter),
      CourseEnrollment.countDocuments({ ...filter, status: COURSE_ENROLLMENT_STATUS.ACTIVE }),
      CourseEnrollment.countDocuments({ ...filter, status: COURSE_ENROLLMENT_STATUS.INACTIVE }),
      CourseEnrollment.countDocuments({ ...filter, status: COURSE_ENROLLMENT_STATUS.LOCKED }),
      CourseEnrollment.countDocuments({ ...filter, status: COURSE_ENROLLMENT_STATUS.EXPIRED }),
      CourseEnrollment.countDocuments({ ...filter, status: COURSE_ENROLLMENT_STATUS.CANCELLED }),
      CourseEnrollment.aggregate([
        { $match: { ...filter, status: { $ne: COURSE_ENROLLMENT_STATUS.CANCELLED } } },
        { $group: { _id: null, totalPaid: { $sum: '$amountPaid' } } },
      ]),
    ]);

    return {
      total,
      active,
      inactive,
      locked,
      expired,
      cancelled,
      totalAmountPaid: totalAmountResult[0]?.totalPaid || 0,
    };
  }

  async getMyEnrollments(studentId, query) {
    const { page, limit, skip } = resolvePagination(query);
    const filter = { studentId };

    const [enrollments, total] = await Promise.all([
      CourseEnrollment.aggregate([
        { $match: filter },
        { $sort: { enrolledAt: -1 } },
        { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'courseonlines',
          localField: 'courseId',
          foreignField: 'id',
          as: 'onlineCourse',
        },
      },
      {
        $lookup: {
          from: 'coursechallenges',
          localField: 'courseId',
          foreignField: 'id',
          as: 'challengeCourse',
        },
      },
      {
        $lookup: {
          from: 'courseofflines',
          localField: 'courseId',
          foreignField: 'id',
          as: 'offlineCourse',
        },
      },
      {
        $addFields: {
          courseDetails: {
            $switch: {
              branches: [
                {
                  case: { $in: ['$courseType', ['CourseOnline', 'ONLINE']] },
                  then: { $arrayElemAt: ['$onlineCourse', 0] },
                },
                {
                  case: { $in: ['$courseType', ['CourseOffline', 'OFFLINE']] },
                  then: { $arrayElemAt: ['$offlineCourse', 0] },
                },
                {
                  case: {
                    $in: ['$courseType', ['CourseChallenge', 'CHALLENGE']],
                  },
                  then: { $arrayElemAt: ['$challengeCourse', 0] },
                },
              ],
              default: { $arrayElemAt: ['$challengeCourse', 0] },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'courselecturers',
          localField: 'courseDetails.lecturers.lecturerId',
          foreignField: 'id',
          as: 'populatedLecturers',
        },
      },
      {
        $addFields: {
          'courseDetails.lecturers': {
            $map: {
              input: { $ifNull: ['$courseDetails.lecturers', []] },
              as: 'lect',
              in: {
                $mergeObjects: [
                  '$$lect',
                  {
                    details: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$populatedLecturers',
                            as: 'pl',
                            cond: { $eq: ['$$pl.id', '$$lect.lecturerId'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          onlineCourse: 0,
          challengeCourse: 0,
          offlineCourse: 0,
          populatedLecturers: 0,
        },
      },
    ]),
      CourseEnrollment.countDocuments(filter),
    ]);

    return buildPaginatedResponse(enrollments, total, page, limit);
  }

  async updateEnrollmentStatus(id, status, internalNote) {
    if (!Object.values(COURSE_ENROLLMENT_STATUS).includes(status)) {
      throw createHttpError(400, 'Trạng thái không hợp lệ');
    }

    const enrollment = await CourseEnrollment.findOne({ id });
    if (!enrollment) {
      throw createHttpError(404, 'Không tìm thấy enrollment');
    }

    const updateData = { status };
    if (internalNote !== undefined) {
      updateData.internalNote = internalNote;
    }

    const updated = await CourseEnrollment.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true, lean: true },
    );

    return updated;
  }

  async updateBatchEnrollmentStatus(ids, status, internalNote) {
    if (!Object.values(COURSE_ENROLLMENT_STATUS).includes(status)) {
      throw createHttpError(400, 'Trạng thái không hợp lệ');
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      throw createHttpError(400, 'Danh sách id không hợp lệ');
    }

    const updateData = { status };
    if (internalNote !== undefined) {
      updateData.internalNote = internalNote;
    }

    const result = await CourseEnrollment.updateMany(
      { id: { $in: ids } },
      { $set: updateData }
    );

    return {
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    };
  }

  async updateProgress(id, studentId, lastLessonIndex) {
    const enrollment = await CourseEnrollment.findOne({ id, studentId });
    if (!enrollment) {
      throw createHttpError(404, 'Không tìm thấy enrollment');
    }

    if (lastLessonIndex > (enrollment.lastLessonIndex || 0)) {
      enrollment.lastLessonIndex = lastLessonIndex;
      await enrollment.save();
    }

    return enrollment;
  }
}

module.exports = new CourseEnrollmentService();

const CourseEnrollment = require('../courseChallenge/courseEnrollment.model');
const Customer = require('../../customer/customer/customer.model');
const createHttpError = require('http-errors');
const {
  resolvePagination,
  buildPaginatedResponse,
} = require('../../../core/utils/pagination');
const { COURSE_ENROLLMENT_STATUS } = require('../../../core/constants/appData');

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
      const searchRegex = new RegExp(query.search, 'i');
      const matchedCustomers = await Customer.find({ name: searchRegex })
        .select('id')
        .lean();
      const matchedIds = matchedCustomers.map((c) => c.id);

      filter.$or = [
        { studentId: searchRegex },
        { studentId: { $in: matchedIds } },
      ];
    }

    const enrollments = await CourseEnrollment.aggregate([
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
          customer: 0, // remove array
        },
      },
    ]);
    const total = await CourseEnrollment.countDocuments(filter);

    return buildPaginatedResponse(enrollments, total, page, limit);
  }

  async getMyEnrollments(studentId, query) {
    const { page, limit, skip } = resolvePagination(query);
    const filter = { studentId };

    const enrollments = await CourseEnrollment.aggregate([
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
    ]);
    const total = await CourseEnrollment.countDocuments(filter);

    return buildPaginatedResponse(enrollments, total, page, limit);
  }

  async updateEnrollmentStatus(id, status) {
    if (!Object.values(COURSE_ENROLLMENT_STATUS).includes(status)) {
      throw createHttpError(400, 'Trạng thái không hợp lệ');
    }

    const enrollment = await CourseEnrollment.findOne({ id });
    if (!enrollment) {
      throw createHttpError(404, 'Không tìm thấy enrollment');
    }

    enrollment.status = status;
    await enrollment.save();

    return enrollment;
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

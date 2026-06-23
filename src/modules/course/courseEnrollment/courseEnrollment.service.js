const CourseEnrollment = require("../courseChallenge/courseEnrollment.model");
const createHttpError = require("http-errors");
const { resolvePagination, buildPaginatedResponse } = require("../../../core/utils/pagination");

class CourseEnrollmentService {
  async getEnrollmentsByCourseId(courseId, query) {
    const { page, limit, skip } = resolvePagination(query);
    const filter = { courseId };

    if (query.status) {
      filter.status = query.status;
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
          as: 'customer'
        }
      },
      {
        $addFields: {
          customerId: { $arrayElemAt: ['$customer', 0] }
        }
      },
      {
        $project: {
          customer: 0 // remove array
        }
      }
    ]);
    const total = await CourseEnrollment.countDocuments(filter);

    return buildPaginatedResponse(enrollments, total, page, limit);
  }

  async getMyEnrollments(studentId, query) {
    const { page, limit, skip } = resolvePagination(query);
    const filter = { studentId, status: "ACTIVE" };

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
          as: 'onlineCourse'
        }
      },
      {
        $lookup: {
          from: 'coursechallenges',
          localField: 'courseId',
          foreignField: 'id',
          as: 'challengeCourse'
        }
      },
      {
        $addFields: {
          courseDetails: {
            $cond: {
              if: { $eq: ["$courseType", "ONLINE"] },
              then: { $arrayElemAt: ["$onlineCourse", 0] },
              else: { $arrayElemAt: ["$challengeCourse", 0] }
            }
          }
        }
      },
      {
        $project: {
          onlineCourse: 0,
          challengeCourse: 0
        }
      }
    ]);
    const total = await CourseEnrollment.countDocuments(filter);

    return buildPaginatedResponse(enrollments, total, page, limit);
  }

  async updateEnrollmentStatus(id, status) {
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      throw createHttpError(400, "Trạng thái không hợp lệ");
    }

    const enrollment = await CourseEnrollment.findOne({ id });
    if (!enrollment) {
      throw createHttpError(404, "Không tìm thấy enrollment");
    }

    enrollment.status = status;
    await enrollment.save();

    return enrollment;
  }
}

module.exports = new CourseEnrollmentService();

const CourseSubmission = require("./courseSubmission.model");
const Customer = require("../../customer/customer/customer.model");
const CourseEnrollment = require("../courseChallenge/courseEnrollment.model");
const { createHttpError } = require("../../../core/utils/http");
const { generateMonotonicId, ID_PREFIXES } = require("../../../core/utils/id");
const {
  resolvePagination,
  buildPaginatedResponse,
  resolveSort,
} = require("../../../core/utils/pagination");
const { SUBMISSION_STATUS } = require("../../../core/constants/appData");

class CourseSubmissionService {
  /**
   * Student nộp bài (tạo mới).
   * Nếu đã tồn tại submission cho cùng target + level + enrollment → reject.
   */
  async submitAssignment(data, studentId) {
    // Verify enrollment exists & active
    const enrollment = await CourseEnrollment.findOne({
      id: data.enrollmentId,
      studentId,
      status: "ACTIVE",
    }).lean();

    if (!enrollment) {
      throw createHttpError(403, "Bạn chưa đăng ký khóa học này hoặc enrollment không hợp lệ");
    }

    // Check duplicate
    const existing = await CourseSubmission.findOne({
      enrollmentId: data.enrollmentId,
      submissionLevel: data.submissionLevel,
      targetId: data.targetId,
      isDeleted: false,
    }).lean();

    if (existing) {
      throw createHttpError(409, "Bạn đã nộp bài cho mục này rồi", {
        code: "SUBMISSION_EXISTS",
        details: { submissionId: existing.id },
      });
    }

    const id = await generateMonotonicId(ID_PREFIXES.COURSE_SUBMISSION);

    const submission = await CourseSubmission.create({
      id,
      courseId: data.courseId,
      courseType: data.courseType,
      enrollmentId: data.enrollmentId,
      studentId,
      submissionLevel: data.submissionLevel,
      targetId: data.targetId,
      links: data.links || [],
      content: data.content || "",
      attachments: data.attachments || [],
      status: SUBMISSION_STATUS.PENDING,
      submittedAt: new Date(),
    });

    return submission;
  }

  /**
   * Student cập nhật bài nộp (re-submit).
   * Chỉ cho phép nếu status = pending hoặc rejected.
   */
  async updateSubmission(submissionId, data, studentId) {
    const submission = await CourseSubmission.findOne({
      id: submissionId,
      studentId,
      isDeleted: false,
    });

    if (!submission) {
      throw createHttpError(404, "Không tìm thấy bài nộp");
    }

    if (submission.status === SUBMISSION_STATUS.APPROVED) {
      throw createHttpError(400, "Bài nộp đã được duyệt, không thể sửa");
    }

    // Update content
    if (data.links !== undefined) submission.links = data.links;
    if (data.content !== undefined) submission.content = data.content;
    if (data.attachments !== undefined) submission.attachments = data.attachments;

    // Reset to pending on re-submit
    submission.status = SUBMISSION_STATUS.PENDING;
    submission.feedback = "";
    submission.reviewedBy = null;
    submission.reviewedAt = null;
    submission.submittedAt = new Date();

    await submission.save();
    return submission;
  }

  /**
   * Student xoá bài nộp (chỉ khi status = pending).
   */
  async deleteSubmission(submissionId, studentId) {
    const submission = await CourseSubmission.findOne({
      id: submissionId,
      studentId,
      isDeleted: false,
    });

    if (!submission) {
      throw createHttpError(404, "Không tìm thấy bài nộp");
    }

    if (submission.status !== SUBMISSION_STATUS.PENDING) {
      throw createHttpError(400, "Chỉ có thể xoá bài nộp đang chờ duyệt");
    }

    submission.isDeleted = true;
    await submission.save();
    return null;
  }

  /**
   * Lấy danh sách bài nộp của 1 student.
   */
  async getMySubmissions(studentId, query) {
    const filter = { studentId, isDeleted: false };
    if (query.courseId) filter.courseId = query.courseId;
    if (query.enrollmentId) filter.enrollmentId = query.enrollmentId;
    if (query.submissionLevel) filter.submissionLevel = query.submissionLevel;
    if (query.status) filter.status = query.status;

    const { page, limit, skip } = resolvePagination(query);
    const sort = resolveSort(query, ["submittedAt", "createdAt"], { submittedAt: -1 });

    const [items, total] = await Promise.all([
      CourseSubmission.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      CourseSubmission.countDocuments(filter),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Admin: Lấy danh sách bài nộp của 1 khoá học (có phân trang, filter status, student).
   */
  async getSubmissionsForCourse(courseId, query) {
    const filter = { courseId, isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.submissionLevel) filter.submissionLevel = query.submissionLevel;
    if (query.targetId) filter.targetId = query.targetId;
    if (query.studentId) filter.studentId = query.studentId;

    if (query.search) {
      const searchRegex = new RegExp(query.search, "i");
      const matchedCustomers = await Customer.find({ name: searchRegex }).select("id").lean();
      const matchedIds = matchedCustomers.map(c => c.id);

      filter.$or = [
        { studentId: searchRegex },
        { studentId: { $in: matchedIds } }
      ];
    }

    const { page, limit, skip } = resolvePagination(query);
    const sort = resolveSort(query, ["submittedAt", "createdAt"], { submittedAt: -1 });

    const items = await CourseSubmission.aggregate([
      { $match: filter },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "customers",
          localField: "studentId",
          foreignField: "id",
          as: "student",
        },
      },
      {
        $addFields: {
          studentInfo: { $arrayElemAt: ["$student", 0] },
        },
      },
      {
        $project: {
          student: 0,
          "studentInfo.password": 0,
        },
      },
    ]);

    const total = await CourseSubmission.countDocuments(filter);
    return buildPaginatedResponse(items, total, page, limit);
  }

  /**
   * Admin: lấy chi tiết 1 bài nộp.
   */
  async getSubmissionById(submissionId) {
    const submission = await CourseSubmission.findOne({
      id: submissionId,
      isDeleted: false,
    }).lean();

    if (!submission) {
      throw createHttpError(404, "Không tìm thấy bài nộp");
    }

    return submission;
  }

  /**
   * Admin: chấm bài (approve / reject + feedback).
   */
  async reviewSubmission(submissionId, reviewData, reviewerId) {
    const submission = await CourseSubmission.findOne({
      id: submissionId,
      isDeleted: false,
    });

    if (!submission) {
      throw createHttpError(404, "Không tìm thấy bài nộp");
    }

    submission.status = reviewData.status;
    submission.feedback = reviewData.feedback || "";
    if (reviewData.grade !== undefined) submission.grade = reviewData.grade;
    submission.reviewedBy = reviewerId;
    submission.reviewedAt = new Date();

    await submission.save();
    return submission;
  }
}

module.exports = new CourseSubmissionService();

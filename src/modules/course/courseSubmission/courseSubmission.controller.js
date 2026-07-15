const { sendSuccess } = require("../../../core/utils/http");
const CourseSubmissionService = require("./courseSubmission.service");
const SystemLogService = require("../../system/log/systemLog.service");
const { RESOURCES } = require("../../../core/constants/rbac");

class CourseSubmissionController {
  // ─── Student APIs ──────────────────────────────────────────────────────────

  async submitAssignment(req, res) {
    const studentId = req.user?.id;
    const submission = await CourseSubmissionService.submitAssignment(
      req.body,
      studentId,
    );

    SystemLogService.log({
      action: "create",
      resource: RESOURCES.COURSES_SUBMISSIONS,
      resourceId: submission.id,
      resourceName: "Bài nộp của " + (req.user?.name || studentId),
      description: `Học viên nộp bài cho ID: ${submission.targetId}`,
      req,
    });

    return sendSuccess(res, 201, "Nộp bài thành công", submission);
  }

  async updateSubmission(req, res) {
    const { id } = req.params;
    const studentId = req.user?.id;
    const submission = await CourseSubmissionService.updateSubmission(
      id,
      req.body,
      studentId,
    );

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COURSES_SUBMISSIONS,
      resourceId: submission.id,
      resourceName: "Bài nộp của " + (req.user?.name || studentId),
      description: `Học viên cập nhật bài nộp`,
      req,
    });

    return sendSuccess(res, 200, "Cập nhật bài nộp thành công", submission);
  }

  async deleteSubmission(req, res) {
    const { id } = req.params;
    const studentId = req.user?.id;
    await CourseSubmissionService.deleteSubmission(id, studentId);

    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.COURSES_SUBMISSIONS,
      resourceId: id,
      resourceName: "Bài nộp " + id,
      description: `Học viên huỷ bài nộp`,
      req,
    });

    return sendSuccess(res, 200, "Xoá bài nộp thành công", null);
  }

  async getMySubmissions(req, res) {
    const studentId = req.user?.id;
    const data = await CourseSubmissionService.getMySubmissions(
      studentId,
      req.query,
    );
    return sendSuccess(res, 200, "Lấy danh sách bài nộp thành công", data);
  }

  // ─── Admin APIs ────────────────────────────────────────────────────────────

  async getSubmissionsForCourse(req, res) {
    const { courseId } = req.params;
    const data = await CourseSubmissionService.getSubmissionsForCourse(
      courseId,
      req.query,
    );
    return sendSuccess(res, 200, "Lấy danh sách bài nộp thành công", data);
  }

  async getSubmissionById(req, res) {
    const { id } = req.params;
    const submission = await CourseSubmissionService.getSubmissionById(id);
    return sendSuccess(res, 200, "Lấy chi tiết bài nộp thành công", submission);
  }

  async reviewSubmission(req, res) {
    const { id } = req.params;
    const reviewerId = req.user?.id;
    const submission = await CourseSubmissionService.reviewSubmission(
      id,
      req.body,
      reviewerId,
    );

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COURSES_SUBMISSIONS,
      resourceId: submission.id,
      resourceName: "Bài nộp " + submission.id,
      description: `Giảng viên chấm bài (Status: ${submission.status})`,
      req,
    });

    return sendSuccess(res, 200, "Chấm bài thành công", submission);
  }
}

module.exports = new CourseSubmissionController();

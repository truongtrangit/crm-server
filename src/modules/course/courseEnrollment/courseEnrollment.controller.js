const courseEnrollmentService = require("./courseEnrollment.service");
const { sendSuccess } = require("../../../core/utils/http");

class CourseEnrollmentController {
  async getEnrollmentsByCourseId(req, res) {
    const { courseId } = req.params;
    const result = await courseEnrollmentService.getEnrollmentsByCourseId(
      courseId,
      req.query,
    );
    return sendSuccess(res, 200, "Lấy danh sách học viên thành công", result);
  }

  async getMyEnrollments(req, res) {
    const studentId = req.user.id;
    const result = await courseEnrollmentService.getMyEnrollments(
      studentId,
      req.query,
    );
    return sendSuccess(res, 200, "Lấy danh sách khóa học của tôi thành công", result);
  }

  async updateEnrollmentStatus(req, res) {
    const { id } = req.params;
    const { status, internalNote } = req.body;
    const result = await courseEnrollmentService.updateEnrollmentStatus(
      id,
      status,
      internalNote
    );
    return sendSuccess(res, 200, "Cập nhật trạng thái thành công", result);
  }

  async updateBatchStatus(req, res) {
    const { ids, status, internalNote } = req.body;
    const result = await courseEnrollmentService.updateBatchEnrollmentStatus(
      ids,
      status,
      internalNote
    );
    return sendSuccess(res, 200, "Cập nhật trạng thái hàng loạt thành công", result);
  }

  async updateProgress(req, res) {
    const { id } = req.params;
    const { lastLessonIndex } = req.body;
    const studentId = req.user.id;
    const result = await courseEnrollmentService.updateProgress(
      id,
      studentId,
      lastLessonIndex,
    );
    return sendSuccess(res, 200, "Lưu tiến trình thành công", result);
  }
  async getAllEnrollments(req, res) {
    const result = await courseEnrollmentService.getAllEnrollments(req.query);
    return sendSuccess(res, 200, "Lấy tất cả danh sách đăng ký khóa học thành công", result);
  }

  async getEnrollmentStats(req, res) {
    const stats = await courseEnrollmentService.getEnrollmentStats(req.query);
    return sendSuccess(res, 200, "Lấy thống kê đăng ký khóa học thành công", stats);
  }
}

module.exports = new CourseEnrollmentController();

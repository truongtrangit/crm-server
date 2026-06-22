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

  async updateEnrollmentStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    const result = await courseEnrollmentService.updateEnrollmentStatus(
      id,
      status,
    );
    return sendSuccess(res, 200, "Cập nhật trạng thái thành công", result);
  }
}

module.exports = new CourseEnrollmentController();

const { sendSuccess } = require('../../../core/utils/http');
const CourseOfflineService = require('./courseOffline.service');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');
const { COURSE_STATUS } = require('../../../core/constants/appData');

class CourseOfflineController {
  // ============================================================================
  // INTERNAL APIs (Sử dụng cho CRM Admin, CMS)
  // ============================================================================

  async createCourse(req, res) {
    const course = await CourseOfflineService.createCourse(req.body, req.user);

    SystemLogService.log({
      action: "create",
      resource: RESOURCES.COURSES_OFFLINE,
      resourceId: course.id,
      resourceName: course.title,
      description: `Tạo mới khóa học offline "${course.title}"`,
      req,
    });

    return sendSuccess(res, 201, "Tạo khóa học thành công", course);
  }

  async getCourses(req, res) {
    const result = await CourseOfflineService.getCourses(req.query);
    return sendSuccess(res, 200, "Lấy danh sách khóa học thành công", result);
  }

  async getCourseById(req, res) {
    const course = await CourseOfflineService.getCourseById(req.params.id);
    return sendSuccess(res, 200, "Lấy thông tin khóa học thành công", course);
  }

  async updateCourse(req, res) {
    const course = await CourseOfflineService.updateCourse(
      req.params.id,
      req.body,
      req.user,
    );

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COURSES_OFFLINE,
      resourceId: course.id,
      resourceName: course.title,
      description: `Cập nhật khóa học offline "${course.title}"`,
      req,
    });

    return sendSuccess(res, 200, "Cập nhật khóa học thành công", course);
  }

  async deleteCourse(req, res) {
    const course = await CourseOfflineService.deleteCourse(
      req.params.id,
      req.user,
    );

    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.COURSES_OFFLINE,
      resourceId: course.id,
      resourceName: course.title,
      description: `Xóa khóa học offline "${course.title}"`,
      req,
    });

    return sendSuccess(res, 200, "Xóa khóa học thành công");
  }

  // ============================================================================
  // EXTERNAL APIs (Sử dụng cho Client bên ngoài như botvn, website)
  // ============================================================================

  async getExternalCourses(req, res) {
    const queryParams = {
      ...req.query,
      status: COURSE_STATUS.PUBLISHED,
    };
    const studentId = req.user?.id || null;
    const result = await CourseOfflineService.getCourses(queryParams, studentId);

    return sendSuccess(res, 200, "Lấy danh sách khóa học thành công", result);
  }

  async getCourseByIdentifier(req, res) {
    const studentId = req.user?.id || null;
    const course = await CourseOfflineService.getCourseByIdentifier(
      req.params.identifier,
      COURSE_STATUS.PUBLISHED,
      studentId
    );
    return sendSuccess(res, 200, "Lấy thông tin khóa học thành công", course);
  }
}

module.exports = new CourseOfflineController();

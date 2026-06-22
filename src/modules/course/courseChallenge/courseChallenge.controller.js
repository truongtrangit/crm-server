const { sendSuccess } = require("../../../core/utils/http");
const CourseChallengeService = require("./courseChallenge.service");
const SystemLogService = require("../../system/log/systemLog.service");
const { RESOURCES } = require("../../../core/constants/rbac");

// ---------------------------------------------------------------------------
// TEMPLATES
// ---------------------------------------------------------------------------
class CourseChallengeController {
  async getTemplates(req, res) {
    const data = await CourseChallengeService.getTemplates(req.query);
    return sendSuccess(res, 200, "Lấy danh sách khóa mẫu thành công", data);
  }

  async getTemplateById(req, res) {
    const { id } = req.params;
    const template = await CourseChallengeService.getTemplateById(id);
    return sendSuccess(res, 200, "Lấy thông tin khóa mẫu thành công", template);
  }

  async createTemplate(req, res) {
    const template = await CourseChallengeService.createTemplate(req.body, req.user);
    
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.COURSES_CHALLENGES,
      resourceId: template.id,
      resourceName: template.title,
      description: `Tạo khóa mẫu thử thách "${template.title}"`,
      metadata: { newItem: template },
      req,
    });

    return sendSuccess(res, 201, "Tạo khóa mẫu thành công", template);
  }

  async updateTemplate(req, res) {
    const { id } = req.params;
    const template = await CourseChallengeService.updateTemplate(id, req.body, req.user);

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COURSES_CHALLENGES,
      resourceId: template.id,
      resourceName: template.title,
      description: `Cập nhật khóa mẫu thử thách "${template.title}"`,
      req,
    });

    return sendSuccess(res, 200, "Cập nhật khóa mẫu thành công", template);
  }

  async deleteTemplate(req, res) {
    const { id } = req.params;
    const template = await CourseChallengeService.deleteTemplate(id);

    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.COURSES_CHALLENGES,
      resourceId: id,
      resourceName: template.title,
      description: `Xóa khóa mẫu thử thách "${template.title}"`,
      metadata: { deletedItem: template },
      req,
    });

    return sendSuccess(res, 200, "Xóa khóa mẫu thành công", null);
  }

  // ---------------------------------------------------------------------------
  // DEPLOYED COURSES
  // ---------------------------------------------------------------------------
  async getCourses(req, res) {
    const data = await CourseChallengeService.getCourses(req.query);
    return sendSuccess(res, 200, "Lấy danh sách khóa triển khai thành công", data);
  }

  async getCourseById(req, res) {
    const { id } = req.params;
    const course = await CourseChallengeService.getCourseById(id);
    return sendSuccess(res, 200, "Lấy thông tin khóa triển khai thành công", course);
  }

  async cloneTemplateToCourse(req, res) {
    const { id } = req.params;
    const course = await CourseChallengeService.cloneTemplateToCourse(id, req.body, req.user);

    SystemLogService.log({
      action: "create",
      resource: RESOURCES.COURSES_CHALLENGES,
      resourceId: course.id,
      resourceName: course.title,
      description: `Clone khóa triển khai "${course.title}" từ khóa mẫu ${id}`,
      metadata: { newItem: course },
      req,
    });

    return sendSuccess(res, 201, "Tạo khóa triển khai thành công", course);
  }

  async updateCourse(req, res) {
    const { id } = req.params;
    const course = await CourseChallengeService.updateCourse(id, req.body, req.user);

    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COURSES_CHALLENGES,
      resourceId: course.id,
      resourceName: course.title,
      description: `Cập nhật khóa triển khai "${course.title}"`,
      req,
    });

    return sendSuccess(res, 200, "Cập nhật khóa triển khai thành công", course);
  }

  async deleteCourse(req, res) {
    const { id } = req.params;
    const course = await CourseChallengeService.deleteCourse(id);

    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.COURSES_CHALLENGES,
      resourceId: id,
      resourceName: course.title,
      description: `Xóa khóa triển khai "${course.title}"`,
      metadata: { deletedItem: course },
      req,
    });

    return sendSuccess(res, 200, "Xóa khóa triển khai thành công", null);
  }

  // ---------------------------------------------------------------------------
  // CLIENT API (EXTERNAL)
  // ---------------------------------------------------------------------------
  async getMyProgress(req, res) {
    const { id } = req.params;
    // studentId is mocked or derived from req.user if external is authenticated
    const studentId = req.user?.id || req.body.studentId; 
    const progressData = await CourseChallengeService.getMyProgress(id, studentId);
    return sendSuccess(res, 200, "Lấy tiến độ thành công", progressData);
  }

  async submitDayAssignment(req, res) {
    const { id, dayId } = req.params;
    const studentId = req.user?.id || req.body.studentId;
    const submission = await CourseChallengeService.submitDayAssignment(id, dayId, req.body, studentId);
    return sendSuccess(res, 201, "Nộp bài thành công", submission);
  }

  async getPublicCourses(req, res) {
    const data = await CourseChallengeService.getPublicCourses(req.query);
    return sendSuccess(res, 200, "Lấy danh sách khóa học thành công", data);
  }

  async getPublicCourseBySlug(req, res) {
    const { slug } = req.params;
    const course = await CourseChallengeService.getPublicCourseBySlug(slug);
    return sendSuccess(res, 200, "Lấy chi tiết khóa học thành công", course);
  }


}

module.exports = new CourseChallengeController();

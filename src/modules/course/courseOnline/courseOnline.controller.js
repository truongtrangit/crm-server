const { sendSuccess } = require('../../../core/utils/http');
const CourseOnlineService = require('./courseOnline.service');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');
const { COURSE_ONLINE_STATUS } = require('./courseOnline.constants');

// ============================================================================
// INTERNAL APIs (Sử dụng cho CRM Admin, CMS)
// ============================================================================

const createCourse = async (req, res) => {
  const course = await CourseOnlineService.createCourse(req.body, req.user);

  SystemLogService.log({
    action: "create",
    resource: RESOURCES.COURSES_ONLINE,
    resourceId: course.id,
    resourceName: course.title,
    description: `Tạo mới khóa học online "${course.title}"`,
    req,
  });

  return sendSuccess(res, 201, "Tạo khóa học thành công", course);
};

const getCourses = async (req, res) => {
  const result = await CourseOnlineService.getCourses(req.query);

  return sendSuccess(res, 200, "Lấy danh sách khóa học thành công", result);
};

const getCourseById = async (req, res) => {
  const course = await CourseOnlineService.getCourseById(req.params.id);
  return sendSuccess(res, 200, "Lấy thông tin khóa học thành công", course);
};

const updateCourse = async (req, res) => {
  const course = await CourseOnlineService.updateCourse(
    req.params.id,
    req.body,
    req.user,
  );

  SystemLogService.log({
    action: "update",
    resource: RESOURCES.COURSES_ONLINE,
    resourceId: course.id,
    resourceName: course.title,
    description: `Cập nhật khóa học online "${course.title}"`,
    req,
  });

  return sendSuccess(res, 200, "Cập nhật khóa học thành công", course);
};

const deleteCourse = async (req, res) => {
  const course = await CourseOnlineService.deleteCourse(
    req.params.id,
    req.user,
  );

  SystemLogService.log({
    action: "delete",
    resource: RESOURCES.COURSES_ONLINE,
    resourceId: course.id,
    resourceName: course.title,
    description: `Xóa khóa học online "${course.title}"`,
    req,
  });

  return sendSuccess(res, 200, "Xóa khóa học thành công");
};

// ============================================================================
// EXTERNAL APIs (Sử dụng cho Client bên ngoài như botvn, website)
// ============================================================================

const getExternalCourses = async (req, res) => {
  const queryParams = { ...req.query, status: COURSE_ONLINE_STATUS.PUBLISHED };
  const result = await CourseOnlineService.getCourses(queryParams);

  return sendSuccess(res, 200, "Lấy danh sách khóa học thành công", result);
};

const getCourseByIdentifier = async (req, res) => {
  const course = await CourseOnlineService.getCourseByIdentifier(
    req.params.identifier,
    COURSE_ONLINE_STATUS.PUBLISHED
  );
  return sendSuccess(res, 200, "Lấy thông tin khóa học thành công", course);
};

module.exports = {
  // Internal
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,

  // External
  getExternalCourses,
  getCourseByIdentifier,
};

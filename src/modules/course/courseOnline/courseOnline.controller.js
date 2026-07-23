const { sendSuccess } = require('../../../core/utils/http');
const CourseOnlineService = require('./courseOnline.service');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');
const { COURSE_STATUS } = require('../../../core/constants/appData');
const { encryptVideoId } = require('../videoProvider/videoCrypto');

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

const INTERNAL_FIELDS = ['createdBy', 'isDeleted', 'deletedAt', '__v', '_id'];

const stripInternalFields = (obj) => {
  INTERNAL_FIELDS.forEach((f) => delete obj[f]);
};

const getExternalCourses = async (req, res) => {
  const queryParams = {
    ...req.query,
    status: COURSE_STATUS.PUBLISHED,
  };
  const studentId = req.user?.id || null;
  const result = await CourseOnlineService.getCourses(queryParams, studentId);

  // Strip internal fields from each course item
  if (result?.items) {
    result.items.forEach(stripInternalFields);
  }

  return sendSuccess(res, 200, "Lấy danh sách khóa học thành công", result);
};

const getCourseByIdentifier = async (req, res) => {
  const studentId = req.user?.id || null;
  const course = await CourseOnlineService.getCourseByIdentifier(
    req.params.identifier,
    COURSE_STATUS.PUBLISHED,
    studentId
  );

  // Strip internal fields for external clients
  stripInternalFields(course);

  return sendSuccess(res, 200, "Lấy thông tin khóa học thành công", course);
};

const getLessonVideoUrl = async (req, res) => {
  const { courseId, lessonId } = req.params;
  const studentId = req.user.id;
  const result = await CourseOnlineService.getLessonVideoUrl(
    courseId,
    lessonId,
    studentId,
    {
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    },
  );

  // Encrypt videoId before sending to client
  if (result?.videoId) {
    result.encryptedVideoId = encryptVideoId(result.videoId);
    delete result.videoId;
  }

  return sendSuccess(res, 200, "Lấy video URL thành công", result);
};

const logVideoEvent = async (req, res) => {
  const { courseId, lessonId } = req.params;
  const { eventType, eventData } = req.body;
  const studentId = req.user.id;

  await CourseOnlineService.logVideoEvent(
    courseId,
    lessonId,
    studentId,
    eventType,
    eventData,
    {
      ip: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"],
    },
  );

  return sendSuccess(res, 200, "Event logged");
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
  getLessonVideoUrl,
  logVideoEvent,
};

const { sendSuccess } = require('../../../core/utils/http');
const CourseOnlineService = require('./courseOnline.service');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../routes/v1/rbac');

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
  const { page, limit, search, status, category } = req.query;
  const filter = {};

  if (search) {
    filter.title = { $regex: search, $options: "i" };
  }
  if (status) {
    filter.status = status;
  }
  if (category) {
    filter.category = category;
  }

  const result = await CourseOnlineService.getCourses(filter, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 10,
  });

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

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
};

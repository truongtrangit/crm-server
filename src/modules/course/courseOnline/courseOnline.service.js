const createHttpError = require("http-errors");
const { generateMonotonicId } = require('../../../core/utils/id');
const CourseOnline = require('./courseOnline.model');
const { isOwnerOrAdmin } = require('../../../core/utils/userRoles');
const { buildPaginatedResponse } = require('../../../core/utils/pagination');

const createCourse = async (courseBody, user) => {
  const existingSlug = await CourseOnline.findOne({ slug: courseBody.slug });
  if (existingSlug) {
    throw createHttpError(400, "Slug đã tồn tại");
  }

  const id = await generateMonotonicId("CNO");
  const course = new CourseOnline({
    ...courseBody,
    id,
    createdBy: user.id,
  });

  await course.save();
  return course;
};

const getCourses = async (filter, options) => {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const skip = (page - 1) * limit;

  const courses = await CourseOnline.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await CourseOnline.countDocuments(filter);

  return buildPaginatedResponse(courses, total, page, limit);
};

const getCourseById = async (id) => {
  const course = await CourseOnline.findOne({ id });
  if (!course) {
    throw createHttpError(404, "Không tìm thấy khóa học");
  }
  return course;
};

const updateCourse = async (id, updateBody, user) => {
  const course = await getCourseById(id);

  // RLAC Check: Only Admin/Owner or Creator can update
  if (!isOwnerOrAdmin(user) && course.createdBy !== user.id) {
    throw createHttpError(403, "Bạn không có quyền cập nhật khóa học này");
  }

  if (updateBody.slug && updateBody.slug !== course.slug) {
    const existingSlug = await CourseOnline.findOne({ slug: updateBody.slug });
    if (existingSlug) {
      throw createHttpError(400, "Slug đã tồn tại");
    }
  }

  Object.assign(course, updateBody);
  await course.save();
  return course;
};

const deleteCourse = async (id, user) => {
  const course = await getCourseById(id);

  // RLAC Check: Only Admin/Owner or Creator can delete
  if (!isOwnerOrAdmin(user) && course.createdBy !== user.id) {
    throw createHttpError(403, "Bạn không có quyền xóa khóa học này");
  }

  await course.deleteOne();
  return course;
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
};

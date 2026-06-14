const createHttpError = require("http-errors");
const { generateMonotonicId } = require('../../../core/utils/id');
const CourseOnline = require('./courseOnline.model');
const { isOwnerOrAdmin } = require('../../../core/utils/userRoles');
const { buildPaginatedResponse, resolvePagination } = require('../../../core/utils/pagination');
const { buildSearchRegex } = require('../../../core/utils/query');
const CourseLecturer = require('../courseLecturer/courseLecturer.model');

const populateLecturers = async (courses) => {
  if (!courses) return courses;
  const isArray = Array.isArray(courses);
  const coursesList = isArray ? courses : [courses];

  const lecturerIds = new Set();
  coursesList.forEach(course => {
    if (course.lecturers) {
      course.lecturers.forEach(l => {
        if (typeof l.lecturerId === 'string') {
          lecturerIds.add(l.lecturerId);
        }
      });
    }
  });

  if (lecturerIds.size > 0) {
    const lecturers = await CourseLecturer.find({ id: { $in: Array.from(lecturerIds) } }).lean();
    const lecturerMap = {};
    lecturers.forEach(l => { lecturerMap[l.id] = l; });

    coursesList.forEach(course => {
      if (course.lecturers) {
        course.lecturers = course.lecturers.map(l => ({
          ...l,
          lecturerId: lecturerMap[l.lecturerId] || l.lecturerId
        }));
      }
    });
  }

  return isArray ? coursesList : coursesList[0];
};

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

const getCourses = async (queryParams) => {
  const { search, status, category } = queryParams || {};
  const filter = {};

  if (search) {
    const searchRegex = buildSearchRegex(search);
    if (searchRegex) {
      filter.title = searchRegex;
    }
  }
  if (status) {
    filter.status = status;
  }
  if (category) {
    filter.category = category.includes(',') ? { $in: category.split(',') } : category;
  }

  const { page, limit, skip } = resolvePagination(queryParams || {});

  const [courses, total] = await Promise.all([
    CourseOnline.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CourseOnline.countDocuments(filter)
  ]);

  await populateLecturers(courses);

  return buildPaginatedResponse(courses, total, page, limit);
};

const getCourseById = async (id) => {
  const course = await CourseOnline.findOne({ id });
  if (!course) {
    throw createHttpError(404, "Không tìm thấy khóa học");
  }
  return course;
};

const getCourseByIdentifier = async (identifier) => {
  let course = await CourseOnline.findOne({
    $or: [{ id: identifier }, { slug: identifier }]
  }).lean();
  if (!course) {
    throw createHttpError(404, "Không tìm thấy khóa học");
  }
  course = await populateLecturers(course);
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
  getCourseByIdentifier,
  updateCourse,
  deleteCourse,
};

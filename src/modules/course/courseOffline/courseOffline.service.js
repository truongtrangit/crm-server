const createHttpError = require('http-errors');
const { generateMonotonicId } = require('../../../core/utils/id');
const CourseOffline = require('./courseOffline.model');
const { isOwnerOrAdmin, hasExplicitModuleAccess } = require('../../../core/utils/userRoles');
const {
  buildPaginatedResponse,
  resolvePagination,
} = require('../../../core/utils/pagination');
const { buildSearchRegex } = require('../../../core/utils/query');
const { computePriceRange } = require('../../../core/utils/price');
const CourseLecturer = require('../courseLecturer/courseLecturer.model');
const CourseEnrollment = require('../courseChallenge/courseEnrollment.model');
const { COURSE_ENROLLMENT_STATUS } = require('../../../core/constants/appData');

const createCourse = async (courseBody, user) => {
  const existingSlug = await CourseOffline.findOne({
    slug: courseBody.slug,
    isDeleted: { $ne: true },
  });
  if (existingSlug) {
    throw createHttpError(400, 'Slug đã tồn tại');
  }

  computePriceRange(courseBody);

  const id = await generateMonotonicId('COF');

  if (courseBody.submissionSettings) {
    courseBody.submissionSettings.lessonDeadlineHours = 0;
    courseBody.submissionSettings.chapterDeadlineHours = 0;
    courseBody.submissionSettings.courseDeadlineHours = 0;
  }

  if (courseBody.lecturers && courseBody.lecturers.length > 0) {
    const lecturerIds = courseBody.lecturers.map((l) => l.lecturerId);
    const activeLecturersCount = await CourseLecturer.countDocuments({
      id: { $in: lecturerIds },
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    });
    if (activeLecturersCount !== lecturerIds.length) {
      throw createHttpError(
        400,
        'Một hoặc nhiều giảng viên không tồn tại hoặc đã bị vô hiệu hóa',
      );
    }
  }

  const course = new CourseOffline({
    ...courseBody,
    id,
    createdBy: user.id,
  });

  await course.save();
  return course;
};

const getCourses = async (queryParams, studentId = null) => {
  const { search, status, category, hashtags } = queryParams || {};
  const filter = { isDeleted: { $ne: true } };

  if (search) {
    const searchRegex = buildSearchRegex(search);
    if (searchRegex) {
      const matchingLecturers = await CourseLecturer.find(
        { name: searchRegex },
        { id: 1 },
      ).lean();
      const lecturerIds = matchingLecturers.map((l) => l.id);

      filter.$or = [{ title: searchRegex }];

      if (lecturerIds.length > 0) {
        filter.$or.push({ 'lecturers.lecturerId': { $in: lecturerIds } });
      }
    }
  }
  if (status) {
    filter.status = status;
  }
  if (category) {
    filter.category = category.includes(',')
      ? { $in: category.split(',') }
      : category;
  }
  if (hashtags) {
    filter.hashtags = hashtags.includes(',')
      ? { $in: hashtags.split(',') }
      : hashtags;
  }

  const { page, limit, skip } = resolvePagination(queryParams || {});

  const [courses, total] = await Promise.all([
    CourseOffline.find(filter)
      .populate('categoryDetails')
      .populate('hashtagDetails')
      .populate('lecturers.details')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    CourseOffline.countDocuments(filter),
  ]);

  if (courses.length > 0) {
    courses.forEach((course) => {
      course.isEnrolled = false;
    });
  }

  if (studentId && courses.length > 0) {
    const courseIds = courses.map((c) => c.id);
    const enrollments = await CourseEnrollment.find({
      studentId,
      courseId: { $in: courseIds },
    }).lean();

    const allEnrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
    const activeCourseIds = new Set(
      enrollments
        .filter((e) => e.status === COURSE_ENROLLMENT_STATUS.ACTIVE)
        .map((e) => e.courseId),
    );

    courses.forEach((course) => {
      if (allEnrolledCourseIds.has(course.id)) {
        course.isEnrolled = true;
        if (!activeCourseIds.has(course.id)) {
          course.isLocked = true;
        }
      }
    });
  }

  // Calculate registered students
  if (courses.length > 0) {
    const courseIds = courses.map((c) => c.id);
    const enrollmentCounts = await CourseEnrollment.aggregate([
      { $match: { courseId: { $in: courseIds }, status: 'ACTIVE' } },
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
    ]);
    const countMap = enrollmentCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    courses.forEach((course) => {
      course.registeredStudents = countMap[course.id] || 0;
    });
  }

  return buildPaginatedResponse(courses, total, page, limit);
};

const getCourseById = async (id) => {
  const course = await CourseOffline.findOne({ id, isDeleted: { $ne: true } })
    .populate('categoryDetails')
    .populate('hashtagDetails')
    .populate('lecturers.details');
  if (!course) {
    throw createHttpError(404, 'Không tìm thấy khóa học');
  }

  const registeredStudents = await CourseEnrollment.countDocuments({
    courseId: id,
    status: 'ACTIVE',
  });

  const courseObj = course.toObject();
  courseObj.registeredStudents = registeredStudents;

  return courseObj; // Return object with registeredStudents
};

const getCourseByIdentifier = async (
  identifier,
  requiredStatus = null,
  studentId = null,
) => {
  const query = {
    $or: [{ id: identifier }, { slug: identifier }],
    isDeleted: { $ne: true },
  };

  if (requiredStatus) {
    query.status = requiredStatus;
  }

  let course = await CourseOffline.findOne(query)
    .populate('categoryDetails')
    .populate('hashtagDetails')
    .populate('lecturers.details')
    .lean({ virtuals: true });

  if (!course) {
    throw createHttpError(404, 'Không tìm thấy khóa học');
  }

  course.isEnrolled = false;

  if (studentId) {
    const enrollment = await CourseEnrollment.findOne({
      studentId,
      courseId: course.id,
    }).lean();

    if (enrollment) {
      course.isEnrolled = true;
      course.enrollmentId = enrollment.id;
      course.enrollmentStatus = enrollment.status;
      if (enrollment.status !== COURSE_ENROLLMENT_STATUS.ACTIVE) {
        course.isLocked = true;
      }
    }
  }

  const registeredStudents = await CourseEnrollment.countDocuments({
    courseId: course.id,
    status: COURSE_ENROLLMENT_STATUS.ACTIVE,
  });
  course.registeredStudents = registeredStudents;

  return course;
};

const updateCourse = async (id, updateBody, user) => {
  const course = await CourseOffline.findOne({ id, isDeleted: { $ne: true } });
  if (!course) {
    throw createHttpError(404, 'Không tìm thấy khóa học');
  }

  // RLAC Check: Allowed if Admin/Owner OR user has explicit module access for courses OR user is Creator
  const canEdit = isOwnerOrAdmin(user) || 
                  hasExplicitModuleAccess(user, 'courses.offline', 'edit') || 
                  course.createdBy === user.id;
  if (!canEdit) {
    throw createHttpError(403, 'Bạn không có quyền cập nhật khóa học này');
  }

  if (updateBody.slug && updateBody.slug !== course.slug) {
    const existingSlug = await CourseOffline.findOne({
      slug: updateBody.slug,
      isDeleted: { $ne: true },
    });
    if (existingSlug) {
      throw createHttpError(400, 'Slug đã tồn tại');
    }
  }

  computePriceRange(updateBody);

  if (updateBody.submissionSettings) {
    updateBody.submissionSettings.lessonDeadlineHours = 0;
    updateBody.submissionSettings.chapterDeadlineHours = 0;
    updateBody.submissionSettings.courseDeadlineHours = 0;
  }

  if (updateBody.lecturers && updateBody.lecturers.length > 0) {
    const lecturerIds = updateBody.lecturers.map((l) => l.lecturerId);
    const activeLecturersCount = await CourseLecturer.countDocuments({
      id: { $in: lecturerIds },
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    });
    if (activeLecturersCount !== lecturerIds.length) {
      throw createHttpError(
        400,
        'Một hoặc nhiều giảng viên trong danh sách không tồn tại hoặc đã bị vô hiệu hóa',
      );
    }
  }

  Object.assign(course, updateBody);
  await course.save();
  return course;
};

const deleteCourse = async (id, user) => {
  const course = await CourseOffline.findOne({ id, isDeleted: { $ne: true } });
  if (!course) {
    throw createHttpError(404, 'Không tìm thấy khóa học');
  }

  // RLAC Check: Allowed if Admin/Owner OR user has explicit module access for courses OR user is Creator
  const canDelete = isOwnerOrAdmin(user) || 
                    hasExplicitModuleAccess(user, 'courses.offline', 'delete') || 
                    course.createdBy === user.id;
  if (!canDelete) {
    throw createHttpError(403, 'Bạn không có quyền xóa khóa học này');
  }

  const enrollmentCount = await CourseEnrollment.countDocuments({
    courseId: course.id,
  });
  if (enrollmentCount > 0) {
    throw createHttpError(
      400,
      `Không thể xóa khóa học đã có ${enrollmentCount} học viên tham gia`,
    );
  }

  course.isDeleted = true;
  course.deletedAt = new Date();
  await course.save();
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

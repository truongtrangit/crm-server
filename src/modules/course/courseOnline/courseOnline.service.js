const createHttpError = require('http-errors');
const { generateMonotonicId } = require('../../../core/utils/id');
const CourseOnline = require('./courseOnline.model');
const { isOwnerOrAdmin } = require('../../../core/utils/userRoles');
const {
  buildPaginatedResponse,
  resolvePagination,
} = require('../../../core/utils/pagination');
const { buildSearchRegex } = require('../../../core/utils/query');
const { computePriceRange } = require('../../../core/utils/price');
const CourseLecturer = require('../courseLecturer/courseLecturer.model');
const CourseEnrollment = require('../courseChallenge/courseEnrollment.model');
const { COURSE_ENROLLMENT_STATUS } = require('../../../core/constants/appData');
const { getVideoProvider } = require('../videoProvider');
const VideoAccessLog = require('../videoProvider/videoAccessLog.model');
const { VALID_EVENT_TYPES } = require('../videoProvider/videoAccessLog.model');

/**
 * Strip paid content from lessons for non-enrolled users.
 * Paid lessons only expose: title, duration, accessLevel, id.
 * videoUrl, attachments, description are hidden.
 */
function stripPaidLessonContent(course) {
  if (!course.curriculum) return;
  course.curriculum.forEach((chapter) => {
    if (chapter.lessons) {
      chapter.lessons.forEach((lesson) => {
        if (lesson.accessLevel === 'Paid' && !course.isEnrolled) {
          lesson.videoUrl = '';
          lesson.attachments = [];
          lesson.description = '';
        }
      });
    }
  });
}

const createCourse = async (courseBody, user) => {
  const existingSlug = await CourseOnline.findOne({ slug: courseBody.slug });
  if (existingSlug) {
    throw createHttpError(400, 'Slug đã tồn tại');
  }

  computePriceRange(courseBody);

  const id = await generateMonotonicId('CNO');
  if (courseBody.submissionSettings) {
    courseBody.submissionSettings.lessonDeadlineHours = 0;
    courseBody.submissionSettings.chapterDeadlineHours = 0;
    courseBody.submissionSettings.courseDeadlineHours = 0;
  }

  const course = new CourseOnline({
    ...courseBody,
    id,
    createdBy: user.id,
  });

  await course.save();
  return course;
};

const getCourses = async (queryParams, studentId = null) => {
  const { search, status, category } = queryParams || {};
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

  const { page, limit, skip } = resolvePagination(queryParams || {});

  const [courses, total] = await Promise.all([
    CourseOnline.find(filter)
      .select('-curriculum -description -submissionSettings')
      .populate('categoryDetails')
      .populate('lecturers.details')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    CourseOnline.countDocuments(filter),
  ]);

  if (studentId && courses.length > 0) {
    const courseIds = courses.map((c) => c.id);
    const enrollments = await CourseEnrollment.find({
      studentId,
      courseId: { $in: courseIds },
      status: COURSE_ENROLLMENT_STATUS.ACTIVE,
    }).lean();

    const activeCourseIds = new Set(
      enrollments
        .filter((e) => e.status === COURSE_ENROLLMENT_STATUS.ACTIVE)
        .map((e) => e.courseId),
    );
    const lockedCourseIds = new Set(
      enrollments
        .filter((e) => e.status !== COURSE_ENROLLMENT_STATUS.ACTIVE)
        .map((e) => e.courseId),
    );

    courses.forEach((course) => {
      course.isEnrolled = activeCourseIds.has(course.id);
      if (lockedCourseIds.has(course.id)) {
        course.isLocked = true;
      }
    });
  }

  // Strip video URLs for non-enrolled paid lessons
  courses.forEach((course) => stripPaidLessonContent(course));

  return buildPaginatedResponse(courses, total, page, limit);
};

const getCourseById = async (id) => {
  const course = await CourseOnline.findOne({ id, isDeleted: { $ne: true } })
    .populate('categoryDetails')
    .populate('lecturers.details');
  if (!course) {
    throw createHttpError(404, 'Không tìm thấy khóa học');
  }
  return course;
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

  let course = await CourseOnline.findOne(query)
    .populate('categoryDetails')
    .populate('lecturers.details')
    .lean({ virtuals: true });

  if (!course) {
    throw createHttpError(404, 'Không tìm thấy khóa học');
  }

  if (studentId) {
    const enrollment = await CourseEnrollment.findOne({
      studentId,
      courseId: course.id,
    }).lean();

    if (enrollment) {
      if (enrollment.status === 'ACTIVE') {
        course.isEnrolled = true;
        course.enrollmentId = enrollment.id;
        course.lastLessonIndex = enrollment.lastLessonIndex || 0;
      } else {
        course.isLocked = true;
      }
    }
  }

  // Strip video URLs for non-enrolled paid lessons
  stripPaidLessonContent(course);

  return course;
};

const updateCourse = async (id, updateBody, user) => {
  const course = await getCourseById(id);

  // RLAC Check: Only Admin/Owner or Creator can update
  if (!isOwnerOrAdmin(user) && course.createdBy !== user.id) {
    throw createHttpError(403, 'Bạn không có quyền cập nhật khóa học này');
  }

  if (updateBody.slug && updateBody.slug !== course.slug) {
    const existingSlug = await CourseOnline.findOne({ slug: updateBody.slug });
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

  Object.assign(course, updateBody);
  await course.save();
  return course;
};

const deleteCourse = async (id, user) => {
  const course = await getCourseById(id);

  // RLAC Check: Only Admin/Owner or Creator can delete
  if (!isOwnerOrAdmin(user) && course.createdBy !== user.id) {
    throw createHttpError(403, 'Bạn không có quyền xóa khóa học này');
  }

  course.isDeleted = true;
  course.deletedAt = new Date();
  await course.save();
  return course;
};

/**
 * Get a secure video embed URL for a specific lesson.
 * Requires authenticated + enrolled user for paid lessons.
 * Uses the configured VideoProvider (YouTube by default).
 *
 * @param {string} courseId - Course ID or slug
 * @param {string} lessonId - Lesson ID within curriculum
 * @param {string} studentId - Authenticated student ID
 * @param {object} reqMeta - { ip, userAgent } for audit logging
 * @returns {{ embedUrl: string, playerType: string }}
 */
const getLessonVideoUrl = async (
  courseId,
  lessonId,
  studentId,
  reqMeta = {},
) => {
  const course = await CourseOnline.findOne({
    $or: [{ id: courseId }, { slug: courseId }],
    isDeleted: { $ne: true },
  }).lean();

  if (!course) {
    throw createHttpError(404, 'Không tìm thấy khóa học');
  }

  // Find lesson in curriculum
  let targetLesson = null;
  for (const chapter of course.curriculum || []) {
    for (const lesson of chapter.lessons || []) {
      if (lesson.id === lessonId) {
        targetLesson = lesson;
        break;
      }
    }
    if (targetLesson) break;
  }

  if (!targetLesson) {
    throw createHttpError(404, 'Không tìm thấy bài học');
  }

  if (!targetLesson.videoUrl) {
    throw createHttpError(404, 'Bài học chưa có video');
  }

  // Paid lessons require active enrollment
  if (targetLesson.accessLevel === 'Paid') {
    const enrollment = await CourseEnrollment.findOne({
      studentId,
      courseId: course.id,
      status: COURSE_ENROLLMENT_STATUS.ACTIVE,
    }).lean();

    if (!enrollment) {
      throw createHttpError(403, 'Bạn chưa đăng ký khóa học này');
    }
  }

  // Build secure embed URL via provider abstraction
  const provider = getVideoProvider();
  const result = provider.buildEmbedUrl(targetLesson.videoUrl);

  if (!result) {
    throw createHttpError(404, 'Không thể tạo video URL');
  }

  // Audit log (fire-and-forget)
  VideoAccessLog.create({
    studentId,
    courseId: course.id,
    courseType: 'online',
    lessonId,
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  }).catch(() => {});

  return result;
};

/**
 * Log a video player event (play, pause, seek, ended).
 * Fire-and-forget — errors are silently caught.
 */
const logVideoEvent = async (
  courseId,
  lessonId,
  studentId,
  eventType,
  eventData = {},
  reqMeta = {},
) => {
  if (!VALID_EVENT_TYPES.includes(eventType)) return;

  return VideoAccessLog.create({
    studentId,
    courseId,
    courseType: 'online',
    lessonId,
    eventType,
    eventData: {
      currentTime: eventData.currentTime,
      duration: eventData.duration,
      seekFrom: eventData.seekFrom,
    },
    ip: reqMeta.ip,
    userAgent: reqMeta.userAgent,
  }).catch(() => {});
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  getCourseByIdentifier,
  updateCourse,
  deleteCourse,
  getLessonVideoUrl,
  logVideoEvent,
};

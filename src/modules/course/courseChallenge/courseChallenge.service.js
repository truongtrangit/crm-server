const createHttpError = require('http-errors');
const CourseChallenge = require('./courseChallenge.model');
const CourseEnrollment = require('./courseEnrollment.model');
const { ID_PREFIXES, generateMonotonicId } = require('../../../core/utils/id');
const {
  COURSE_CHALLENGE_TYPE,
  CHALLENGE_DAY_STATUS,
} = require('../../../core/constants/courseChallenge');
const {
  COURSE_STATUS,
  COURSE_ENROLLMENT_STATUS,
} = require('../../../core/constants/appData');
const {
  buildPaginatedResponse,
  resolvePagination,
} = require('../../../core/utils/pagination');
const { buildSearchRegex } = require('../../../core/utils/query');
const { computePriceRange } = require('../../../core/utils/price');
const env = require('../../../core/config/env');
const CourseLecturer = require('../courseLecturer/courseLecturer.model');
const { getVideoProvider } = require('../videoProvider');
const VideoAccessLog = require('../videoProvider/videoAccessLog.model');
const { VALID_EVENT_TYPES } = require('../videoProvider/videoAccessLog.model');

/**
 * Validate that the number of days matches totalDays
 */
function validateCurriculum(totalDays, curriculum) {
  if (curriculum && curriculum.length !== totalDays) {
    throw createHttpError(
      400,
      `Số lượng ngày học trong Lộ trình (${curriculum.length}) phải khớp với Tổng số ngày (${totalDays}) đã cấu hình.`,
    );
  }
}

/**
 * Assign IDs to items inside the curriculum if missing
 */
async function assignIdsToCurriculum(curriculum) {
  if (!curriculum) return [];
  for (const day of curriculum) {
    if (!day.id) {
      day.id = await generateMonotonicId(ID_PREFIXES.COURSE_CHALLENGE_DAY);
    }
  }
  return curriculum;
}

// ---------------------------------------------------------------------------
// TEMPLATES
// ---------------------------------------------------------------------------

const getTemplates = async (queryParams) => {
  const { search, category } = queryParams || {};
  const filter = { isTemplate: true, isDeleted: { $ne: true } };

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

  if (category) {
    filter.category = category.includes(',')
      ? { $in: category.split(',') }
      : category;
  }

  const { page, limit, skip } = resolvePagination(queryParams || {});

  const [templates, total] = await Promise.all([
    CourseChallenge.find(filter)
      .populate('categoryDetails')
      .populate('lecturers.details')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    CourseChallenge.countDocuments(filter),
  ]);

  return buildPaginatedResponse(templates, total, page, limit);
};

const getTemplateById = async (id) => {
  const template = await CourseChallenge.findOne({
    id,
    isTemplate: true,
    isDeleted: { $ne: true },
  })
    .populate('categoryDetails')
    .populate('lecturers.details');

  if (!template) {
    throw createHttpError(404, 'Không tìm thấy Khóa mẫu');
  }
  return template;
};
const createTemplate = async (data, user) => {
  validateCurriculum(data.totalDays, data.curriculum);
  const id = await generateMonotonicId(ID_PREFIXES.COURSE_CHALLENGE_TEMPLATE);

  if (data.curriculum) {
    data.curriculum = await assignIdsToCurriculum(data.curriculum);
  }

  if (data.lecturers && data.lecturers.length > 0) {
    const lecturerIds = data.lecturers.map((l) => l.lecturerId);
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

  computePriceRange(data);

  const template = new CourseChallenge({
    ...data,
    id,
    isTemplate: true,
    createdBy: user.id,
  });

  await template.save();
  return template;
};

const updateTemplate = async (id, data, user) => {
  const template = await CourseChallenge.findOne({
    id,
    isTemplate: true,
    isDeleted: { $ne: true },
  });
  if (!template) {
    throw createHttpError(404, 'Không tìm thấy Khóa mẫu');
  }

  // Only creator or admin/owner can update. Let's assume controller/MLAC handles basic access,
  // but we can add RLS checks here if needed based on AI_CONTEXT.

  const newTotalDays =
    data.totalDays !== undefined ? data.totalDays : template.totalDays;
  const newCurriculum =
    data.curriculum !== undefined ? data.curriculum : template.curriculum;

  validateCurriculum(newTotalDays, newCurriculum);

  if (data.curriculum) {
    data.curriculum = await assignIdsToCurriculum(data.curriculum);
  }

  if (data.lecturers && data.lecturers.length > 0) {
    const lecturerIds = data.lecturers.map((l) => l.lecturerId);
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

  computePriceRange(data);

  Object.assign(template, data);
  await template.save();
  return template;
};

const deleteTemplate = async (id) => {
  const template = await CourseChallenge.findOne({
    id,
    isTemplate: true,
    isDeleted: { $ne: true },
  });
  if (!template) {
    throw createHttpError(404, 'Không tìm thấy Khóa mẫu');
  }
  template.isDeleted = true;
  template.deletedAt = new Date();
  await template.save();
  return template;
};

// ---------------------------------------------------------------------------
// DEPLOYED COURSES
// ---------------------------------------------------------------------------

const getCourses = async (queryParams) => {
  const { search, status, category, type } = queryParams || {};
  const filter = { isTemplate: false, isDeleted: { $ne: true } };

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
  if (type) {
    filter.type = type;
  }
  if (category) {
    filter.category = category.includes(',')
      ? { $in: category.split(',') }
      : category;
  }

  const { page, limit, skip } = resolvePagination(queryParams || {});

  const [courses, total] = await Promise.all([
    CourseChallenge.find(filter)
      .populate('categoryDetails')
      .populate('lecturers.details')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    CourseChallenge.countDocuments(filter),
  ]);

  return buildPaginatedResponse(courses, total, page, limit);
};

const getCourseById = async (id) => {
  const course = await CourseChallenge.findOne({
    id,
    isTemplate: false,
    isDeleted: { $ne: true },
  })
    .populate('categoryDetails')
    .populate('lecturers.details');

  if (!course) {
    throw createHttpError(404, 'Không tìm thấy Khóa triển khai');
  }

  const courseIds = [course.id];
  const templateIds = course.templateId ? [course.templateId] : [];
  const siblingCourses = course.templateId
    ? await CourseChallenge.find(
        { templateId: course.templateId },
        { id: 1, templateId: 1 },
      ).lean()
    : [];

  const allCourseIdsToCount = new Set(courseIds);
  siblingCourses.forEach((c) => allCourseIdsToCount.add(c.id));

  const stats = await CourseEnrollment.aggregate([
    { $match: { courseId: { $in: Array.from(allCourseIdsToCount) } } },
    {
      $group: {
        _id: '$courseId',
        totalStudents: { $sum: 1 },
        activeStudents: {
          $sum: {
            $cond: [
              { $eq: ['$status', COURSE_ENROLLMENT_STATUS.ACTIVE] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const statsByCourse = stats.reduce((acc, curr) => {
    acc[curr._id] = curr;
    return acc;
  }, {});

  course.activeStudents = statsByCourse[course.id]?.activeStudents || 0;

  if (course.templateId) {
    let totalStudied = 0;
    siblingCourses.forEach((c) => {
      totalStudied += statsByCourse[c.id]?.totalStudents || 0;
    });
    course.completedStudents = totalStudied;
  } else {
    course.completedStudents = statsByCourse[course.id]?.totalStudents || 0;
  }

  return course;
};
const cloneTemplateToCourse = async (templateId, configData, user) => {
  const template = await CourseChallenge.findOne({
    id: templateId,
    isTemplate: true,
    isDeleted: { $ne: true },
  }).lean();
  if (!template) {
    throw createHttpError(404, 'Không tìm thấy Khóa mẫu');
  }

  const newId = await generateMonotonicId(ID_PREFIXES.COURSE_CHALLENGE);

  // Deep clone the curriculum and generate new IDs for days to completely decouple
  const clonedCurriculum = template.curriculum.map((day) => ({
    ...day,
    id: undefined, // will generate below
  }));
  const newCurriculum = await assignIdsToCurriculum(clonedCurriculum);

  // Enforce logic: If ROLLING, clear unlockAt
  if (configData.type === COURSE_CHALLENGE_TYPE.ROLLING) {
    newCurriculum.forEach((day) => {
      day.unlockAt = null;
    });
  }

  delete template._id;
  delete template.id;
  delete template.isTemplate;
  delete template.templateId;
  delete template.createdAt;
  delete template.updatedAt;

  computePriceRange(configData);

  if (configData.lecturers && configData.lecturers.length > 0) {
    const lecturerIds = configData.lecturers.map((l) => l.lecturerId);
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

  const deployedCourse = new CourseChallenge({
    ...template,
    ...configData, // Override with specific config (type, autoUnlockNext, etc.)
    id: newId,
    slug: `${template.slug}-${Date.now()}`, // Ensure unique slug
    isTemplate: false,
    templateId: templateId,
    curriculum: newCurriculum,
    createdBy: user.id,
  });

  await deployedCourse.save();
  return deployedCourse;
};

const updateCourse = async (id, data, user) => {
  const course = await CourseChallenge.findOne({
    id,
    isTemplate: false,
    isDeleted: { $ne: true },
  });
  if (!course) {
    throw createHttpError(404, 'Không tìm thấy Khóa triển khai');
  }

  if (course.status === COURSE_STATUS.PUBLISHED && data.startDate) {
    const oldDate = course.startDate
      ? new Date(course.startDate).getTime()
      : null;
    const newDate = new Date(data.startDate).getTime();
    if (oldDate !== newDate) {
      throw createHttpError(
        400,
        'Không thể cập nhật ngày khai giảng khi khóa học đang diễn ra.',
      );
    }
  }

  if (!env.enableCloneUpdate) {
    const lockedFields = [
      'title',
      'slug',
      'category',
      'headline',
      'subheadline',
      'isBestseller',
      'type',
      'description',
      'curriculum',
    ];
    lockedFields.forEach((field) => {
      delete data[field];
    });
  }

  const typeToCheck = data.type || course.type;

  if (data.curriculum) {
    if (data.curriculum.length !== course.totalDays) {
      // Optionally update totalDays if they submit totalDays as well
      const targetDays = data.totalDays || course.totalDays;
      validateCurriculum(targetDays, data.curriculum);
    }

    data.curriculum = await assignIdsToCurriculum(data.curriculum);

    // If rolling, strictly forbid unlockAt
    if (typeToCheck === COURSE_CHALLENGE_TYPE.ROLLING) {
      data.curriculum.forEach((day) => {
        if (day.unlockAt) {
          throw createHttpError(
            400,
            'Khóa học xoay vòng (Rolling) không được thiết lập ngày giờ cụ thể (unlockAt).',
          );
        }
      });
    }
  }

  computePriceRange(data);

  if (data.lecturers && data.lecturers.length > 0) {
    const lecturerIds = data.lecturers.map((l) => l.lecturerId);
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

  Object.assign(course, data);
  await course.save();
  return course;
};

const deleteCourse = async (id) => {
  const course = await CourseChallenge.findOne({
    id,
    isTemplate: false,
    isDeleted: { $ne: true },
  });
  if (!course) {
    throw createHttpError(404, 'Không tìm thấy Khóa triển khai');
  }
  course.isDeleted = true;
  course.deletedAt = new Date();
  await course.save();
  return course;
};

// ---------------------------------------------------------------------------
// CLIENT API (EXTERNAL)
// ---------------------------------------------------------------------------
const getMyProgress = async (courseId, studentId) => {
  const course = await CourseChallenge.findOne({
    id: courseId,
    isTemplate: false,
    isDeleted: { $ne: true },
  })
    .populate('categoryDetails')
    .populate('lecturers.details')
    .lean({ virtuals: true });

  if (!course) {
    throw createHttpError(404, 'Khóa học không tồn tại');
  }

  const enrollment = await CourseEnrollment.findOne({
    courseId,
    studentId,
  }).lean();
  if (!enrollment) {
    throw createHttpError(403, 'Bạn chưa đăng ký khóa học này');
  }

  const now = new Date();
  const enrolledAt = new Date(enrollment.enrolledAt);
  const startDate = course.startDate ? new Date(course.startDate) : enrolledAt;

  // Check progress
  const progressMap = {};
  enrollment.progress.forEach((p) => {
    progressMap[p.dayId] = p;
  });

  const isFixed = course.type === COURSE_CHALLENGE_TYPE.FIXED_DATE;

  const mappedCurriculum = course.curriculum.map((day, index) => {
    const dayProgress = progressMap[day.id] || { isCompleted: false };
    let isLocked = true;
    let unlockTimeInfo = '';
    let unlockTime = null;

    const formatUnlockTime = (date) => {
      const d = new Date(date);
      // Ensure we get local time string in a predictable format, e.g., '14:30 22/06/2026'
      const timeStr = d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const dateStr = d.toLocaleDateString('vi-VN');
      return `Mở vào ${timeStr} ${dateStr}`;
    };

    if (isFixed) {
      if (day.unlockAt) {
        unlockTime = new Date(day.unlockAt);
        unlockTimeInfo = formatUnlockTime(unlockTime);
      } else {
        unlockTime = new Date(
          startDate.getTime() + day.unlockDelayHours * 60 * 60 * 1000,
        );
        unlockTimeInfo = formatUnlockTime(unlockTime);
      }
    } else {
      // ROLLING
      unlockTime = new Date(
        enrolledAt.getTime() + day.unlockDelayHours * 60 * 60 * 1000,
      );
      unlockTimeInfo = formatUnlockTime(unlockTime);
    }

    // 1. Base locked state based on time
    isLocked = now < unlockTime;

    // 2. Allow advance submit
    if (course.submissionSettings?.allowAdvanceSubmit) {
      isLocked = false;
      unlockTimeInfo = 'Có thể xem và nộp bài trước';
    }

    // 3. Auto unlock next
    if (isLocked && course.submissionSettings?.autoUnlockNext && index > 0) {
      const prevDay = course.curriculum[index - 1];
      const prevProgress = progressMap[prevDay.id];
      if (prevProgress && prevProgress.isCompleted) {
        isLocked = false;
        unlockTimeInfo = `Đã tự động mở khóa`;
      }
    }

    // Calculate Deadline from submissionSettings (fallback to 24h for backward compat)
    const deadlineHours = course.submissionSettings?.lessonDeadlineHours ?? 24;
    let deadline =
      deadlineHours > 0
        ? new Date(unlockTime.getTime() + deadlineHours * 60 * 60 * 1000)
        : null; // null = no deadline

    let status = CHALLENGE_DAY_STATUS.LOCKED;
    let canSubmit = false;

    if (dayProgress.isCompleted) {
      status = CHALLENGE_DAY_STATUS.COMPLETED;
    } else if (!isLocked) {
      // It is unlocked
      if (deadline && now > deadline) {
        status = CHALLENGE_DAY_STATUS.OVERDUE;
        canSubmit = course.submissionSettings?.allowLateSubmission ?? false;
      } else {
        status = CHALLENGE_DAY_STATUS.OPEN;
        canSubmit = true;
      }
    }

    return {
      id: day.id,
      title: day.title,
      lessons: day.lessons, // Assuming we send lessons. Usually we don't send videoUrl if locked
      isLocked,
      canSubmit,
      status,
      deadline,
      unlockTimeInfo,
      progress: dayProgress,
    };
  });

  return {
    courseInfo: course,
    enrollment: enrollment,
    timeline: mappedCurriculum,
  };
};

const submitDayAssignment = async (
  courseId,
  dayId,
  submissionData,
  studentId,
) => {
  const course = await CourseChallenge.findOne({
    id: courseId,
    isTemplate: false,
    isDeleted: { $ne: true },
  }).lean();
  if (!course) throw createHttpError(404, 'Khóa học không tồn tại');

  let enrollment = await CourseEnrollment.findOne({ courseId, studentId });
  if (!enrollment) throw createHttpError(403, 'Bạn chưa đăng ký khóa học này');

  // Check if the day exists and is unlocked
  const { timeline } = await getMyProgress(courseId, studentId);
  const dayData = timeline.find((d) => d.id === dayId);

  if (!dayData) throw createHttpError(404, 'Ngày học không tồn tại');
  if (dayData.isLocked)
    throw createHttpError(403, 'Ngày học này đang bị khóa, chưa thể nộp bài');
  if (!dayData.canSubmit) throw createHttpError(403, 'Đã quá hạn nộp bài');

  // Add or update progress
  const existingProgressIndex = enrollment.progress.findIndex(
    (p) => p.dayId === dayId,
  );
  const progressItem = {
    dayId: dayId,
    isCompleted: true,
    submissionUrl: submissionData.submissionUrl || '',
    submissionText: submissionData.submissionText || '',
    submittedAt: new Date(),
  };

  if (existingProgressIndex > -1) {
    enrollment.progress[existingProgressIndex] = progressItem;
  } else {
    enrollment.progress.push(progressItem);
  }

  await enrollment.save();
  return progressItem;
};

const getPublicCourses = async (queryParams, studentId = null) => {
  const { page, limit, skip } = resolvePagination(queryParams || {});
  const filter = {
    isTemplate: false,
    isDeleted: { $ne: true },
    status: COURSE_STATUS.PUBLISHED,
  };

  const [courses, total] = await Promise.all([
    CourseChallenge.find(filter)
      .populate('categoryDetails')
      .populate('lecturers.details')
      .sort({ isBestseller: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    CourseChallenge.countDocuments(filter),
  ]);

  // Strip curriculum to day titles only (for "Nội dung sơ lược" in list view)
  courses.forEach((course) => {
    if (course.curriculum) {
      course.curriculum = course.curriculum.map((day) => ({
        title: day.title,
      }));
    }
  });

  if (studentId && courses.length > 0) {
    const courseIds = courses.map((c) => c.id);
    const enrollments = await CourseEnrollment.find({
      studentId,
      courseId: { $in: courseIds },
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
      if (activeCourseIds.has(course.id)) {
        course.isEnrolled = true;
      } else if (lockedCourseIds.has(course.id)) {
        course.isLocked = true;
      }
    });
  }

  if (courses.length > 0) {
    const courseIds = courses.map((c) => c.id);
    const templateIds = courses.map((c) => c.templateId).filter(Boolean);

    const siblingCourses = await CourseChallenge.find(
      { templateId: { $in: templateIds } },
      { id: 1, templateId: 1 },
    ).lean();

    const allCourseIdsToCount = new Set(courseIds);
    siblingCourses.forEach((c) => allCourseIdsToCount.add(c.id));

    const stats = await CourseEnrollment.aggregate([
      { $match: { courseId: { $in: Array.from(allCourseIdsToCount) } } },
      {
        $group: {
          _id: '$courseId',
          totalStudents: { $sum: 1 },
          activeStudents: {
            $sum: {
              $cond: [
                { $eq: ['$status', COURSE_ENROLLMENT_STATUS.ACTIVE] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const statsByCourse = stats.reduce((acc, curr) => {
      acc[curr._id] = curr;
      return acc;
    }, {});

    const statsByTemplate = {};
    siblingCourses.forEach((c) => {
      if (!statsByTemplate[c.templateId]) statsByTemplate[c.templateId] = 0;
      statsByTemplate[c.templateId] += statsByCourse[c.id]?.totalStudents || 0;
    });

    courses.forEach((course) => {
      course.activeStudents = statsByCourse[course.id]?.activeStudents || 0;
      if (course.templateId) {
        course.completedStudents = statsByTemplate[course.templateId] || 0;
      } else {
        course.completedStudents = statsByCourse[course.id]?.totalStudents || 0;
      }
    });
  }

  return buildPaginatedResponse(courses, total, page, limit);
};

const getPublicCourseBySlug = async (slug, studentId = null) => {
  const course = await CourseChallenge.findOne({
    slug,
    isTemplate: false,
    isDeleted: { $ne: true },
    status: COURSE_STATUS.PUBLISHED,
  })
    .populate('categoryDetails')
    .populate('lecturers.details')
    .lean({ virtuals: true });

  if (!course) {
    throw createHttpError(404, 'Không tìm thấy khóa học');
  }

  let isEnrolled = false;
  if (studentId) {
    const enrollment = await CourseEnrollment.findOne({
      courseId: course.id,
      studentId,
    });
    if (enrollment) {
      if (enrollment.status === COURSE_ENROLLMENT_STATUS.ACTIVE) {
        isEnrolled = true;
        course.isEnrolled = true;
        course.enrollmentId = enrollment.id;
        const progressData = await module.exports.getMyProgress(
          course.id,
          studentId,
        );
        course.curriculum = progressData.timeline;
      } else {
        course.isLocked = true;
      }
    }
  }

  // Hide paid content for locked lessons
  if (course.curriculum) {
    course.curriculum.forEach((day) => {
      const isLocked = isEnrolled
        ? day.isLocked !== undefined
          ? day.isLocked
          : true
        : true;

      if (day.lessons) {
        day.lessons.forEach((lesson) => {
          if (lesson.accessLevel === 'Paid' && isLocked) {
            lesson.videoUrl = '';
            lesson.attachments = [];
            lesson.description = '';
          }
        });
      }

      if (day.accessLevel === 'Paid' && isLocked) {
        day.videoUrl = '';
        day.description = '';
        day.attachments = [];
      }
    });
  }

  return course;
};
/**
 * Get a secure video embed URL for a specific challenge lesson.
 * Handles day-based access: checks enrollment + day lock status.
 *
 * @param {string} courseId - Course ID or slug
 * @param {string} lessonId - Lesson ID within a day
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
  const course = await CourseChallenge.findOne({
    $or: [{ id: courseId }, { slug: courseId }],
    isTemplate: false,
    isDeleted: { $ne: true },
  }).lean();

  if (!course) {
    throw createHttpError(404, 'Không tìm thấy khóa học');
  }

  // Find lesson in curriculum days
  let targetLesson = null;
  let targetDay = null;
  for (const day of course.curriculum || []) {
    // Check if lesson is at the day level (day.videoUrl)
    if (day.id === lessonId && day.videoUrl) {
      targetLesson = day;
      targetDay = day;
      break;
    }
    // Check lessons within a day
    for (const lesson of day.lessons || []) {
      if (lesson.id === lessonId) {
        targetLesson = lesson;
        targetDay = day;
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

  // Free lessons → return immediately
  const accessLevel = targetLesson.accessLevel || targetDay?.accessLevel;
  if (accessLevel === 'Free') {
    const provider = getVideoProvider();
    const result = provider.buildEmbedUrl(targetLesson.videoUrl);
    if (!result) throw createHttpError(404, 'Không thể tạo video URL');
    return result;
  }

  // Paid lessons → verify enrollment
  const enrollment = await CourseEnrollment.findOne({
    studentId,
    courseId: course.id,
    status: COURSE_ENROLLMENT_STATUS.ACTIVE,
  }).lean();

  if (!enrollment) {
    throw createHttpError(403, 'Bạn chưa đăng ký khóa học này');
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
    courseType: 'challenge',
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
    courseType: 'challenge',
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
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,

  getCourses,
  getCourseById,
  cloneTemplateToCourse,
  updateCourse,
  deleteCourse,

  getMyProgress,
  submitDayAssignment,

  getPublicCourses,
  getPublicCourseBySlug,
  getLessonVideoUrl,
  logVideoEvent,
};

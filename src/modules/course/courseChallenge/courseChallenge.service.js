const createHttpError = require("http-errors");
const CourseChallenge = require("./courseChallenge.model");
const ChallengeEnrollment = require("./challengeEnrollment.model");
const { ID_PREFIXES, generateMonotonicId } = require("../../../core/utils/id");
const { COURSE_CHALLENGE_TYPE, COURSE_CHALLENGE_STATUS } = require("../../../core/constants/courseChallenge");
const { buildPaginatedResponse, resolvePagination } = require('../../../core/utils/pagination');
const { buildSearchRegex } = require('../../../core/utils/query');
const CourseLecturer = require('../courseLecturer/courseLecturer.model');


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
      const matchingLecturers = await CourseLecturer.find({ name: searchRegex }, { id: 1 }).lean();
      const lecturerIds = matchingLecturers.map(l => l.id);

      filter.$or = [
        { title: searchRegex }
      ];

      if (lecturerIds.length > 0) {
        filter.$or.push({ 'lecturers.lecturerId': { $in: lecturerIds } });
      }
    }
  }

  if (category) {
    filter.category = category.includes(',') ? { $in: category.split(',') } : category;
  }

  const { page, limit, skip } = resolvePagination(queryParams || {});

  const [templates, total] = await Promise.all([
    CourseChallenge.find(filter)
      .populate("categoryDetails")
      .populate("lecturers.details")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    CourseChallenge.countDocuments(filter)
  ]);

  return buildPaginatedResponse(templates, total, page, limit);
};

const getTemplateById = async (id) => {
  const template = await CourseChallenge.findOne({ id, isTemplate: true, isDeleted: { $ne: true } })
    .populate("categoryDetails")
    .populate("lecturers.details");
    
  if (!template) {
    throw createHttpError(404, "Không tìm thấy Khóa mẫu");
  }
  return template;
};
const createTemplate = async (data, user) => {
    validateCurriculum(data.totalDays, data.curriculum);
    const id = await generateMonotonicId(ID_PREFIXES.COURSE_CHALLENGE_TEMPLATE);
    
    if (data.curriculum) {
      data.curriculum = await assignIdsToCurriculum(data.curriculum);
    }

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
    const template = await CourseChallenge.findOne({ id, isTemplate: true, isDeleted: { $ne: true } });
    if (!template) {
      throw createHttpError(404, "Không tìm thấy Khóa mẫu");
    }

    // Only creator or admin/owner can update. Let's assume controller/MLAC handles basic access, 
    // but we can add RLS checks here if needed based on AI_CONTEXT.
    
    const newTotalDays = data.totalDays !== undefined ? data.totalDays : template.totalDays;
    const newCurriculum = data.curriculum !== undefined ? data.curriculum : template.curriculum;
    
    validateCurriculum(newTotalDays, newCurriculum);

    if (data.curriculum) {
      data.curriculum = await assignIdsToCurriculum(data.curriculum);
    }

    Object.assign(template, data);
    await template.save();
    return template;
  };

const deleteTemplate = async (id) => {
    const template = await CourseChallenge.findOne({ id, isTemplate: true, isDeleted: { $ne: true } });
    if (!template) {
      throw createHttpError(404, "Không tìm thấy Khóa mẫu");
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
      const matchingLecturers = await CourseLecturer.find({ name: searchRegex }, { id: 1 }).lean();
      const lecturerIds = matchingLecturers.map(l => l.id);

      filter.$or = [
        { title: searchRegex }
      ];

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
    filter.category = category.includes(',') ? { $in: category.split(',') } : category;
  }

  const { page, limit, skip } = resolvePagination(queryParams || {});

  const [courses, total] = await Promise.all([
    CourseChallenge.find(filter)
      .populate("categoryDetails")
      .populate("lecturers.details")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    CourseChallenge.countDocuments(filter)
  ]);

  return buildPaginatedResponse(courses, total, page, limit);
};

const getCourseById = async (id) => {
  const course = await CourseChallenge.findOne({ id, isTemplate: false, isDeleted: { $ne: true } })
    .populate("categoryDetails")
    .populate("lecturers.details");
    
  if (!course) {
    throw createHttpError(404, "Không tìm thấy Khóa triển khai");
  }
  return course;
};
const cloneTemplateToCourse = async (templateId, configData, user) => {
    const template = await CourseChallenge.findOne({ id: templateId, isTemplate: true, isDeleted: { $ne: true } }).lean();
    if (!template) {
      throw createHttpError(404, "Không tìm thấy Khóa mẫu");
    }

    const newId = await generateMonotonicId(ID_PREFIXES.COURSE_CHALLENGE);

    // Deep clone the curriculum and generate new IDs for days to completely decouple
    const clonedCurriculum = template.curriculum.map(day => ({
      ...day,
      id: undefined, // will generate below
    }));
    const newCurriculum = await assignIdsToCurriculum(clonedCurriculum);

    // Enforce logic: If ROLLING, clear unlockAt
    if (configData.type === COURSE_CHALLENGE_TYPE.ROLLING) {
      newCurriculum.forEach(day => {
        day.unlockAt = null;
      });
    }

    delete template._id;
    delete template.id;
    delete template.isTemplate;
    delete template.templateId;
    delete template.createdAt;
    delete template.updatedAt;

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
    const course = await CourseChallenge.findOne({ id, isTemplate: false, isDeleted: { $ne: true } });
    if (!course) {
      throw createHttpError(404, "Không tìm thấy Khóa triển khai");
    }

    if (course.status === COURSE_CHALLENGE_STATUS.ACTIVE && data.startDate) {
      const oldDate = course.startDate ? new Date(course.startDate).getTime() : null;
      const newDate = new Date(data.startDate).getTime();
      if (oldDate !== newDate) {
        throw createHttpError(400, "Không thể cập nhật ngày khai giảng khi khóa học đang diễn ra.");
      }
    }

    if (process.env.ENABLE_CLONE_UPDATE !== 'true') {
      const lockedFields = ['title', 'slug', 'category', 'headline', 'subheadline', 'isBestseller', 'type', 'description', 'curriculum'];
      lockedFields.forEach(field => {
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
        data.curriculum.forEach(day => {
          if (day.unlockAt) {
            throw createHttpError(400, "Khóa học xoay vòng (Rolling) không được thiết lập ngày giờ cụ thể (unlockAt).");
          }
        });
      }
    }

    Object.assign(course, data);
    await course.save();
    return course;
  };

const deleteCourse = async (id) => {
  const course = await CourseChallenge.findOne({ id, isTemplate: false, isDeleted: { $ne: true } });
  if (!course) {
    throw createHttpError(404, "Không tìm thấy Khóa triển khai");
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
    const course = await CourseChallenge.findOne({ id: courseId, isTemplate: false, isDeleted: { $ne: true } })
      .populate("categoryDetails")
      .populate("lecturers.details")
      .lean({ virtuals: true });
      
    if (!course) {
      throw createHttpError(404, "Khóa học không tồn tại");
    }

    const enrollment = await ChallengeEnrollment.findOne({ courseId, studentId }).lean();
    if (!enrollment) {
      throw createHttpError(403, "Bạn chưa đăng ký khóa học này");
    }

    const now = new Date();
    const enrolledAt = new Date(enrollment.enrolledAt);
    const startDate = course.startDate ? new Date(course.startDate) : enrolledAt;
    
    // Check progress
    const progressMap = {};
    enrollment.progress.forEach(p => {
      progressMap[p.dayId] = p;
    });

    const isFixed = course.type === COURSE_CHALLENGE_TYPE.FIXED_DATE;

    const mappedCurriculum = course.curriculum.map((day, index) => {
      const dayProgress = progressMap[day.id] || { isCompleted: false };
      let isLocked = true;
      let unlockTimeInfo = "";

      if (isFixed) {
        if (day.unlockAt) {
          const unlockTime = new Date(day.unlockAt);
          isLocked = now < unlockTime;
          unlockTimeInfo = `Mở vào lúc ${unlockTime.toLocaleString()}`;
        } else {
          const unlockTime = new Date(startDate.getTime() + day.unlockDelayHours * 60 * 60 * 1000);
          isLocked = now < unlockTime;
          unlockTimeInfo = `Mở sau ${day.unlockDelayHours} giờ từ lúc khai giảng`;
        }
      } else {
        // ROLLING
        const unlockTime = new Date(enrolledAt.getTime() + day.unlockDelayHours * 60 * 60 * 1000);
        isLocked = now < unlockTime;
        unlockTimeInfo = `Mở sau ${day.unlockDelayHours} giờ`;

        // Auto unlock next logic
        if (isLocked && course.autoUnlockNext && index > 0) {
          const prevDay = course.curriculum[index - 1];
          const prevProgress = progressMap[prevDay.id];
          if (prevProgress && prevProgress.isCompleted) {
            isLocked = false;
            unlockTimeInfo = `Đã tự động mở khóa`;
          }
        }
      }

      // If it's unlocked, let's also check if it's past due and late submissions aren't allowed
      let canSubmit = !isLocked;
      if (isFixed && !course.allowLateSubmission && canSubmit) {
         // Logic for strict mode late submission could be added here if there's a deadline per day
         // E.g., if there's a deadline, we check if now > deadline -> canSubmit = false
      }

      return {
        id: day.id,
        title: day.title,
        lessons: day.lessons, // Assuming we send lessons. Usually we don't send videoUrl if locked
        isLocked,
        canSubmit,
        unlockTimeInfo,
        progress: dayProgress
      };
    });

    return {
      courseInfo: course,
      enrollment: enrollment,
      timeline: mappedCurriculum
    };
  };

const submitDayAssignment = async (courseId, dayId, submissionData, studentId) => {
    const course = await CourseChallenge.findOne({ id: courseId, isTemplate: false, isDeleted: { $ne: true } }).lean();
    if (!course) throw createHttpError(404, "Khóa học không tồn tại");

    let enrollment = await ChallengeEnrollment.findOne({ courseId, studentId });
    if (!enrollment) throw createHttpError(403, "Bạn chưa đăng ký khóa học này");

    // Check if the day exists and is unlocked
    const { timeline } = await getMyProgress(courseId, studentId);
    const dayData = timeline.find(d => d.id === dayId);

    if (!dayData) throw createHttpError(404, "Ngày học không tồn tại");
    if (dayData.isLocked) throw createHttpError(403, "Ngày học này đang bị khóa, chưa thể nộp bài");
    if (!dayData.canSubmit) throw createHttpError(403, "Đã quá hạn nộp bài");

    // Add or update progress
    const existingProgressIndex = enrollment.progress.findIndex(p => p.dayId === dayId);
    const progressItem = {
      dayId: dayId,
      isCompleted: true,
      submissionUrl: submissionData.submissionUrl || "",
      submissionText: submissionData.submissionText || "",
      submittedAt: new Date()
    };

    if (existingProgressIndex > -1) {
      enrollment.progress[existingProgressIndex] = progressItem;
    } else {
      enrollment.progress.push(progressItem);
    }

    await enrollment.save();
    return progressItem;
  };

const getPublicCourses = async (queryParams) => {
  const { page, limit, skip } = resolvePagination(queryParams || {});
  const filter = { isTemplate: false, isDeleted: { $ne: true }, status: COURSE_CHALLENGE_STATUS.ACTIVE };

  const [courses, total] = await Promise.all([
    CourseChallenge.find(filter)
      .populate("categoryDetails")
      .populate("lecturers.details")
      .sort({ isBestseller: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    CourseChallenge.countDocuments(filter)
  ]);

  return buildPaginatedResponse(courses, total, page, limit);
};

const getPublicCourseBySlug = async (slug) => {
  const course = await CourseChallenge.findOne({ slug, isTemplate: false, isDeleted: { $ne: true }, status: COURSE_CHALLENGE_STATUS.ACTIVE })
    .populate("categoryDetails")
    .populate("lecturers.details")
    .lean({ virtuals: true });
    
  if (!course) {
    throw createHttpError(404, "Không tìm thấy khóa học");
  }

  // Hide paid video URLs
  if (course.curriculum) {
    course.curriculum.forEach(day => {
      if (day.lessons) {
        day.lessons.forEach(lesson => {
          if (lesson.accessLevel === "Paid") {
            lesson.videoUrl = "";
          }
        });
      }
    });
  }

  return course;
};

const enrollCourse = async (courseId, studentId) => {
  const course = await CourseChallenge.findOne({ id: courseId, isTemplate: false, isDeleted: { $ne: true }, status: COURSE_CHALLENGE_STATUS.ACTIVE });
  if (!course) {
    throw createHttpError(404, "Khóa học không tồn tại hoặc chưa được kích hoạt");
  }

  let enrollment = await ChallengeEnrollment.findOne({ courseId, studentId });
  if (enrollment) {
    throw createHttpError(400, "Bạn đã đăng ký khóa học này rồi");
  }

  const newId = await generateMonotonicId(ID_PREFIXES.COURSE_CHALLENGE_ENROLLMENT);

  enrollment = new ChallengeEnrollment({
    id: newId,
    courseId,
    studentId,
    enrolledAt: new Date(),
    progress: []
  });

  await enrollment.save();
  return enrollment;
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
  enrollCourse,
};

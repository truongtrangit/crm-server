const Joi = require("joi");
const { COURSE_CHALLENGE_STATUS, COURSE_CHALLENGE_TYPE } = require("../../../core/constants/courseChallenge");

const lessonSchema = Joi.object({
  id: Joi.string().optional(),
  title: Joi.string().required(),
  duration: Joi.number().min(0).optional(),
  accessLevel: Joi.string().valid("Free", "Paid").optional(),
  videoUrl: Joi.string().allow("").optional(),
  attachments: Joi.array().items(
    Joi.object({
      name: Joi.string().optional(),
      url: Joi.string().optional(),
    })
  ).optional(),
  description: Joi.string().allow("").optional(),
});

const challengeDaySchema = Joi.object({
  id: Joi.string().optional(),
  title: Joi.string().required(),
  lessons: Joi.array().items(lessonSchema).optional(),
  unlockDelayHours: Joi.number().min(0).optional(),
  unlockAt: Joi.date().allow(null).optional(),
});

const createTemplate = Joi.object({
  title: Joi.string().required(),
  slug: Joi.string().required(),
  category: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid(...Object.values(COURSE_CHALLENGE_STATUS)).optional(),
  isBestseller: Joi.boolean().optional(),
  headline: Joi.string().allow("").optional(),
  subheadline: Joi.string().allow("").optional(),
  price: Joi.number().min(0).optional(),
  originalPrice: Joi.number().min(0).optional(),
  discountRate: Joi.number().min(0).optional(),
  covers: Joi.array().items(Joi.string()).optional(),
  previewVideo: Joi.array().items(Joi.string()).optional(),
  benefits: Joi.array().items(Joi.string()).optional(),
  tools: Joi.array().items(Joi.string()).optional(),
  requirements: Joi.array().items(Joi.string()).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  targetAudience: Joi.string().allow("").optional(),
  description: Joi.string().allow("").optional(),
  lecturers: Joi.array().items(
    Joi.object({
      lecturerId: Joi.string().required(),
      isMain: Joi.boolean().optional(),
    }).unknown(true)
  ).optional(),
  totalDays: Joi.number().min(1).required(),
  curriculum: Joi.array().items(challengeDaySchema).optional(),
});

const updateTemplate = createTemplate.fork(['title', 'slug', 'totalDays'], schema => schema.optional());

const cloneCourse = Joi.object({
  type: Joi.string().valid(...Object.values(COURSE_CHALLENGE_TYPE)).required(),
  startDate: Joi.date().when('type', {
    is: COURSE_CHALLENGE_TYPE.FIXED_DATE,
    then: Joi.required(),
    otherwise: Joi.optional().allow(null)
  }),
  allowAdvanceSubmit: Joi.boolean().optional(),
  allowLateSubmission: Joi.boolean().optional(),
  autoUnlockNext: Joi.boolean().optional(),
});

const updateCourse = Joi.object({
  title: Joi.string().optional(),
  slug: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(COURSE_CHALLENGE_STATUS)).optional(),
  type: Joi.forbidden(),
  startDate: Joi.date().allow(null).optional(),
  allowAdvanceSubmit: Joi.boolean().optional(),
  allowLateSubmission: Joi.boolean().optional(),
  autoUnlockNext: Joi.boolean().optional(),
  totalDays: Joi.number().min(1).optional(),
  curriculum: Joi.array().items(challengeDaySchema).optional(),
  // Add other basic fields as needed
  price: Joi.number().min(0).optional(),
  covers: Joi.array().items(Joi.string()).optional(),
});

const submitAssignment = Joi.object({
  submissionUrl: Joi.string().allow("").optional(),
  submissionText: Joi.string().allow("").optional(),
  studentId: Joi.string().optional(), // For internal mocking or if not from req.user
});

module.exports = {
  createTemplate,
  updateTemplate,
  cloneCourse,
  updateCourse,
  submitAssignment
};

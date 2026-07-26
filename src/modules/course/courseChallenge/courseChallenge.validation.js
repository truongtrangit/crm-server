const Joi = require('joi');
const {
  COURSE_CHALLENGE_TYPE,
} = require('../../../core/constants/courseChallenge');
const {
  COURSE_STATUS,
  PAYMENT_METHODS,
  LESSON_ACCESS_LEVEL,
} = require('../../../core/constants/appData');
const {
  submissionSettingsSchema,
} = require('../courseSubmission/courseSubmission.validation');

const pricingPackageSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  price: Joi.number().min(0).required(),
  originalPrice: Joi.number().min(0).default(0),
  discountRate: Joi.number().min(0).max(100).default(0),
  paymentTypes: Joi.array()
    .items(Joi.string().valid(...Object.values(PAYMENT_METHODS)))
    .default([PAYMENT_METHODS.MAIN_CREDIT]),
  gifts: Joi.array().items(Joi.string()).default([]),
  hasRefundPolicy: Joi.boolean().default(false),
}).custom((value, helpers) => {
  if (value.originalPrice > 0 && value.price > value.originalPrice) {
    return helpers.message('Giá bán thực tế không được lớn hơn giá trước giảm');
  }
  return value;
});

const lessonSchema = Joi.object({
  id: Joi.string().optional(),
  title: Joi.string().required(),
  duration: Joi.number().min(0).optional(),
  accessLevel: Joi.string()
    .valid(...Object.values(LESSON_ACCESS_LEVEL))
    .optional(),
  videoUrl: Joi.string().allow('').optional(),
  attachments: Joi.array().items(
    Joi.object({
      name: Joi.string().optional(),
      url: Joi.string().optional(),
    }),
  ),
  description: Joi.string().allow('').optional(),
  isSubmissionRequired: Joi.boolean().default(false),
});

const challengeDaySchema = Joi.object({
  id: Joi.string().optional(),
  title: Joi.string().required(),
  lessons: Joi.array().items(lessonSchema).optional(),
  unlockDelayHours: Joi.number().min(0).optional(),
  unlockAt: Joi.date().allow(null).optional(),
  isSubmissionRequired: Joi.boolean().default(false),
});

const createTemplate = Joi.object({
  title: Joi.string().required(),
  slug: Joi.string().required(),
  category: Joi.array().items(Joi.string()).optional(),
  status: Joi.string()
    .valid(...Object.values(COURSE_STATUS))
    .optional(),
  isBestseller: Joi.boolean().optional(),
  headline: Joi.string().allow('').optional(),
  subheadline: Joi.string().allow('').optional(),
  packages: Joi.array().items(pricingPackageSchema).default([]),
  covers: Joi.array().items(Joi.string()).optional(),
  previewVideo: Joi.array().items(Joi.string()).optional(),
  benefits: Joi.array().items(Joi.string()).optional(),
  tools: Joi.array().items(Joi.string()).optional(),
  requirements: Joi.array().items(Joi.string()).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  targetAudience: Joi.string().allow('').optional(),
  description: Joi.string().allow('').optional(),
  lecturers: Joi.array()
    .items(
      Joi.object({
        lecturerId: Joi.string().required(),
        isMain: Joi.boolean().optional(),
      }).unknown(true),
    )
    .optional(),
  totalDays: Joi.number().min(1).required(),
  curriculum: Joi.array().items(challengeDaySchema).optional(),
  submissionSettings: submissionSettingsSchema,
});

const updateTemplate = createTemplate.fork(
  ['title', 'slug', 'totalDays'],
  (schema) => schema.optional(),
);

const cloneCourse = Joi.object({
  type: Joi.string()
    .valid(...Object.values(COURSE_CHALLENGE_TYPE))
    .required(),
  startDate: Joi.date().when('type', {
    is: COURSE_CHALLENGE_TYPE.FIXED_DATE,
    then: Joi.required(),
    otherwise: Joi.optional().allow(null),
  }),
  packages: Joi.array().items(pricingPackageSchema).optional(),
  submissionSettings: submissionSettingsSchema,
});

const updateCourse = Joi.object({
  title: Joi.string().optional(),
  slug: Joi.string().optional(),
  category: Joi.array().items(Joi.string()).optional(),
  status: Joi.string()
    .valid(...Object.values(COURSE_STATUS))
    .optional(),
  type: Joi.forbidden(),
  isBestseller: Joi.boolean().optional(),
  headline: Joi.string().allow('').optional(),
  subheadline: Joi.string().allow('').optional(),
  startDate: Joi.date().allow(null).optional(),
  totalDays: Joi.number().min(1).optional(),
  curriculum: Joi.array().items(challengeDaySchema).optional(),
  packages: Joi.array().items(pricingPackageSchema).optional(),
  covers: Joi.array().items(Joi.string()).optional(),
  previewVideo: Joi.array().items(Joi.string()).optional(),
  benefits: Joi.array().items(Joi.string()).optional(),
  tools: Joi.array().items(Joi.string()).optional(),
  requirements: Joi.array().items(Joi.string()).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  targetAudience: Joi.string().allow('').optional(),
  description: Joi.string().allow('').optional(),
  lecturers: Joi.array()
    .items(
      Joi.object({
        lecturerId: Joi.string().required(),
        isMain: Joi.boolean().optional(),
      }).unknown(true),
    )
    .optional(),
  submissionSettings: submissionSettingsSchema,
});

const submitAssignment = Joi.object({
  submissionUrl: Joi.string().allow('').optional(),
  submissionText: Joi.string().allow('').optional(),
  studentId: Joi.string().optional(), // For internal mocking or if not from req.user
});

module.exports = {
  createTemplate,
  updateTemplate,
  cloneCourse,
  updateCourse,
  submitAssignment,
};

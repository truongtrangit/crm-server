const Joi = require("joi");

const pricingPackageSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  price: Joi.number().min(0).required(),
  originalPrice: Joi.number().min(0).default(0),
  discountRate: Joi.number().min(0).max(100).default(0),
  paymentTypes: Joi.array().items(Joi.string().valid('credit', 'rewardCredit')).default(['credit']),
  gifts: Joi.array().items(Joi.string()).default([]),
  hasRefundPolicy: Joi.boolean().default(false)
});

const lecturerSchema = Joi.object({
  lecturerId: Joi.string().required(),
  isMain: Joi.boolean().default(false),
}).unknown(true);

const lessonAttachmentSchema = Joi.object({
  name: Joi.string().allow("", null),
  url: Joi.string().allow("", null),
});

const lessonSchema = Joi.object({
  id: Joi.string().allow("", null),
  title: Joi.string().required(),
  duration: Joi.number().min(0).default(0),
  accessLevel: Joi.string().valid("Free", "Paid").default("Paid"),
  videoUrl: Joi.string().allow("", null),
  attachments: Joi.array().items(lessonAttachmentSchema).default([]),
  description: Joi.string().allow("", null),
});

const chapterSchema = Joi.object({
  id: Joi.string().allow("", null),
  title: Joi.string().required(),
  lessons: Joi.array().items(lessonSchema).default([]),
});

const createCourseOffline = Joi.object({
  title: Joi.string().required(),
  slug: Joi.string().required(),
  category: Joi.array().items(Joi.string()).default([]),
  status: Joi.string()
    .valid("draft", "published", "private", "expired")
    .default("draft"),
  type: Joi.string().valid("offline").default("offline"),
  isBestseller: Joi.boolean().default(false),
  headline: Joi.string().allow("", null),
  subheadline: Joi.string().allow("", null),
  packages: Joi.array().items(pricingPackageSchema).default([]),
  covers: Joi.array().items(Joi.string()).default([]),
  previewVideo: Joi.array().items(Joi.string()).default([]),
  benefits: Joi.array().items(Joi.string()).default([]),
  tools: Joi.array().items(Joi.string()).default([]),
  requirements: Joi.array().items(Joi.string()).default([]),
  hashtags: Joi.array().items(Joi.string()).default([]),
  targetAudience: Joi.string().allow("", null),
  description: Joi.string().allow("", null),
  location: Joi.string().allow("", null),
  address: Joi.string().allow("", null),
  startDate: Joi.date().allow(null),
  registrationDeadline: Joi.date().allow(null),
  schedule: Joi.string().allow("", null),
  maxStudents: Joi.number().min(0).default(0),
  lecturers: Joi.array().items(lecturerSchema).default([]),
  curriculum: Joi.array().items(chapterSchema).default([]),
});

const updateCourseOffline = Joi.object({
  title: Joi.string(),
  slug: Joi.string(),
  category: Joi.array().items(Joi.string()),
  status: Joi.string().valid("draft", "published", "private", "expired"),
  type: Joi.string().valid("offline"),
  isBestseller: Joi.boolean(),
  headline: Joi.string().allow("", null),
  subheadline: Joi.string().allow("", null),
  packages: Joi.array().items(pricingPackageSchema),
  covers: Joi.array().items(Joi.string()),
  previewVideo: Joi.array().items(Joi.string()),
  benefits: Joi.array().items(Joi.string()),
  tools: Joi.array().items(Joi.string()),
  requirements: Joi.array().items(Joi.string()),
  hashtags: Joi.array().items(Joi.string()),
  targetAudience: Joi.string().allow("", null),
  description: Joi.string().allow("", null),
  location: Joi.string().allow("", null),
  address: Joi.string().allow("", null),
  startDate: Joi.date().allow(null),
  registrationDeadline: Joi.date().allow(null),
  schedule: Joi.string().allow("", null),
  maxStudents: Joi.number().min(0),
  lecturers: Joi.array().items(lecturerSchema),
  curriculum: Joi.array().items(chapterSchema),
});

module.exports = {
  createCourseOffline,
  updateCourseOffline,
};

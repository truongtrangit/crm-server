const Joi = require("joi");

const lecturerSchema = Joi.object({
  lecturerId: Joi.string().required(),
  isMain: Joi.boolean().default(false),
});

const createCourseOnline = Joi.object({
  title: Joi.string().required(),
  slug: Joi.string().required(),
  category: Joi.array().items(Joi.string()).default([]),
  status: Joi.string()
    .valid("draft", "published", "private", "expired")
    .default("draft"),
  type: Joi.string().valid("online").default("online"),
  isBestseller: Joi.boolean().default(false),
  headline: Joi.string().allow("", null),
  subheadline: Joi.string().allow("", null),
  price: Joi.number().min(0).default(0),
  originalPrice: Joi.number().min(0).default(0),
  discountRate: Joi.number().min(0).max(100).default(0),
  covers: Joi.array().items(Joi.string()).default([]),
  previewVideo: Joi.array().items(Joi.string()).default([]),
  benefits: Joi.array().items(Joi.string()).default([]),
  tools: Joi.array().items(Joi.string()).default([]),
  requirements: Joi.array().items(Joi.string()).default([]),
  tags: Joi.array().items(Joi.string()).default([]),
  targetAudience: Joi.string().allow("", null),
  description: Joi.string().allow("", null),
  lecturers: Joi.array().items(lecturerSchema).default([]),
});

const updateCourseOnline = Joi.object({
  title: Joi.string(),
  slug: Joi.string(),
  category: Joi.array().items(Joi.string()),
  status: Joi.string().valid("draft", "published", "private", "expired"),
  type: Joi.string().valid("online"),
  isBestseller: Joi.boolean(),
  headline: Joi.string().allow("", null),
  subheadline: Joi.string().allow("", null),
  price: Joi.number().min(0),
  originalPrice: Joi.number().min(0),
  discountRate: Joi.number().min(0).max(100),
  covers: Joi.array().items(Joi.string()),
  previewVideo: Joi.array().items(Joi.string()),
  benefits: Joi.array().items(Joi.string()),
  tools: Joi.array().items(Joi.string()),
  requirements: Joi.array().items(Joi.string()),
  tags: Joi.array().items(Joi.string()),
  targetAudience: Joi.string().allow("", null),
  description: Joi.string().allow("", null),
  lecturers: Joi.array().items(lecturerSchema),
});

module.exports = {
  createCourseOnline,
  updateCourseOnline,
};

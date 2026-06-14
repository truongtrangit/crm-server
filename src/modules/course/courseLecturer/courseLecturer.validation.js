const Joi = require("joi");

const createLecturer = Joi.object({
    name: Joi.string().required().trim().messages({
      "string.empty": "Tên giảng viên là bắt buộc",
      "any.required": "Tên giảng viên là bắt buộc",
    }),
    email: Joi.string().email().allow(null, "").trim(),
    phone: Joi.string().allow(null, "").trim(),
    title: Joi.string().allow(null, "").trim(),
    bio: Joi.string().allow(null, ""),
    shortDescription: Joi.string().allow(null, "").trim(),
    slug: Joi.string().allow(null, "").trim(),
    tags: Joi.array().items(Joi.string()).default([]),
    avatar: Joi.string().allow(null, "").uri(),
    rating: Joi.number().min(0).max(5).default(5.0),
    socialLinks: Joi.object({
      facebook: Joi.string().allow(null, "").uri(),
      linkedin: Joi.string().allow(null, "").uri(),
      youtube: Joi.string().allow(null, "").uri(),
    }).default({}),
    isActive: Joi.boolean().default(true),
    isVerified: Joi.boolean().default(false),
    isFeatured: Joi.boolean().default(false),
});

const updateLecturer = Joi.object({
    name: Joi.string().trim(),
    email: Joi.string().email().allow(null, "").trim(),
    phone: Joi.string().allow(null, "").trim(),
    title: Joi.string().allow(null, "").trim(),
    bio: Joi.string().allow(null, ""),
    shortDescription: Joi.string().allow(null, "").trim(),
    slug: Joi.string().allow(null, "").trim(),
    tags: Joi.array().items(Joi.string()),
    avatar: Joi.string().allow(null, "").uri(),
    rating: Joi.number().min(0).max(5),
    socialLinks: Joi.object({
      facebook: Joi.string().allow(null, "").uri(),
      linkedin: Joi.string().allow(null, "").uri(),
      youtube: Joi.string().allow(null, "").uri(),
    }),
    isActive: Joi.boolean(),
    isVerified: Joi.boolean(),
    isFeatured: Joi.boolean(),
});

module.exports = {
  createLecturer,
  updateLecturer,
};

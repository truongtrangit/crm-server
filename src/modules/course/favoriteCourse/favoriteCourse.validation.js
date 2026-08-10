const Joi = require('joi');
const { COURSE_TYPES } = require('../../../core/constants/appData');

const addFavorite = Joi.object({
  courseId: Joi.string().required().messages({
    'string.empty': 'courseId là bắt buộc',
    'any.required': 'courseId là bắt buộc',
  }),
  courseType: Joi.string()
    .valid(...Object.values(COURSE_TYPES))
    .required()
    .messages({
      'string.empty': 'courseType là bắt buộc',
      'any.required': 'courseType là bắt buộc',
      'any.only': 'courseType không hợp lệ',
    }),
});

const checkFavorites = Joi.object({
  courseIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'Cần ít nhất 1 courseId',
      'array.max': 'Tối đa 50 courseIds',
      'any.required': 'courseIds là bắt buộc',
    }),
});

const getAllFavorites = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().allow('').optional(),
  courseType: Joi.string()
    .valid(...Object.values(COURSE_TYPES))
    .allow('')
    .optional(),
  courseId: Joi.string().optional(),
  customerId: Joi.string().optional(),
  fromDate: Joi.string().isoDate().allow('').optional(),
  toDate: Joi.string().isoDate().allow('').optional(),
  sortBy: Joi.string().valid('addedAt', 'createdAt').default('addedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const getFavoriteStats = Joi.object({
  courseType: Joi.string()
    .valid(...Object.values(COURSE_TYPES))
    .allow('')
    .optional(),
  fromDate: Joi.string().isoDate().allow('').optional(),
  toDate: Joi.string().isoDate().allow('').optional(),
});

module.exports = {
  addFavorite,
  checkFavorites,
  getAllFavorites,
  getFavoriteStats,
};

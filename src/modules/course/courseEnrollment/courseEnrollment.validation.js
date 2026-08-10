const Joi = require('joi');
const { COURSE_ENROLLMENT_STATUS, COURSE_TYPES, PAYMENT_METHODS } = require('../../../core/constants/appData');

const ALLOWED_SORT_FIELDS = ['enrolledAt', 'createdAt', 'amountPaid', 'status'];

const getAllEnrollments = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().allow('').trim().max(200),
  courseType: Joi.string().allow(''),
  status: Joi.string().allow(''),
  paymentMethod: Joi.string().allow(''),
  courseId: Joi.string().allow('').trim(),
  fromDate: Joi.date().iso().allow(''),
  toDate: Joi.date().iso().allow(''),
  startDate: Joi.date().iso().allow(''),
  endDate: Joi.date().iso().allow(''),
  sortBy: Joi.string().valid(...ALLOWED_SORT_FIELDS).default('enrolledAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const updateEnrollmentStatus = Joi.object({
  status: Joi.string()
    .valid(...Object.values(COURSE_ENROLLMENT_STATUS))
    .required(),
  internalNote: Joi.string().allow('').optional(),
});

const updateBatchStatus = Joi.object({
  ids: Joi.array().items(Joi.string()).min(1).required(),
  status: Joi.string()
    .valid(...Object.values(COURSE_ENROLLMENT_STATUS))
    .required(),
  internalNote: Joi.string().allow('').optional(),
});

const getEnrollmentStats = Joi.object({
  search: Joi.string().allow('').trim().max(200),
  courseId: Joi.string().allow('').trim(),
  paymentMethod: Joi.string().allow(''),
  status: Joi.string().allow(''),
  fromDate: Joi.date().iso().allow(''),
  toDate: Joi.date().iso().allow(''),
  startDate: Joi.date().iso().allow(''),
  endDate: Joi.date().iso().allow(''),
  courseType: Joi.string().allow(''),
});

module.exports = {
  getAllEnrollments,
  updateEnrollmentStatus,
  updateBatchStatus,
  getEnrollmentStats,
};

const Joi = require('joi');
const { CREDIT_TYPES, CREDIT_SOURCES, CREDIT_TRANSACTION_STATUS } = require('../../../core/constants/appData');

const getTopupHistory = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).default(20),
  search: Joi.string().allow('').trim(),
  creditType: Joi.string().valid(...Object.values(CREDIT_TYPES)).allow(''),
  source: Joi.string().valid(...Object.values(CREDIT_SOURCES)).allow(''),
  status: Joi.string().valid(...Object.values(CREDIT_TRANSACTION_STATUS)).allow(''),
  fromDate: Joi.date().iso().allow(''),
  toDate: Joi.date().iso().allow(''),
  sortBy: Joi.string().default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  getTopupHistory,
};

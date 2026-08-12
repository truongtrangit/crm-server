const Joi = require('joi');
const { TOPUP_REQUEST_STATUS, BUSINESS_TYPES } = require('../../../core/constants/appData');

const invoiceInfoSchema = Joi.object({
  businessType: Joi.string()
    .valid(...Object.values(BUSINESS_TYPES))
    .required(),
  taxCode: Joi.string().trim().required(),
  companyName: Joi.string().trim().required(),
  address: Joi.string().trim().required(),
  email: Joi.string().email().trim().required(),
  phone: Joi.string().trim().required(),
});

// ─── External (BotVN) ──────────────────────────────────────────────────────

const createTopupRequest = Joi.object({
  amount: Joi.number().integer().positive().required(),
  expectedCredit: Joi.number().integer().positive().required(),
  requestInvoice: Joi.boolean().default(false),
  invoiceInfo: Joi.when('requestInvoice', {
    is: true,
    then: invoiceInfoSchema.required(),
    otherwise: Joi.forbidden(),
  }),
});

const confirmTransfer = Joi.object({
  id: Joi.string().required(),
});

const saveBillingInfo = invoiceInfoSchema;

// ─── Internal (CRM Admin) ──────────────────────────────────────────────────

const adminGetRequests = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).default(20),
  search: Joi.string().allow('').trim(),
  status: Joi.string()
    .valid(...Object.values(TOPUP_REQUEST_STATUS))
    .allow(''),
  fromDate: Joi.date().iso().allow(''),
  toDate: Joi.date().iso().allow(''),
  startDate: Joi.date().iso().allow(''),
  endDate: Joi.date().iso().allow(''),
  sortBy: Joi.string().default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const adminApproveRequest = Joi.object({
  note: Joi.string().allow('').default(''),
});

const adminRejectRequest = Joi.object({
  note: Joi.string().trim().required().messages({
    'string.empty': 'Vui lòng nhập lý do từ chối yêu cầu',
    'any.required': 'Vui lòng nhập lý do từ chối yêu cầu',
  }),
});

module.exports = {
  createTopupRequest,
  confirmTransfer,
  saveBillingInfo,
  adminGetRequests,
  adminApproveRequest,
  adminRejectRequest,
};

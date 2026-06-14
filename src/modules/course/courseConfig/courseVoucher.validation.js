const Joi = require("joi");
const { VOUCHER_TYPES, VOUCHER_STATUSES } = require("../../../core/constants/appData");

const createVoucher = Joi.object({
  type: Joi.string()
    .valid(...Object.values(VOUCHER_TYPES))
    .optional(),
  code: Joi.string().max(20).optional(),
  rewardPoints: Joi.number().min(0).required(),
  maxUses: Joi.number().min(1).optional(),
  usagePerUser: Joi.number().min(0).optional(),
  batch: Joi.string().allow(null, "").optional(),
  status: Joi.string()
    .valid(...Object.values(VOUCHER_STATUSES))
    .optional(),
  expiresAt: Joi.date().allow(null).optional(),
});

const bulkCreateVouchers = Joi.object({
  prefix: Joi.string().max(10).optional(),
  count: Joi.number().min(1).max(1000).required(),
  rewardPoints: Joi.number().min(0).required(),
  batch: Joi.string().allow(null, "").optional(),
  status: Joi.string()
    .valid(...Object.values(VOUCHER_STATUSES))
    .optional(),
  expiresAt: Joi.date().allow(null).optional(),
});

const getVouchers = Joi.object({
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),
  batch: Joi.string().optional(),
  status: Joi.string()
    .valid(...Object.values(VOUCHER_STATUSES))
    .optional(),
  type: Joi.string()
    .valid(...Object.values(VOUCHER_TYPES))
    .optional(),
  search: Joi.string().allow("").optional(),
});

const updateVoucherStatus = Joi.object({
  status: Joi.string()
    .valid(...Object.values(VOUCHER_STATUSES))
    .required(),
});

const deleteVouchersByBatch = Joi.object({
  batch: Joi.string().required(),
});

module.exports = {
  createVoucher,
  bulkCreateVouchers,
  getVouchers,
  updateVoucherStatus,
  deleteVouchersByBatch,
};

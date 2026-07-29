const Joi = require('joi');

const { ZCODE_STATUSES } = require('../../core/constants/zcode');

const createZCodesSchema = Joi.object({
  sku: Joi.string().trim().required().messages({
    'string.empty': 'Gói mã (SKU) không được để trống',
    'any.required': 'Gói mã (SKU) là bắt buộc',
  }),
  batchDate: Joi.date().required().messages({
    'date.base': 'Lô ngày không hợp lệ',
    'any.required': 'Lô ngày là bắt buộc',
  }),
  importedAt: Joi.date().required().messages({
    'date.base': 'Ngày nhập hệ thống không hợp lệ',
    'any.required': 'Ngày nhập hệ thống là bắt buộc',
  }),
  listCode: Joi.string().trim().required().messages({
    'string.empty': 'Danh sách mã Key không được để trống',
    'any.required': 'Danh sách mã Key là bắt buộc',
  }),
  priceAdjustmentType: Joi.string()
    .valid('none', 'discount_percent', 'discount_amount', 'custom')
    .default('none')
    .messages({
      'any.only': 'Loại điều chỉnh giá không hợp lệ',
    }),
  priceAdjustmentValue: Joi.when('priceAdjustmentType', {
    is: 'none',
    then: Joi.number().allow(null).default(null),
    otherwise: Joi.number().min(0).required().messages({
      'number.base': 'Giá trị điều chỉnh phải là số',
      'number.min': 'Giá trị điều chỉnh không được âm',
      'any.required': 'Giá trị điều chỉnh là bắt buộc khi chọn loại điều chỉnh',
    }),
  }),
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(ZCODE_STATUSES.AVAILABLE, ZCODE_STATUSES.UNAVAILABLE)
    .required()
    .messages({
      'any.only': 'Trạng thái chỉ được là "available" hoặc "unavailable"',
      'any.required': 'Trạng thái là bắt buộc',
    }),
});

const checkDuplicatesSchema = Joi.object({
  keys: Joi.array()
    .items(
      Joi.string()
        .trim()
        .pattern(/^[A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+$/)
        .messages({
          'string.pattern.base': 'Mã Key "{#value}" không đúng định dạng (VD: AAAA-BBBB-CCCC)',
        })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Danh sách mã Key không được rỗng',
      'any.required': 'Danh sách mã Key là bắt buộc',
    }),
});

const redeemCodeSchema = Joi.object({
  sku: Joi.string().trim().required().messages({
    'string.empty': 'SKU không được để trống',
    'any.required': 'SKU là bắt buộc',
  }),
  partialCode: Joi.string().trim().required().messages({
    'string.empty': 'Partial code không được để trống',
    'any.required': 'Partial code là bắt buộc',
  }),
});

const markDuplicatesSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().trim())
    .min(1)
    .required()
    .messages({
      'array.min': 'Danh sách mã cần đánh dấu không được rỗng',
      'any.required': 'Danh sách mã là bắt buộc',
    }),
});

module.exports = {
  createZCodesSchema,
  updateStatusSchema,
  checkDuplicatesSchema,
  redeemCodeSchema,
  markDuplicatesSchema,
};

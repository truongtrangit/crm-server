const Joi = require('joi');

const { INVOICE_PROVIDER_TYPES, BKAV_CMD_TYPES } = require('../../core/constants/invoice');

// ─── Invoice Item sub-schema ────────────────────────────────────────────────

const invoiceItemSchema = Joi.object({
  itemName: Joi.string().trim().required().messages({
    'string.empty': 'Tên hàng hoá không được để trống',
    'any.required': 'Tên hàng hoá là bắt buộc',
  }),
  unitName: Joi.string().trim().allow('').default(''),
  quantity: Joi.number().min(0).default(0),
  unitPrice: Joi.number().min(0).default(0),
  amount: Joi.number().default(0),
  taxRateId: Joi.number().integer().min(0).default(3),
  taxRate: Joi.number().min(-2).max(100).default(10),
  taxAmount: Joi.number().default(0),
  discountRate: Joi.number().min(0).max(100).default(0),
  discountAmount: Joi.number().min(0).default(0),
  isDiscount: Joi.boolean().default(false),
  itemTypeId: Joi.number().integer().min(0).default(0),
  userDefineDetails: Joi.string().allow('').default(''),
  isIncrease: Joi.boolean().allow(null).default(null),
});

// ─── Buyer sub-schema ───────────────────────────────────────────────────────

const buyerSchema = Joi.object({
  type: Joi.string().valid('company', 'personal').default('company'),
  name: Joi.string().trim().allow('').default(''),
  taxCode: Joi.string().trim().allow('').default(''),
  unitName: Joi.string().trim().allow('').default(''),
  address: Joi.string().trim().allow('').default(''),
  email: Joi.string().trim().email({ tlds: false }).allow('').default(''),
  phone: Joi.string().trim().allow('').default(''),
  bankAccount: Joi.string().trim().allow('').default(''),
  cccd: Joi.string().trim().allow('').default(''),
});

// ─── Create Invoice ─────────────────────────────────────────────────────────

const createInvoiceSchema = Joi.object({
  providerId: Joi.string().trim().required().messages({
    'string.empty': 'Nhà cung cấp không được để trống',
    'any.required': 'Nhà cung cấp là bắt buộc',
  }),
  isDraft: Joi.boolean().default(true),                // true = lưu nháp, false = phát hành ngay
  invoiceForm: Joi.string().trim().allow('', null).default(null),
  invoiceSerial: Joi.string().trim().allow('', null).default(null),
  invoiceNo: Joi.number().integer().min(0).default(0),
  invoiceDate: Joi.date().allow(null).default(null),
  buyer: buyerSchema.default(),
  paymentMethod: Joi.string().valid('TM', 'CK', 'TM/CK').default('TM/CK'),
  currency: Joi.string().trim().default('VND'),
  exchangeRate: Joi.number().min(0).default(1),
  note: Joi.string().trim().allow('').default(''),
  billCode: Joi.string().trim().allow('').default(''),
  userDefine: Joi.string().allow('').default(''),
  items: Joi.array().items(invoiceItemSchema).min(1).required().messages({
    'array.min': 'Phải có ít nhất 1 hàng hoá / dịch vụ',
    'any.required': 'Danh sách hàng hoá là bắt buộc',
  }),
  // Cho HĐ thay thế / điều chỉnh
  relatedInvoiceId: Joi.string().trim().allow(null, '').default(null),
  relationType: Joi.string().valid('replacement', 'adjustment', null).default(null),
});

// ─── Update Invoice (draft only) ────────────────────────────────────────────

const updateInvoiceSchema = Joi.object({
  invoiceForm: Joi.string().trim().allow('', null),
  invoiceSerial: Joi.string().trim().allow('', null),
  invoiceNo: Joi.number().integer().min(0),
  invoiceDate: Joi.date().allow(null),
  buyer: buyerSchema,
  paymentMethod: Joi.string().valid('TM', 'CK', 'TM/CK'),
  currency: Joi.string().trim(),
  exchangeRate: Joi.number().min(0),
  note: Joi.string().trim().allow(''),
  billCode: Joi.string().trim().allow(''),
  userDefine: Joi.string().allow(''),
  items: Joi.array().items(invoiceItemSchema).min(1).messages({
    'array.min': 'Phải có ít nhất 1 hàng hoá / dịch vụ',
  }),
}).min(1);

// ─── Create Provider ────────────────────────────────────────────────────────

const bkavConfigSchema = Joi.object({
  partnerGUID: Joi.string().trim().required().messages({
    'string.empty': 'PartnerGUID không được để trống',
    'any.required': 'PartnerGUID là bắt buộc',
  }),
  partnerToken: Joi.string().trim().required().messages({
    'string.empty': 'PartnerToken không được để trống',
    'any.required': 'PartnerToken là bắt buộc',
  }),
  cmdType: Joi.number()
    .valid(...Object.values(BKAV_CMD_TYPES))
    .default(BKAV_CMD_TYPES.CREATE_111),
  endpoint: Joi.string().uri().required().messages({
    'string.uri': 'Endpoint phải là URL hợp lệ',
    'any.required': 'Endpoint là bắt buộc',
  }),
  invoiceTypeId: Joi.number().integer().min(1).max(5).default(1),
  receiveTypeId: Joi.number().integer().min(1).max(4).default(3),
  autoSign: Joi.boolean().default(false),
});

const sepayConfigSchema = Joi.object({
  bearerToken: Joi.string().trim().required().messages({
    'string.empty': 'Bearer Token không được để trống',
    'any.required': 'Bearer Token là bắt buộc',
  }),
  providerAccountId: Joi.string().trim().allow('').default(''),
  templateCode: Joi.string().trim().allow('').default(''),
  endpoint: Joi.string().uri().required().messages({
    'string.uri': 'Endpoint phải là URL hợp lệ',
    'any.required': 'Endpoint là bắt buộc',
  }),
});

const createProviderSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Tên nhà cung cấp không được để trống',
    'any.required': 'Tên nhà cung cấp là bắt buộc',
  }),
  providerType: Joi.string()
    .valid(...Object.values(INVOICE_PROVIDER_TYPES))
    .required()
    .messages({
      'any.only': `Loại nhà cung cấp phải là ${Object.values(INVOICE_PROVIDER_TYPES).join(' hoặc ')}`,
      'any.required': 'Loại nhà cung cấp là bắt buộc',
    }),
  invoiceForm: Joi.string().trim().allow('', null).default(null),
  invoiceSerial: Joi.string().trim().allow('', null).default(null),
  isActive: Joi.boolean().default(true),
  isDefault: Joi.boolean().default(false),
  emailNotification: Joi.object({
    enabled: Joi.boolean().default(false),
  }).default(),
  bkav: Joi.when('providerType', {
    is: INVOICE_PROVIDER_TYPES.BKAV,
    then: bkavConfigSchema.required(),
    otherwise: Joi.object().allow(null).default(null),
  }),
  sepay: Joi.when('providerType', {
    is: INVOICE_PROVIDER_TYPES.SEPAY,
    then: sepayConfigSchema.required(),
    otherwise: Joi.object().allow(null).default(null),
  }),
});

// ─── Update Provider ────────────────────────────────────────────────────────

const updateProviderSchema = Joi.object({
  name: Joi.string().trim(),
  invoiceForm: Joi.string().trim().allow('', null),
  invoiceSerial: Joi.string().trim().allow('', null),
  isActive: Joi.boolean(),
  isDefault: Joi.boolean(),
  emailNotification: Joi.object({
    enabled: Joi.boolean(),
  }),
  bkav: Joi.object({
    partnerGUID: Joi.string().trim(),
    partnerToken: Joi.string().trim(),
    cmdType: Joi.number().valid(...Object.values(BKAV_CMD_TYPES)),
    endpoint: Joi.string().uri(),
    invoiceTypeId: Joi.number().integer().min(1).max(5),
    receiveTypeId: Joi.number().integer().min(1).max(4),
    autoSign: Joi.boolean(),
  }).allow(null),
  sepay: Joi.object({
    bearerToken: Joi.string().trim(),
    providerAccountId: Joi.string().trim().allow(''),
    templateCode: Joi.string().trim().allow(''),
    endpoint: Joi.string().uri(),
  }).allow(null),
}).min(1);

module.exports = {
  createInvoiceSchema,
  updateInvoiceSchema,
  createProviderSchema,
  updateProviderSchema,
};

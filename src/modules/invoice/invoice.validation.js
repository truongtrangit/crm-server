const Joi = require('joi');

const {
  INVOICE_PROVIDER_TYPES,
  BKAV_CMD_TYPES,
  INVOICE_ITEM_TYPE_ALIASES,
} = require('../../core/constants/invoice');

// ─── Invoice Item sub-schema ────────────────────────────────────────────────

const invoiceItemSchema = Joi.object({
  productId: Joi.string().trim().allow(null, '').default(null),
  itemCode: Joi.string().trim().allow('').default(''),
  itemName: Joi.string().trim().allow('').default(''),
  unitName: Joi.string().trim().allow('').default(''),
  quantity: Joi.number().default(0),
  unitPrice: Joi.number().default(0),
  amount: Joi.number().default(0),
  taxRateId: Joi.number().integer().min(1).default(3),
  taxRate: Joi.number().min(-4).max(100).default(10),
  taxAmount: Joi.number().default(0),
  discountRate: Joi.number().min(0).max(100).default(0),
  discountAmount: Joi.number().min(0).default(0),
  isDiscount: Joi.boolean().default(false),
  itemTypeId: Joi.number().integer().min(0).default(0),
  userDefineDetails: Joi.string().allow('').default(''),
  isIncrease: Joi.boolean().allow(null).default(null),
}).unknown(true);

// ─── Buyer sub-schema ───────────────────────────────────────────────────────

const buyerSchema = Joi.object({
  type: Joi.string().valid('company', 'personal').default('company'),
  code: Joi.string().trim().allow('').default(''),
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
  isDraft: Joi.boolean().default(true), // true = lưu nháp, false = phát hành ngay
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
  relationType: Joi.string()
    .valid('replacement', 'adjustment', 'adjustment_discount', null)
    .default(null),
  // Nguồn gốc dữ liệu
  sourceModule: Joi.string().trim().allow(null, '').default(null),
  sourceId: Joi.string().trim().allow(null, '').default(null),
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
  sourceModule: Joi.string().trim().allow(null, ''),
  sourceId: Joi.string().trim().allow(null, ''),
  items: Joi.array().items(invoiceItemSchema).min(1).messages({
    'array.min': 'Phải có ít nhất 1 hàng hoá / dịch vụ',
  }),
  isDraft: Joi.boolean(),
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
    .default(BKAV_CMD_TYPES.CREATE_112),
  endpoint: Joi.string().uri().required().messages({
    'string.uri': 'Endpoint phải là URL hợp lệ',
    'any.required': 'Endpoint là bắt buộc',
  }),
  invoiceTypeId: Joi.number().integer().min(1).max(11).default(1),
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
  sellerTaxCode: Joi.string().trim().max(14).allow('', null).default(null),
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
  sellerTaxCode: Joi.string().trim().max(14).allow('', null),
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
    invoiceTypeId: Joi.number().integer().min(1).max(11),
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

const replaceAdjustInvoiceSchema = Joi.object({
  reason: Joi.string().trim().required().messages({
    'string.empty': 'Lý do thay thế / điều chỉnh không được để trống',
    'any.required': 'Lý do thay thế / điều chỉnh là bắt buộc',
  }),
  invoiceForm: Joi.string().trim().allow('', null),
  invoiceSerial: Joi.string().trim().allow('', null),
  invoiceDate: Joi.date().allow(null),
  buyer: buyerSchema,
  paymentMethod: Joi.string().valid('TM', 'CK', 'TM/CK'),
  currency: Joi.string().trim(),
  exchangeRate: Joi.number().min(0),
  note: Joi.string().trim().allow(''),
  billCode: Joi.string().trim().allow(''),
  items: Joi.array().items(invoiceItemSchema).min(1).required().messages({
    'array.min': 'Phải có ít nhất 1 dòng hàng hoá / dịch vụ',
    'any.required': 'Danh sách hàng hoá / dịch vụ là bắt buộc',
  }),
});

// ─── Invoice Product / Catalog ──────────────────────────────────────────────

const createInvoiceProductSchema = Joi.object({
  code: Joi.string().trim().uppercase().required().messages({
    'string.empty': 'Mã sản phẩm (SKU) không được để trống',
    'any.required': 'Mã sản phẩm (SKU) là bắt buộc',
  }),
  name: Joi.string().trim().required().messages({
    'string.empty': 'Tên hàng hoá / dịch vụ không được để trống',
    'any.required': 'Tên hàng hoá / dịch vụ là bắt buộc',
  }),
  unitName: Joi.string().trim().allow('').default('Lần'),
  unitPrice: Joi.number().min(0).default(0),
  taxRateId: Joi.number().integer().min(1).default(3),
  taxRate: Joi.number().min(-2).max(100).default(10),
  itemTypeId: Joi.number().integer().min(0).default(0),
  description: Joi.string().trim().allow('').default(''),
  userDefineDetails: Joi.string().allow('').default(''),
  isActive: Joi.boolean().default(true),
});

const updateInvoiceProductSchema = Joi.object({
  code: Joi.string().trim().uppercase(),
  name: Joi.string().trim(),
  unitName: Joi.string().trim().allow(''),
  unitPrice: Joi.number().min(0),
  taxRateId: Joi.number().integer().min(1),
  taxRate: Joi.number().min(-2).max(100),
  itemTypeId: Joi.number().integer().min(0),
  description: Joi.string().trim().allow(''),
  userDefineDetails: Joi.string().allow(''),
  isActive: Joi.boolean(),
}).min(1);

// ─── External API: Create Invoice (Key.vn / 3rd-party) ──────────────────────

const VALID_EXTERNAL_TAX_RATES = [0, 5, 8, 10, -1, -2, -4];

const externalInvoiceItemSchema = Joi.object({
  id: Joi.string().trim().allow(null, ''),
  productId: Joi.string().trim().allow(null, ''),
  itemCode: Joi.string().trim().allow(''),
  productCode: Joi.string().trim().allow(''),
  itemName: Joi.string().trim().allow(''),
  unitName: Joi.string().trim().allow(''),
  quantity: Joi.number(),
  unitPrice: Joi.number(),
  amount: Joi.number(),
  taxRateId: Joi.number().integer().min(1),
  taxRate: Joi.number().valid(...VALID_EXTERNAL_TAX_RATES),
  taxAmount: Joi.number(),
  discountRate: Joi.number().min(0).max(100).default(0),
  discountAmount: Joi.number().min(0),
  isDiscount: Joi.boolean(),
  itemType: Joi.string()
    .trim()
    .lowercase()
    .valid(...Object.keys(INVOICE_ITEM_TYPE_ALIASES)),
  itemTypeId: Joi.number().integer().valid(0, 4, 15, 21, 30),
  userDefineDetails: Joi.alternatives().try(
    Joi.string().allow(''),
    Joi.object(),
    Joi.array(),
  ),
})
  .custom((value, helpers) => {
    const hasProductRef = Boolean(
      (value.productId && String(value.productId).trim()) ||
        (value.id && String(value.id).trim()) ||
        (value.itemCode && String(value.itemCode).trim()) ||
        (value.productCode && String(value.productCode).trim()),
    );

    // Nhánh 1: Có gửi ID / Mã liên quan đến Product → sẽ dùng thông tin Product có sẵn trong DB
    if (hasProductRef) {
      if (
        value.quantity !== undefined &&
        value.quantity !== null &&
        Number(value.quantity) <= 0
      ) {
        return helpers.error('any.custom', {
          message: 'Số lượng (quantity) của sản phẩm phải lớn hơn 0',
        });
      }
      return value;
    }

    // Nhánh 2: Không gửi ID / Mã Product → kiểm tra toàn bộ các field bắt buộc theo từng loại dòng
    const resolvedTypeId =
      value.itemTypeId !== undefined && value.itemTypeId !== null
        ? Number(value.itemTypeId)
        : value.isDiscount
          ? 30
          : typeof value.itemType === 'string'
            ? INVOICE_ITEM_TYPE_ALIASES[value.itemType.trim().toLowerCase()] ?? 0
            : 0;

    const missingFields = [];

    if (!value.itemName || !String(value.itemName).trim()) {
      missingFields.push('itemName (tên hàng hoá/dịch vụ)');
    }

    if (resolvedTypeId === 0 || resolvedTypeId === 21) {
      // Hàng hoá / dịch vụ thông thường hoặc Xe cơ giới: bắt buộc đủ itemName, unitName, quantity, unitPrice, taxRate
      if (!value.unitName || !String(value.unitName).trim()) {
        missingFields.push('unitName (đơn vị tính)');
      }
      if (
        value.quantity === undefined ||
        value.quantity === null ||
        Number(value.quantity) <= 0
      ) {
        missingFields.push('quantity (số lượng > 0)');
      }
      if (
        value.unitPrice === undefined ||
        value.unitPrice === null ||
        Number(value.unitPrice) < 0
      ) {
        missingFields.push('unitPrice (đơn giá >= 0)');
      }
      if (value.taxRate === undefined || value.taxRate === null) {
        missingFields.push(
          'taxRate (thuế suất: 0, 5, 8, 10, -1 [KCT], -2 [KKK], -4 [Khác])',
        );
      }
      if (resolvedTypeId === 21) {
        const hasDetails =
          value.userDefineDetails &&
          (typeof value.userDefineDetails === 'object'
            ? Object.keys(value.userDefineDetails).length > 0
            : String(value.userDefineDetails).trim().length > 0);
        if (!hasDetails) {
          missingFields.push(
            'userDefineDetails (thông tin số khung/số máy cho dòng xe cơ giới)',
          );
        }
      }
    } else if (resolvedTypeId === 15) {
      // Hàng khuyến mãi: bắt buộc itemName, unitName, quantity > 0
      if (!value.unitName || !String(value.unitName).trim()) {
        missingFields.push('unitName (đơn vị tính)');
      }
      if (
        value.quantity === undefined ||
        value.quantity === null ||
        Number(value.quantity) <= 0
      ) {
        missingFields.push('quantity (số lượng > 0)');
      }
    } else if (resolvedTypeId === 30) {
      // Dòng chiết khấu: bắt buộc itemName và (amount > 0 hoặc quantity * unitPrice > 0)
      const hasValidAmount =
        value.amount !== undefined &&
        value.amount !== null &&
        Number(value.amount) > 0;
      const hasValidQtyPrice =
        value.quantity !== undefined &&
        value.unitPrice !== undefined &&
        Number(value.quantity) > 0 &&
        Number(value.unitPrice) > 0;
      if (!hasValidAmount && !hasValidQtyPrice) {
        missingFields.push(
          'amount (số tiền chiết khấu > 0) hoặc cặp quantity & unitPrice > 0',
        );
      }
    }
    // resolvedTypeId === 4 (Ghi chú): chỉ cần itemName không rỗng

    if (missingFields.length > 0) {
      return helpers.error('any.custom', {
        message: `Dòng hàng hoá tự định nghĩa (không truyền productId/itemCode) thiếu hoặc không hợp lệ các trường: ${missingFields.join(', ')}`,
      });
    }

    return value;
  })
  .messages({
    'any.custom': '{{#message}}',
    'any.only':
      'taxRate không hợp lệ (chỉ chấp nhận: 0, 5, 8, 10, -1 [KCT], -2 [KKK], -4 [Khác])',
  });

const externalCreateInvoiceSchema = Joi.object({
  providerId: Joi.string().trim().allow('', null).default(null),
  isDraft: Joi.boolean().default(false),
  invoiceForm: Joi.string().trim().allow('', null).default(null),
  invoiceSerial: Joi.string().trim().allow('', null).default(null),
  invoiceDate: Joi.date().allow(null).default(null),
  buyer: buyerSchema.default(),
  paymentMethod: Joi.string().valid('TM', 'CK', 'TM/CK').default('TM/CK'),
  currency: Joi.string().trim().default('VND'),
  exchangeRate: Joi.number().min(0).default(1),
  note: Joi.string().trim().allow('').default(''),
  billCode: Joi.string().trim().allow('').default(''),
  userDefine: Joi.string().allow('').default(''),
  sourceModule: Joi.string().trim().allow('', null).default(null),
  sourceId: Joi.string().trim().allow('', null).default(null),
  externalRef: Joi.string().trim().allow('', null).default(null),
  items: Joi.array()
    .items(externalInvoiceItemSchema)
    .min(1)
    .required()
    .messages({
      'array.min': 'Phải có ít nhất 1 hàng hoá / dịch vụ',
      'any.required': 'Danh sách hàng hoá (items) là bắt buộc',
    }),
});

module.exports = {
  createInvoiceSchema,
  updateInvoiceSchema,
  replaceAdjustInvoiceSchema,
  createProviderSchema,
  updateProviderSchema,
  createInvoiceProductSchema,
  updateInvoiceProductSchema,
  externalInvoiceItemSchema,
  externalCreateInvoiceSchema,
};

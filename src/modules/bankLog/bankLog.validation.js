const Joi = require('joi');

const {
  BANK_LOG_CONDITION_PARAMS,
  BANK_LOG_OPERATORS,
  BANK_LOG_AUTH_TYPES,
} = require('../../core/constants/bankLog');

// ─── Shared sub-schemas ─────────────────────────────────────────────────────

const conditionSchema = Joi.object({
  parameter: Joi.string()
    .valid(...Object.values(BANK_LOG_CONDITION_PARAMS))
    .required()
    .messages({
      'any.only': 'Parameter phải là amount, content, hoặc sender',
      'any.required': 'Parameter là bắt buộc',
    }),
  operator: Joi.string()
    .valid(...Object.values(BANK_LOG_OPERATORS))
    .required()
    .messages({
      'any.only': 'Operator không hợp lệ',
      'any.required': 'Operator là bắt buộc',
    }),
  value: Joi.string().trim().required().messages({
    'string.empty': 'Giá trị so sánh không được để trống',
    'any.required': 'Giá trị so sánh là bắt buộc',
  }),
});

const targetApiSchema = Joi.object({
  url: Joi.string().uri().required().messages({
    'string.uri': 'URL API đích phải là URL hợp lệ',
    'any.required': 'URL API đích là bắt buộc',
  }),
  method: Joi.string().valid('POST', 'PUT', 'PATCH').default('POST'),
  authType: Joi.string()
    .valid(...Object.values(BANK_LOG_AUTH_TYPES))
    .default(BANK_LOG_AUTH_TYPES.NONE),
  authToken: Joi.string().trim().allow(null, '').default(null).when('authType', {
    is: Joi.string().valid(
      BANK_LOG_AUTH_TYPES.BEARER,
      BANK_LOG_AUTH_TYPES.API_KEY,
      BANK_LOG_AUTH_TYPES.BASIC,
    ),
    then: Joi.string().trim().required().messages({
      'any.required': 'Auth token là bắt buộc khi chọn auth type',
    }),
  }),
  headers: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
  timeout: Joi.number().integer().min(1).max(60).allow(null).default(null),
});

// ─── Routing Rule Schemas ────────────────────────────────────────────────────

const createRuleSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Tên quy tắc không được để trống',
    'any.required': 'Tên quy tắc là bắt buộc',
  }),
  targetApi: targetApiSchema.required().messages({
    'any.required': 'Cấu hình API đích là bắt buộc',
  }),
  priority: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  conditions: Joi.array().items(conditionSchema).min(1).required().messages({
    'array.min': 'Phải có ít nhất 1 điều kiện',
    'any.required': 'Điều kiện là bắt buộc',
  }),
});

const updateRuleSchema = Joi.object({
  name: Joi.string().trim(),
  targetApi: targetApiSchema,
  priority: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
  conditions: Joi.array().items(conditionSchema).min(1).messages({
    'array.min': 'Phải có ít nhất 1 điều kiện',
  }),
}).min(1);

// ─── Webhook Ingestion Schema ────────────────────────────────────────────────

const ingestTransactionSchema = Joi.object({
  txId: Joi.string().trim().required().messages({
    'string.empty': 'Mã giao dịch không được để trống',
    'any.required': 'Mã giao dịch là bắt buộc',
  }),
  bank: Joi.string().trim().required().messages({
    'string.empty': 'Tên ngân hàng không được để trống',
    'any.required': 'Tên ngân hàng là bắt buộc',
  }),
  sender: Joi.string().trim().allow(null, '').default(null),
  amount: Joi.number().required().messages({
    'number.base': 'Số tiền phải là số',
    'any.required': 'Số tiền là bắt buộc',
  }),
  content: Joi.string().trim().allow(null, '').default(null),
  transactionDate: Joi.date().allow(null).default(null),
}).options({ stripUnknown: false });

// ─── ACB Webhook Payload Schema ──────────────────────────────────────────────
//
// Cấu trúc payload webhook thông báo biến động giao dịch từ ACB.
// Tham chiếu: ACB Transaction Notification API Specification
//
// Luồng: ACB gửi POST → VIK endpoint
// Cấu trúc: masterMeta → requests[] → requestMeta + requestParams → transactions[]

const acbTransactionItemSchema = Joi.object({
  // Trạng thái giao dịch:
  //   COMPLETED      — Giao dịch thành công
  //   ERRORCORRECTED — Giao dịch bị hủy/đảo ngược
  transactionStatus: Joi.string()
    .valid('COMPLETED', 'ERRORCORRECTED')
    .required()
    .messages({
      'any.only': 'transactionStatus phải là COMPLETED hoặc ERRORCORRECTED',
      'any.required': 'transactionStatus là bắt buộc',
    }),

  // Kênh thực hiện giao dịch (22 kênh ACB hỗ trợ):
  //   MAPP — Mobile App, IBFT — Internet Banking Fund Transfer,
  //   ATM, API, WWW — Web, SMS, ...
  transactionChannel: Joi.string()
    .valid(
      'BAT', 'VRU', 'WWW', 'ATM', 'ONLI', 'ACH', 'FSC', 'CCM', 'API', 'MG',
      'SECU', 'MAPP', 'SMS', 'ACHS', 'CCAT', 'AAP', 'IBFT', 'CLMS', 'REMI',
      'TB', 'SOBA', 'BIZ',
    )
    .required()
    .messages({
      'any.only': 'transactionChannel không hợp lệ',
      'any.required': 'transactionChannel là bắt buộc',
    }),

  // Mã giao dịch do ACB tạo ra khi hoàn tất giao dịch (ví dụ: 56327, 4056)
  // ACB spec ghi kiểu string nhưng sample trả về number → chấp nhận cả hai
  transactionCode: Joi.alternatives()
    .try(Joi.string().trim(), Joi.number())
    .required()
    .messages({ 'any.required': 'transactionCode là bắt buộc' }),

  // Số tài khoản đã đăng ký nhận thông báo ghi có hoặc ghi nợ
  accountNumber: Joi.alternatives()
    .try(Joi.string().trim(), Joi.number())
    .required()
    .messages({ 'any.required': 'accountNumber là bắt buộc' }),

  // Thời gian thực hiện giao dịch, ghi nhận theo giờ hệ thống ACB (ISO 8601)
  // Ví dụ: "2022-09-19T03:28:51.000Z"
  transactionDate: Joi.string().required().messages({
    'any.required': 'transactionDate là bắt buộc',
  }),

  // Thời gian hiệu lực của giao dịch (ISO 8601)
  // Ví dụ: "2022-09-18T17:00:00.000Z"
  effectiveDate: Joi.string().allow(null, '').default(null),

  // Loại giao dịch:
  //   credit — Báo có (tiền vào tài khoản)
  //   debit  — Báo nợ (tiền ra khỏi tài khoản)
  debitOrCredit: Joi.string().valid('credit', 'debit').required().messages({
    'any.only': 'debitOrCredit phải là credit hoặc debit',
    'any.required': 'debitOrCredit là bắt buộc',
  }),

  // Thông tin tài khoản ảo — chỉ xuất hiện khi giao dịch nộp tiền vào TK ảo
  //   vaPrefixCd — Đầu số TK ảo, để nhận diện khách hàng nhận báo có/nợ
  //   vaNbr      — Số TK ảo do ngân hàng cấp cho khách hàng
  virtualAccountInfo: Joi.object({
    vaPrefixCd: Joi.string().allow(null, '').default(null),
    vaNbr: Joi.string().allow(null, '').default(null),
  }).unknown(true).allow(null).default(null),

  // Tài khoản ảo (ví dụ: "HU1")
  virtualAccount: Joi.string().allow(null, '').default(null),

  // Mã tham chiếu giao dịch do hệ thống của khách hàng tạo ra
  referenceNumber: Joi.string().allow(null, '').default(null),

  // Mã định danh người dùng trên hệ thống khách hàng
  // Ví dụ: số hợp đồng điện/nước, số tài khoản chứng khoán, ...
  partnerCustomerCode: Joi.string().allow(null, '').default(null),

  // Tên người dùng trên hệ thống khách hàng
  partnerCustomerName: Joi.string().allow(null, '').default(null),

  // Phân loại người dùng: KHCN (cá nhân), KHDN (doanh nghiệp), ORG (tổ chức), ...
  partnerCustomerType: Joi.string().allow(null, '').default(null),

  // Số tiền giao dịch (đơn vị: VND, không âm)
  amount: Joi.number().min(0).required().messages({
    'number.base': 'amount phải là số',
    'number.min': 'amount không được âm',
    'any.required': 'amount là bắt buộc',
  }),

  // Thông tin thuộc tính khác của giao dịch
  transactionEntityAttribute: Joi.object({
    traceNumber: Joi.string().allow(null, '').default(null),              // Mã giao dịch
    beneficiaryName: Joi.string().allow(null, '').default(null),          // Tên khách hàng thụ hưởng
    beneficiaryAccountNumber: Joi.string().allow(null, '').default(null), // Số TK khách hàng thụ hưởng
    receiverBankName: Joi.string().allow(null, '').default(null),         // Tên ngân hàng thụ hưởng
    remitterName: Joi.string().allow(null, '').default(null),             // Tên khách hàng chuyển tiền
    remitterAccountNumber: Joi.string().allow(null, '').default(null),    // Số TK khách hàng chuyển tiền
    issuerBankName: Joi.string().allow(null, '').default(null),           // Tên ngân hàng chuyển tiền
  }).unknown(true).allow(null).default(null),

  // Nội dung giao dịch / nội dung chuyển khoản
  transactionContent: Joi.string().allow(null, '').default(null),

  // Các trường dữ liệu mở rộng tùy chọn (custom1 → custom10)
  custom1: Joi.string().allow(null, '').default(null),
  custom2: Joi.string().allow(null, '').default(null),
  custom3: Joi.string().allow(null, '').default(null),
  custom4: Joi.string().allow(null, '').default(null),
  custom5: Joi.string().allow(null, '').default(null),
  custom6: Joi.string().allow(null, '').default(null),
  custom7: Joi.string().allow(null, '').default(null),
  custom8: Joi.string().allow(null, '').default(null),
  custom9: Joi.string().allow(null, '').default(null),
  custom10: Joi.string().allow(null, '').default(null),
}).unknown(true).options({ stripUnknown: false });

const acbWebhookSchema = Joi.object({
  // Thông tin định danh của truy vấn
  masterMeta: Joi.object({
    // Mã định danh khách hàng do ACB cung cấp cho VIK (UUID)
    clientId: Joi.string().required().messages({
      'any.required': 'masterMeta.clientId là bắt buộc',
    }),
    // Mã định danh duy nhất cho mỗi yêu cầu do ACB tạo ra để truy vết (UUID)
    clientRequestId: Joi.string().required().messages({
      'any.required': 'masterMeta.clientRequestId là bắt buộc',
    }),
    // Mã hash dùng để kiểm tra tính chính xác của giao dịch
    checksum: Joi.string().required().messages({
      'any.required': 'masterMeta.checksum là bắt buộc',
    }),
  }).required().messages({
    'any.required': 'masterMeta là bắt buộc',
  }),

  // Mảng thông tin chi tiết các yêu cầu
  requests: Joi.array().items(
    Joi.object({
      // Thông tin xác định yêu cầu nghiệp vụ
      requestMeta: Joi.object({
        // Loại dịch vụ yêu cầu — hiện chỉ có giá trị NOTIFICATION
        requestType: Joi.string().valid('NOTIFICATION').required().messages({
          'any.only': 'requestType phải là NOTIFICATION',
          'any.required': 'requestMeta.requestType là bắt buộc',
        }),
        // Phân loại yêu cầu thông báo:
        //   TRANSACTION_UPDATE  — Thông báo nợ/có tức thì
        //   TRANSACTION_HISTORY — Thông báo nợ/có cuối ngày
        requestCode: Joi.string()
          .valid('TRANSACTION_UPDATE', 'TRANSACTION_HISTORY')
          .required()
          .messages({
            'any.only': 'requestCode phải là TRANSACTION_UPDATE hoặc TRANSACTION_HISTORY',
            'any.required': 'requestMeta.requestCode là bắt buộc',
          }),
      }).required(),

      // Thông tin chi tiết của yêu cầu
      requestParams: Joi.object({
        // Mảng chi tiết các giao dịch
        transactions: Joi.array()
          .items(acbTransactionItemSchema)
          .min(1)
          .required()
          .messages({
            'array.min': 'transactions phải có ít nhất 1 giao dịch',
            'any.required': 'requestParams.transactions là bắt buộc',
          }),
        // Thông tin phân trang dữ liệu
        pagination: Joi.object({
          page: Joi.number().integer().allow(null),      // Số trang hiện tại (≥ 1)
          pageSize: Joi.number().integer().allow(null),   // Số dòng dữ liệu trong 1 trang (1..1000)
          totalPage: Joi.number().integer().allow(null),  // Tổng số trang (≥ 1)
        }).allow(null).default(null),
      }).required(),
    }),
  ).min(1).required().messages({
    'array.min': 'requests phải có ít nhất 1 phần tử',
    'any.required': 'requests là bắt buộc',
  }),
}).options({ stripUnknown: false });

module.exports = {
  createRuleSchema,
  updateRuleSchema,
  ingestTransactionSchema,
  acbWebhookSchema,
};

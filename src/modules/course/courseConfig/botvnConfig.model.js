const mongoose = require('mongoose');
const { BOTVN_ROLES } = require('../../../core/constants/appData');

const BOTVN_MAINTENANCE_TYPES = {
  MAINTENANCE: 'maintenance',
  COMING_SOON: 'coming_soon',
};

const botvnConfigSchema = new mongoose.Schema(
  {
    menus: {
      home: { type: Boolean, default: true },
      online: { type: Boolean, default: true },
      offline: { type: Boolean, default: true },
      challenge: { type: Boolean, default: true },
      nextMarketer: { type: Boolean, default: true },
      knowledge: { type: Boolean, default: true },
    },
    login: {
      emailPassword: { type: Boolean, default: true },
      facebook: { type: Boolean, default: true },
      google: { type: Boolean, default: true },
      qrCode: { type: Boolean, default: true },
      allowRegistration: { type: Boolean, default: true },
    },
    maintenance: {
      isActive: { type: Boolean, default: false },
      type: {
        type: String,
        enum: Object.values(BOTVN_MAINTENANCE_TYPES),
        default: BOTVN_MAINTENANCE_TYPES.MAINTENANCE,
      },
      title: { type: String, default: '' },
      reason: { type: String, default: '' },
      time: { type: String, default: '' },
      allowedRoles: [{
        type: String,
        enum: Object.values(BOTVN_ROLES)
      }]
    },
    bankTransfer: {
      isEnabled: { type: Boolean, default: false },
      bankName: { type: String, default: '' },
      bankCode: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      accountHolder: { type: String, default: '' },
      transferContentTemplate: { type: String, default: 'BOTVN {requestId}' },
      creditRatio: { type: Number, default: 1 },
      quickAmounts: {
        type: [Number],
        default: [100000, 500000, 1000000, 2000000, 5000000, 10000000],
      },
      notes: [{ type: String }],
    },
    otpApi: {
      // Template payload dạng Mixed — admin lưu nguyên cấu trúc JSON mà API bên thứ 3 yêu cầu.
      // Dùng placeholder {{fieldName}} sẽ được thay bằng giá trị từ customer/context khi runtime.
      // Ví dụ: { "customer": { "id": "{{email}}" }, "attrs": [{ "name": "Ma_OTP", "value": "{{otp}}" }] }
      // Nếu không config → dùng payload mặc định { email, otp, expiresInSeconds }
      payloadTemplate: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('BotvnConfig', botvnConfigSchema);
module.exports.BOTVN_MAINTENANCE_TYPES = BOTVN_MAINTENANCE_TYPES;

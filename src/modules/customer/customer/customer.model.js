const mongoose = require("mongoose");
const { softDeletePlugin } = require('../../../core/utils/softDelete');
const { CUSTOMER_MAIN_TYPES, BOTVN_ROLES } = require('../../../core/constants/appData');


const customerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    /**
     * mainType: phân loại cấp cao nhất.
     *   'biz'  — tài khoản Business/Organization
     *   'user' — user cá nhân
     */
    mainType: {
      type: String,
      enum: Object.values(CUSTOMER_MAIN_TYPES),
      default: CUSTOMER_MAIN_TYPES.USER,
      index: true,
    },
    /**
     * subType: phân loại cấp 2 (phụ thuộc mainType).
     *   biz  → new_biz | paid_biz | expired_biz
     *   user → owner | agency | seller | '' (empty = chưa xác định)
     */
    subType: { type: String, default: "", trim: true, index: true },
    /**
     * alias: định danh không dấu của biz (dùng để phân biệt khi name/phone/email trùng).
     * Lấy từ payload.alias của webhook biz_create.
     */
    alias: { type: String, default: "", trim: true },
    /** Loại khách hàng (legacy field, giữ để backward-compat) */
    type: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String },
    biz: { type: [String], default: [] },
    bizDetails: {
      type: [
        {
          bizId: { type: String, required: true },
          thirdPartyBizId: { type: String },
          role: { type: String },
          bizName: { type: String },
          bizAlias: { type: String }
        }
      ],
      default: []
    },
    platforms: { type: [String], default: [] },
    group: { type: String, default: "" },
    registeredAt: { type: String, default: "" },
    lastLoginAt: { type: String, default: "" },
    botvnPassword: { type: String, select: false },
    tags: { type: [String], default: [] },

    extraInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, default: null },
    
    botvnRole: { 
      type: String, 
      enum: Object.values(BOTVN_ROLES),
    },
    isEduAccount: { type: Boolean, default: false },

    // Credits / Rewards
    rewardCredit: { type: Number, default: 0 },
    mainCredit: { type: Number, default: 0 },
    eduCredit: { type: Number, default: 0 },
    
    // Zalo
    zaloId: { type: String, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

// Remove empty/null phone/alias so sparse unique indices skip the document
customerSchema.pre("save", function () {
  if (!this.phone) {
    this.phone = undefined;
  }
  if (!this.alias) {
    this.alias = undefined;
  }
  if (!this.email) {
    this.email = undefined;
  }
  if (!this.zaloId) {
    this.zaloId = undefined;
  }
});

// Unique email and phone only for 'user' customers to allow multiple businesses (mainType: 'biz') to share emails/phones
customerSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { 
      email: { $type: "string" },
      mainType: CUSTOMER_MAIN_TYPES.USER 
    }
  }
);

customerSchema.index(
  { phone: 1 },
  {
    partialFilterExpression: { 
      phone: { $type: "string" },
      mainType: CUSTOMER_MAIN_TYPES.USER 
    }
  }
);

customerSchema.index(
  { zaloId: 1 },
  {
    unique: true,
    partialFilterExpression: { 
      zaloId: { $type: "string" },
      mainType: CUSTOMER_MAIN_TYPES.USER 
    }
  }
);

// Unique alias only for 'biz' customers to guarantee unique business handles
customerSchema.index(
  { alias: 1 },
  {
    unique: true,
    partialFilterExpression: { 
      alias: { $type: "string" },
      mainType: CUSTOMER_MAIN_TYPES.BIZ 
    }
  }
);

customerSchema.plugin(softDeletePlugin);
module.exports = mongoose.model("Customer", customerSchema);

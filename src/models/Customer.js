const mongoose = require("mongoose");
const { softDeletePlugin } = require("../utils/softDelete");
const { CUSTOMER_MAIN_TYPES } = require("../constants/appData");

const assigneeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    userAvatar: { type: String, default: "" },
    role: { type: String, required: true, trim: true },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: String, default: null },
  },
  { _id: false, id: false },
);

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
    alias: { type: String, default: "", trim: true, sparse: true, index: true },
    /** Loại khách hàng (legacy field, giữ để backward-compat) */
    type: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true, unique: true },
    phone: { type: String, index: true, unique: true, sparse: true },
    biz: { type: [String], default: [] },
    platforms: { type: [String], default: [] },
    group: { type: String, default: "" },
    registeredAt: { type: String, default: "" },
    lastLoginAt: { type: String, default: "" },
    tags: { type: [String], default: [] },
    assignees: { type: [assigneeSchema], default: [] },
    extraInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
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
});

customerSchema.plugin(softDeletePlugin);
module.exports = mongoose.model("Customer", customerSchema);

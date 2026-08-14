const mongoose = require("mongoose");

const eventGroupSchema = new mongoose.Schema(
  {
    /** ID slug — dùng làm primary key, VD: "user_moi", "botvn_user_moi" */
    id: { type: String, required: true, unique: true },

    /** Tên hiển thị — VD: "BotVN - User mới" */
    label: { type: String, required: true, trim: true },

    /** Màu badge */
    color: { type: String, default: "#3b82f6" },

    /** Màu nền badge */
    bg: { type: String, default: "#eff6ff" },

    /** Nguồn module — "smaxai", "botvn", "" = chung */
    source: { type: String, default: "" },

    /** true = seeded bởi hệ thống, không cho xoá */
    isSystem: { type: Boolean, default: false },

    /** Ẩn/hiện group */
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, id: false },
);

module.exports = mongoose.model("EventGroup", eventGroupSchema);

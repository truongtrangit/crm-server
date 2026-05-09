const mongoose = require("mongoose");
const { softDeletePlugin } = require("../utils/softDelete");
const { LEAD_STAGE_IDS } = require("../constants/leadStages");

const timelineEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["phone", "email", "event", "note"],
      default: "event",
    },
    title: { type: String, required: true, trim: true },
    time: { type: String, default: "" },
    content: { type: String, default: null },
    duration: { type: String, default: null },
    createdBy: { type: String, default: "" },
  },
  { _id: true, timestamps: true },
);

/** Mỗi nhân sự phụ trách — gắn 1 chức năng (StaffFunction) */
const assigneeSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    userName: { type: String, default: "" },
    userAvatar: { type: String, default: "" },
    functionId: { type: String, ref: "StaffFunction", default: null },
    functionTitle: { type: String, default: "" },
  },
  { _id: false },
);

const leadSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    email: { type: String, default: "", trim: true, lowercase: true, index: true },
    phone: { type: String, default: "", trim: true, index: true },

    /** Giai đoạn pipeline — enum 4 stages cố định */
    stage: {
      type: String,
      enum: LEAD_STAGE_IDS,
      default: "lead_moi",
      index: true,
    },

    /** Ref Customer — auto-mapped khi tạo/cập nhật nếu email/phone khớp */
    customerId: { type: String, ref: "Customer", default: null },

    /** Nhiều nhân sự phụ trách, mỗi người 1 chức năng */
    assignees: [assigneeSchema],

    /** Địa chỉ */
    address: {
      province: { type: String, default: "" },
      district: { type: String, default: "" },
      ward: { type: String, default: "" },
    },
    street: { type: String, default: "" },

    source: { type: String, default: "CRM" },
    tags: [{ type: String }],
    note: { type: String, default: "" },

    /** Giữ lại để dùng sau cho hệ thống LeadStatus/LeadStatusGroup */
    statusId: { type: String, default: null },
    groupId: { type: String, default: null },

    timeline: [timelineEntrySchema],
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

leadSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("Lead", leadSchema);

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

/** Lịch sử thao tác nội bộ — thay thế SystemLog cho lead */
const activityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["create", "update", "delete", "stage_change", "assign", "unassign", "add_tag", "remove_tag", "add_discussion", "add_timeline"],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    performedBy: {
      userId: { type: String, default: null },
      userName: { type: String, default: "System" },
      userAvatar: { type: String, default: "" },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: true, timestamps: true },
);

/** Bình luận / thảo luận trong lead */
const discussionSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true },
    createdBy: {
      userId: { type: String, required: true },
      userName: { type: String, default: "" },
      userAvatar: { type: String, default: "" },
    },
  },
  { _id: true, timestamps: true },
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
    funnelId: { type: String, ref: "Funnel", default: null, index: true },
    groupId: { type: String, default: null },

    timeline: [timelineEntrySchema],

    /** Lịch sử thao tác nội bộ — thay thế SystemLog cho lead */
    activityLogs: [activityLogSchema],

    /** Bình luận / thảo luận */
    discussions: [discussionSchema],
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

leadSchema.plugin(softDeletePlugin);

module.exports = mongoose.model("Lead", leadSchema);

const mongoose = require("mongoose");

const jobFolderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // JBF...
    name: { type: String, required: true, trim: true },
    parentId: { type: String, ref: "JobFolder", default: null }, // Hỗ trợ tree
    order: { type: Number, default: 0 },
    icon: { type: String, default: "fa-regular fa-folder" },
    color: { type: String, default: "#64748b" },
    isSystem: { type: Boolean, default: false }, // Ví dụ: Thư mục "Chung" không được xoá
    customStatuses: { type: [String], default: null }, // Array of status IDs, null means use global
    assignees: { type: [String], default: [] }, // Array of User IDs who can access this folder
    createdBy: { type: String, default: null }, // User ID who created this folder
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("JobFolder", jobFolderSchema);

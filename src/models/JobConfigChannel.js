const mongoose = require("mongoose");

const jobChannelSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // JCH...
    name: { type: String, required: true, trim: true },
    shortDescription: { type: String, default: "" }, // Mô tả ngắn gọn
    description: { type: String, default: "" }, // Rich text HTML
    icon: { type: String, default: "fa-solid fa-share-nodes" },
    color: { type: String, default: "#1f2937" },
    parentId: { type: String, ref: "JobConfigChannel", default: null }, // Self-referencing ID (not ObjectId)
    urls: { type: [String], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  }
);

module.exports = mongoose.model("JobConfigChannel", jobChannelSchema);

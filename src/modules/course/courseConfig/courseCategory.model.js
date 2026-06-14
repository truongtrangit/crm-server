const mongoose = require("mongoose");

const courseCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    parentId: { type: String, ref: "CourseCategory", default: null },
    icon: { type: String, default: null }, // font-awesome class
    logo: { type: String, default: null }, // URL
    color: { type: String, default: "#0668e1" }, // hex color
  },
  { timestamps: true, versionKey: false, id: false }
);

courseCategorySchema.index({ parentId: 1 });

module.exports = mongoose.model("CourseCategory", courseCategorySchema);

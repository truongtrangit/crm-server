const mongoose = require("mongoose");
const slugify = require("slugify");

const courseLecturerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    title: { type: String, trim: true, default: null },
    bio: { type: String, default: null }, // HTML rich text
    shortDescription: { type: String, trim: true, default: null }, // Frontend 1 line description
    slug: { type: String, unique: true }, // Auto generated
    tags: [{ type: String }], // Tags & Lĩnh vực
    avatar: { type: String, default: null },
    rating: { type: Number, default: 5.0 },
    socialLinks: {
      facebook: { type: String, default: null },
      linkedin: { type: String, default: null },
      youtube: { type: String, default: null },
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false }, // Nổi bật
    createdBy: { type: String, required: true }, // userId of creator
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, id: false },
);

module.exports = mongoose.model("CourseLecturer", courseLecturerSchema);

const mongoose = require("mongoose");

const lecturerSchema = new mongoose.Schema(
  {
    lecturerId: {
      type: String,
      required: true,
      ref: "CourseLecturer",
    },
    isMain: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const lessonSchema = new mongoose.Schema(
  {
    id: { type: String },
    title: { type: String, required: true },
    duration: { type: Number, default: 0 },
    accessLevel: { type: String, enum: ["Free", "Paid"], default: "Paid" },
    videoUrl: { type: String, default: "" },
    attachments: [
      {
        name: { type: String },
        url: { type: String },
      },
    ],
    description: { type: String, default: "" },
  },
  { _id: false }
);

const chapterSchema = new mongoose.Schema(
  {
    id: { type: String },
    title: { type: String, required: true },
    lessons: { type: [lessonSchema], default: [] },
  },
  { _id: false }
);

const courseOnlineSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      required: true,
    },
    category: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "published", "private", "expired"],
      default: "draft",
    },
    type: {
      type: String,
      default: "online",
    },
    isBestseller: {
      type: Boolean,
      default: false,
    },
    headline: {
      type: String,
      default: "",
    },
    subheadline: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      default: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
    },
    discountRate: {
      type: Number,
      default: 0,
    },
    covers: {
      type: [String],
      default: [],
    },
    previewVideo: {
      type: [String],
      default: [],
    },
    benefits: {
      type: [String],
      default: [],
    },
    tools: {
      type: [String],
      default: [],
    },
    requirements: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    targetAudience: {
      type: String,
      default: "",
    },
    description: {
      type: String, // Rich HTML
      default: "",
    },
    lecturers: {
      type: [lecturerSchema],
      default: [],
    },
    curriculum: {
      type: [chapterSchema],
      default: [],
    },
    createdBy: {
      type: String, // req.user.id
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

module.exports = mongoose.model("CourseOnline", courseOnlineSchema);

const mongoose = require("mongoose");
const {
  COURSE_CHALLENGE_STATUS,
  COURSE_CHALLENGE_TYPE,
} = require("../../../core/constants/courseChallenge");

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
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

lecturerSchema.virtual("details", {
  ref: "CourseLecturer",
  localField: "lecturerId",
  foreignField: "id",
  justOne: true,
});

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
  { _id: false },
);

const challengeDaySchema = new mongoose.Schema(
  {
    id: { type: String },
    title: { type: String, required: true },
    lessons: { type: [lessonSchema], default: [] },
    unlockDelayHours: { type: Number, default: 0 },
    unlockAt: { type: Date, default: null },
  },
  { _id: false },
);

const courseChallengeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    isTemplate: {
      type: Boolean,
      default: false,
    },
    templateId: {
      type: String,
      default: "",
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
      type: [{
        type: String,
        ref: "CourseCategory",
      }],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(COURSE_CHALLENGE_STATUS),
      default: COURSE_CHALLENGE_STATUS.DRAFT,
    },
    type: {
      type: String,
      enum: Object.values(COURSE_CHALLENGE_TYPE),
      default: COURSE_CHALLENGE_TYPE.FIXED_DATE,
    },
    startDate: {
      type: Date,
      default: null,
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
    totalDays: {
      type: Number,
      default: 0,
    },
    allowAdvanceSubmit: {
      type: Boolean,
      default: false,
    },
    allowLateSubmission: {
      type: Boolean,
      default: false, // For Fixed Date
    },
    autoUnlockNext: {
      type: Boolean,
      default: false, // For Rolling
    },
    curriculum: {
      type: [challengeDaySchema],
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

courseChallengeSchema.virtual("categoryDetails", {
  ref: "CourseCategory",
  localField: "category",
  foreignField: "id",
  justOne: false,
});

module.exports = mongoose.model("CourseChallenge", courseChallengeSchema);

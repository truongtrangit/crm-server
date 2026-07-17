const mongoose = require("mongoose");
const {
  COURSE_TYPES,
  SUBMISSION_LEVEL,
  SUBMISSION_STATUS,
} = require("../../../core/constants/appData");

const linkSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    label: { type: String, default: "" },
  },
  { _id: false },
);

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String },
    url: { type: String },
    fileType: { type: String },
  },
  { _id: false },
);

const courseSubmissionSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },

    // === Context ===
    courseId: { type: String, required: true, index: true },
    courseType: {
      type: String,
      enum: Object.values(COURSE_TYPES),
      required: true,
    },
    enrollmentId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },

    // === Scope ===
    submissionLevel: {
      type: String,
      enum: [SUBMISSION_LEVEL.LESSON, SUBMISSION_LEVEL.CHAPTER, SUBMISSION_LEVEL.COURSE],
      required: true,
    },
    targetId: { type: String, required: true },
    // lesson level → targetId = lessonId
    // chapter level → targetId = chapterId
    // course level → targetId = courseId

    // === Nội dung nộp ===
    links: { type: [linkSchema], default: [] },
    content: { type: String, default: "" }, // Rich HTML
    attachments: { type: [attachmentSchema], default: [] },

    // === Grading ===
    status: {
      type: String,
      enum: Object.values(SUBMISSION_STATUS),
      default: SUBMISSION_STATUS.PENDING,
    },
    grade: { type: Number, default: null },
    feedback: { type: String, default: "" },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },

    submittedAt: { type: Date, default: Date.now },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// 1 student, 1 active submission per target per level
courseSubmissionSchema.index(
  { enrollmentId: 1, submissionLevel: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

module.exports = mongoose.model("CourseSubmission", courseSubmissionSchema);

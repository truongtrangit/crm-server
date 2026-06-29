const mongoose = require("mongoose");
const { COURSE_ENROLLMENT_STATUS, COURSE_TYPES, PAYMENT_METHODS } = require("../../../core/constants/appData");

const progressSchema = new mongoose.Schema(
  {
    dayId: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    submissionUrl: { type: String, default: "" },
    submissionText: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { _id: false },
);

const courseEnrollmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
    },
    courseId: {
      type: String,
      required: true,
    },
    studentId: {
      type: String,
      required: true,
    },
    courseType: {
      type: String,
      enum: Object.values(COURSE_TYPES),
      default: COURSE_TYPES.CHALLENGE,
    },
    packageId: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      default: PAYMENT_METHODS.CREDIT,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(COURSE_ENROLLMENT_STATUS || { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' }),
      default: 'ACTIVE',
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    progress: {
      type: [progressSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

module.exports = mongoose.model(
  "CourseEnrollment",
  courseEnrollmentSchema,
);

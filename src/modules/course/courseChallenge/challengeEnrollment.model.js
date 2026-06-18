const mongoose = require("mongoose");

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

const challengeEnrollmentSchema = new mongoose.Schema(
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
  "ChallengeEnrollment",
  challengeEnrollmentSchema,
);

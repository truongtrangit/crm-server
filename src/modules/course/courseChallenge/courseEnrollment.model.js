const mongoose = require('mongoose');
const {
  COURSE_ENROLLMENT_STATUS,
  COURSE_TYPES,
  PAYMENT_METHODS,
} = require('../../../core/constants/appData');

const progressSchema = new mongoose.Schema(
  {
    dayId: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    submissionUrl: { type: String, default: '' },
    submissionText: { type: String, default: '' },
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
      default: PAYMENT_METHODS.MAIN_CREDIT,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(
        COURSE_ENROLLMENT_STATUS || { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' },
      ),
      default: COURSE_ENROLLMENT_STATUS
        ? COURSE_ENROLLMENT_STATUS.ACTIVE
        : 'ACTIVE',
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    progress: {
      type: [progressSchema],
      default: [],
    },
    lastLessonIndex: {
      type: Number,
      default: 0,
    },
    internalNote: {
      type: String,
      default: '',
    },
    transactionGroupId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

module.exports = mongoose.model('CourseEnrollment', courseEnrollmentSchema);

// ─── Indexes ─────────────────────────────────────────────────────────────────
// Already unique via schema definition
// courseEnrollmentSchema.index({ id: 1 }, { unique: true });  // declared above

// getEnrollmentsByCourseId  — filter by courseId, sort by enrolledAt
courseEnrollmentSchema.index({ courseId: 1, enrolledAt: -1 });

// getEnrollmentsByCourseId  — additional filters: status, packageId
courseEnrollmentSchema.index({ courseId: 1, status: 1, enrolledAt: -1 });
courseEnrollmentSchema.index({ courseId: 1, packageId: 1, enrolledAt: -1 });

// getAllEnrollments (admin list) — common multi-field filter combos
courseEnrollmentSchema.index({ enrolledAt: -1 });                              // default sort
courseEnrollmentSchema.index({ courseType: 1, enrolledAt: -1 });
courseEnrollmentSchema.index({ status: 1, enrolledAt: -1 });
courseEnrollmentSchema.index({ paymentMethod: 1, enrolledAt: -1 });
courseEnrollmentSchema.index({ courseId: 1, courseType: 1, status: 1, enrolledAt: -1 });
courseEnrollmentSchema.index({ paymentMethod: 1, courseType: 1, enrolledAt: -1 });

// getEnrollmentStats — countDocuments by status, must be efficient
courseEnrollmentSchema.index({ status: 1 });

// getMyEnrollments (student view) — filter by studentId, sort by enrolledAt
courseEnrollmentSchema.index({ studentId: 1, enrolledAt: -1 });

// updateProgress & updateEnrollmentStatus — point lookup by {id, studentId}
courseEnrollmentSchema.index({ id: 1, studentId: 1 });

// transactionGroupId — used occasionally for grouping/lookup
courseEnrollmentSchema.index({ transactionGroupId: 1 });

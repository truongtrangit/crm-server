const mongoose = require('mongoose');

const VALID_EVENT_TYPES = ['access', 'play', 'pause', 'seek', 'ended', 'devtools_detected', 'extension_detected'];

const videoAccessLogSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    courseType: {
      type: String,
      enum: ['online', 'challenge'],
      required: true,
    },
    lessonId: { type: String, required: true },
    eventType: {
      type: String,
      enum: VALID_EVENT_TYPES,
      default: 'access',
    },
    eventData: {
      currentTime: { type: Number },
      duration: { type: Number },
      seekFrom: { type: Number },
    },
    ip: { type: String },
    userAgent: { type: String },
    accessedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

// TTL Index — tự xóa log sau 90 ngày
videoAccessLogSchema.index(
  { accessedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

// Compound index cho query phát hiện suspicious behavior
videoAccessLogSchema.index({ studentId: 1, accessedAt: -1 });

module.exports = mongoose.model('VideoAccessLog', videoAccessLogSchema);
module.exports.VALID_EVENT_TYPES = VALID_EVENT_TYPES;

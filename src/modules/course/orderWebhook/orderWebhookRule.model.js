const mongoose = require('mongoose');
const {
  ORDER_WEBHOOK_EVENTS,
  ORDER_WEBHOOK_SCOPE_TYPES,
  COURSE_TYPES,
} = require('../../../core/constants/appData');

const orderWebhookRuleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 100, trim: true },
    events: [{
      type: String,
      enum: Object.values(ORDER_WEBHOOK_EVENTS),
      required: true,
    }],
    scope: {
      type: {
        type: String,
        enum: Object.values(ORDER_WEBHOOK_SCOPE_TYPES),
        required: true,
      },
      courseTypes: [{
        type: String,
        enum: Object.values(COURSE_TYPES),
      }],
      specificCourses: [{
        _id: false,
        courseId: { type: String, required: true },
        courseName: { type: String, required: true },
        courseModelType: { type: String, enum: ['CourseOnline', 'CourseOffline', 'CourseChallenge'], required: true },
      }],
    },
    url: { type: String, required: true, trim: true },
    headers: [{
      _id: false,
      key: { type: String, required: true, trim: true },
      value: { type: String, required: true, trim: true },
    }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

orderWebhookRuleSchema.index({ 'events': 1, isActive: 1 });
orderWebhookRuleSchema.index({ 'scope.type': 1 });
orderWebhookRuleSchema.index({ 'scope.specificCourses.courseId': 1 });

module.exports = mongoose.model('OrderWebhookRule', orderWebhookRuleSchema);

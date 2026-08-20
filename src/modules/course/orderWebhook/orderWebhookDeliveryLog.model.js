const mongoose = require('mongoose');
const {
  ORDER_WEBHOOK_EVENTS,
  ORDER_WEBHOOK_DELIVERY_STATUSES,
} = require('../../../core/constants/appData');

const orderWebhookDeliveryLogSchema = new mongoose.Schema(
  {
    ruleId: { type: String, required: true },
    ruleName: { type: String, default: null },
    event: {
      type: String,
      enum: Object.values(ORDER_WEBHOOK_EVENTS),
      required: true,
    },
    targetUrl: { type: String, required: true },
    orderId: { type: String, default: null },
    courseId: { type: String, default: null },
    courseName: { type: String, default: null },
    /** Full payload gửi đi */
    requestPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    /** HTTP status code trả về từ server đích */
    httpStatus: { type: Number, default: null },
    /** Response body trả về (truncated ≤500 chars) */
    responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
    /** Trạng thái delivery */
    status: {
      type: String,
      enum: Object.values(ORDER_WEBHOOK_DELIVERY_STATUSES),
      required: true,
    },
    /** Error message nếu gửi thất bại */
    error: { type: String, default: null },
    /** Thời gian gửi (ms) */
    durationMs: { type: Number, default: null },
    sentAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

orderWebhookDeliveryLogSchema.index({ ruleId: 1, sentAt: -1 });
orderWebhookDeliveryLogSchema.index({ orderId: 1 });
orderWebhookDeliveryLogSchema.index({ status: 1, sentAt: -1 });

module.exports = mongoose.model('OrderWebhookDeliveryLog', orderWebhookDeliveryLogSchema);

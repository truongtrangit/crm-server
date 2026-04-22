const Joi = require("joi");
const {
  WEBHOOK_EVENT_TYPE_LIST,
} = require("../constants/webhookEvents");

/**
 * Webhook ingest payload schema.
 *
 * eventType: phải là 1 trong các event type đã định nghĩa
 * payload:   object, cấu trúc tùy thuộc vào eventType — không restrict fields
 * timestamp: optional, ISO date string từ 3rd party
 * source:    optional, tên service gửi
 */
const webhookIngestSchema = Joi.object({
  eventType: Joi.string()
    .valid(...WEBHOOK_EVENT_TYPE_LIST)
    .required()
    .messages({
      "any.only": `eventType phải là một trong: ${WEBHOOK_EVENT_TYPE_LIST.join(", ")}`,
      "any.required": "eventType là bắt buộc",
    }),

  payload: Joi.object()
    .required()
    .messages({
      "object.base": "payload phải là một object",
      "any.required": "payload là bắt buộc",
    }),

  timestamp: Joi.string().isoDate().optional(),

  source: Joi.string().trim().max(100).optional(),
});

module.exports = { webhookIngestSchema };

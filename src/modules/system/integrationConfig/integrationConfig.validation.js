const Joi = require("joi");
const {
  INTEGRATION_ACTION_TYPES,
  INTEGRATION_CONFIG_STATUSES,
} = require("../../../core/constants/integrationConfig");

const actionSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(INTEGRATION_ACTION_TYPES))
    .required(),
  enabled: Joi.boolean().optional(),
  config: Joi.when('type', {
    is: INTEGRATION_ACTION_TYPES.CREATE_LEAD,
    then: Joi.object({
      funnelId: Joi.string().required().messages({
        'any.required': 'Phễu Chăm Sóc (funnelId) là bắt buộc khi tạo Lead',
        'string.empty': 'Phễu Chăm Sóc (funnelId) là bắt buộc khi tạo Lead',
      }),
    }).unknown(true).required(),
    otherwise: Joi.object().optional(),
  }),
});

const fieldMappingSchema = Joi.object()
  .pattern(Joi.string(), Joi.string().trim().allow(''))
  .optional();

const createIntegrationConfigSchema = Joi.object({
  source: Joi.string().trim().required().messages({
    "any.required": "source is required",
  }),
  eventType: Joi.string().trim().required().messages({
    "any.required": "eventType is required",
  }),
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  description: Joi.string().trim().allow("").optional(),
  actions: Joi.array().items(actionSchema).min(1).required().messages({
    "any.required": "actions is required",
    "array.min": "Phải có ít nhất 1 action",
  }),
  fieldMapping: fieldMappingSchema.optional(),
  status: Joi.string()
    .valid(...Object.values(INTEGRATION_CONFIG_STATUSES))
    .optional(),
});

const updateIntegrationConfigSchema = Joi.object({
  source: Joi.string().trim().optional(),
  eventType: Joi.string().trim().optional(),
  name: Joi.string().trim().optional(),
  description: Joi.string().trim().allow("").optional(),
  actions: Joi.array().items(actionSchema).min(1).optional(),
  fieldMapping: fieldMappingSchema.optional(),
  status: Joi.string()
    .valid(...Object.values(INTEGRATION_CONFIG_STATUSES))
    .optional(),
});

module.exports = {
  createIntegrationConfigSchema,
  updateIntegrationConfigSchema,
};

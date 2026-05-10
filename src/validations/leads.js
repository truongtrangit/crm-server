const Joi = require("joi");
const { LEAD_STAGE_IDS } = require("../constants/leadStages");

const assigneeItemSchema = Joi.object({
  userId: Joi.string().required(),
  functionId: Joi.string().allow(null, "").optional(),
});

const addressSchema = Joi.object({
  province: Joi.string().allow("").optional(),
  district: Joi.string().allow("").optional(),
  ward: Joi.string().allow("").optional(),
});

const createLeadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  phone: Joi.string().allow("").max(20).optional(),
  email: Joi.string().email().allow("").optional(),
  stage: Joi.string().valid(...LEAD_STAGE_IDS).default("lead_moi"),
  funnelId: Joi.string().max(50).required(),
  statusId: Joi.string().allow(null, "").max(50).optional(),
  address: addressSchema.optional(),
  street: Joi.string().allow("").max(500).optional(),
  note: Joi.string().allow("").max(5000).optional(),
  source: Joi.string().allow("").max(100).optional(),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  assignees: Joi.array().items(assigneeItemSchema).max(10).optional(),
  avatar: Joi.string().allow("").optional(),
});

const updateLeadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  phone: Joi.string().allow("").max(20).optional(),
  email: Joi.string().email().allow("").optional(),
  stage: Joi.string().valid(...LEAD_STAGE_IDS).optional(),
  funnelId: Joi.string().allow(null, "").max(50).optional(),
  statusId: Joi.string().allow(null, "").max(50).optional(),
  address: addressSchema.optional(),
  street: Joi.string().allow("").max(500).optional(),
  note: Joi.string().allow("").max(5000).optional(),
  source: Joi.string().allow("").max(100).optional(),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  assignees: Joi.array().items(assigneeItemSchema).max(10).optional(),
  avatar: Joi.string().allow("").optional(),
});

const listLeadsQuerySchema = Joi.object({
  search: Joi.string().allow("").max(200).optional(),
  stage: Joi.string().valid(...LEAD_STAGE_IDS).optional(),
  lastId: Joi.string().max(20).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).unknown(true);

module.exports = {
  createLeadSchema,
  updateLeadSchema,
  listLeadsQuerySchema,
};

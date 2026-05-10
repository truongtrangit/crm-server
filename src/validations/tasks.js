const Joi = require("joi");

const assigneeItemSchema = Joi.object({
  userId: Joi.string().required(),
  functionId: Joi.string().allow(null, "").optional(),
});

const createTaskSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  assignees: Joi.array().items(assigneeItemSchema).max(10).optional(),
  note: Joi.string().allow("").max(5000).optional(),
});

const updateTaskSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  status: Joi.string().valid("active", "closed").optional(),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
  assignees: Joi.array().items(assigneeItemSchema).max(10).optional(),
  note: Joi.string().allow("").max(5000).optional(),
});

const linkEventSchema = Joi.object({
  eventId: Joi.string().trim().required(),
});

const linkLeadSchema = Joi.object({
  leadId: Joi.string().trim().required(),
});

const listTasksQuerySchema = Joi.object({
  search: Joi.string().allow("").max(200).optional(),
  status: Joi.string().valid("active", "closed").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).unknown(true);

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  linkEventSchema,
  linkLeadSchema,
  listTasksQuerySchema,
};

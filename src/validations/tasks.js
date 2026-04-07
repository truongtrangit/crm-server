const Joi = require("joi");

const createTaskSchema = Joi.object({
  action: Joi.string().trim().optional(),
  name: Joi.string().trim().optional(),
  time: Joi.string().allow("").optional(),
  timeType: Joi.string().valid("soon", "late", "future").optional(),
  customer: Joi.object({
    name: Joi.string().trim().required().messages({
      "any.required": "customer.name is required",
    }),
    avatar: Joi.string().allow("").optional(),
    email: Joi.string().allow("").optional(),
    phone: Joi.string().allow("").optional(),
  }).required().messages({
    "any.required": "customer is required",
  }),
  platform: Joi.string().allow("").optional(),
  assignee: Joi.object({
    name: Joi.string().allow("").optional(),
    avatar: Joi.string().allow("").optional(),
  }).optional(),
  status: Joi.string().allow("").optional(),
}).custom((value, helpers) => {
  if (!value.action && !value.name) {
    return helpers.error("any.custom", {
      message: "action or name is required",
    });
  }
  return value;
}).messages({
  "any.custom": "{{#message}}",
});

const updateTaskSchema = Joi.object({
  action: Joi.string().trim().optional(),
  name: Joi.string().trim().optional(),
  time: Joi.string().allow("").optional(),
  timeType: Joi.string().valid("soon", "late", "future").optional(),
  customer: Joi.object({
    name: Joi.string().trim().optional(),
    avatar: Joi.string().allow("").optional(),
    email: Joi.string().allow("").optional(),
    phone: Joi.string().allow("").optional(),
  }).optional(),
  platform: Joi.string().allow("").optional(),
  assignee: Joi.object({
    name: Joi.string().allow("").optional(),
    avatar: Joi.string().allow("").optional(),
  }).optional(),
  status: Joi.string().allow("").optional(),
}).min(1).messages({
  "object.min": "At least one field is required to update",
});

const listTasksQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  platform: Joi.string().allow("").optional(),
  assignee: Joi.string().allow("").optional(),
  status: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
};

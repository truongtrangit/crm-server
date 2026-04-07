const Joi = require("joi");

const createDepartmentSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  alias: Joi.string().trim().allow("").optional(),
});

const createGroupSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  desc: Joi.string().allow("").optional(),
  parentId: Joi.string().optional(),
  parentAlias: Joi.string().optional(),
  alias: Joi.string().trim().allow("").optional(),
}).custom((value, helpers) => {
  if (!value.parentId && !value.parentAlias) {
    return helpers.error("any.custom", {
      message: "parentId or parentAlias is required",
    });
  }
  return value;
}).messages({
  "any.custom": "{{#message}}",
});

module.exports = {
  createDepartmentSchema,
  createGroupSchema,
};

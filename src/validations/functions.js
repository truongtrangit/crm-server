const Joi = require("joi");

const createFunctionSchema = Joi.object({
  title: Joi.string().trim().required().messages({
    "any.required": "title is required",
  }),
  desc: Joi.string().allow("").optional(),
  type: Joi.string().allow("").optional(),
});

module.exports = {
  createFunctionSchema,
};

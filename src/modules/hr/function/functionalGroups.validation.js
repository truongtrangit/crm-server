const Joi = require("joi");

const createFunctionalGroupSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "Tên khối không được để trống",
    "string.empty": "Tên khối không được để trống"
  }),
  desc: Joi.string().allow("").optional(),
  isActive: Joi.boolean().optional(),
});

const updateFunctionalGroupSchema = Joi.object({
  name: Joi.string().trim().optional(),
  desc: Joi.string().allow("").optional(),
  isActive: Joi.boolean().optional(),
});

module.exports = {
  createFunctionalGroupSchema,
  updateFunctionalGroupSchema,
};

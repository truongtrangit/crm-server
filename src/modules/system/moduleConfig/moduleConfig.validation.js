const Joi = require('joi');
const { SIDEBAR_SYSTEM_MODULES } = require('../../../core/constants/rbac');

const moduleFieldsSchema = Object.keys(SIDEBAR_SYSTEM_MODULES).reduce((acc, key) => {
  acc[key] = Joi.boolean().optional();
  return acc;
}, {});

const updateModuleConfigSchema = Joi.object({
  modules: Joi.object(moduleFieldsSchema).required().min(1).messages({
    'any.required': 'modules is required',
    'object.min': 'At least one module state must be provided',
  }),
});

module.exports = {
  updateModuleConfigSchema,
};


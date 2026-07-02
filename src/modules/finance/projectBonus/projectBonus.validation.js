const Joi = require('joi');

const projectBonusGroupSchema = Joi.object({
  name: Joi.string().required(),
  contractValue: Joi.string().allow('', null),
  referrer: Joi.string().allow('', null),
  marketing: Joi.string().allow('', null),
  dev: Joi.string().allow('', null),
  sale: Joi.string().allow('', null),
  support: Joi.string().allow('', null),
});

const createProjectBonusSchema = Joi.object({
  name: Joi.string().required(),
  groups: Joi.array().items(projectBonusGroupSchema).default([]),
});

const updateProjectBonusSchema = Joi.object({
  name: Joi.string(),
  groups: Joi.array().items(projectBonusGroupSchema),
}).min(1);

module.exports = {
  createProjectBonusSchema,
  updateProjectBonusSchema,
};

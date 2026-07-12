const { KNOWLEDGE_STATUS } = require('../../../core/constants/appData');
const Joi = require('joi');

const createKnowledgeSchema = Joi.object({
  title: Joi.string().required().trim(),
  slug: Joi.string().trim().optional(),
  description: Joi.string().optional().allow(''),
  coverImage: Joi.string().optional().allow(''),
  status: Joi.string().valid(...Object.values(KNOWLEDGE_STATUS)).optional(),
  
  content: Joi.string().optional().allow(''),

  category: Joi.array().items(Joi.string()).optional(),
  author: Joi.string().optional().allow(''),
  isHot: Joi.boolean().optional(),
});

const updateKnowledgeSchema = Joi.object({
  title: Joi.string().trim().optional(),
  slug: Joi.string().trim().optional(),
  description: Joi.string().optional().allow(''),
  coverImage: Joi.string().optional().allow(''),
  status: Joi.string().valid(...Object.values(KNOWLEDGE_STATUS)).optional(),
  
  content: Joi.string().optional().allow(''),

  category: Joi.array().items(Joi.string()).optional(),
  author: Joi.string().optional().allow(''),
  isHot: Joi.boolean().optional(),
});

const categorySchema = Joi.object({
  name: Joi.string().required().trim(),
  parentId: Joi.string().optional().allow(''),
  icon: Joi.string().optional().allow(''),
  logo: Joi.string().optional().allow(''),
  color: Joi.string().optional().allow(''),
});



module.exports = {
  createKnowledgeSchema,
  updateKnowledgeSchema,
  categorySchema,
};

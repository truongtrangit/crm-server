const Joi = require('joi');

const subCategorySchema = Joi.object({
  id: Joi.string().allow('', null).optional(),
  name: Joi.string().trim().required().messages({
    'string.empty': 'Tên danh mục con không được để trống',
    'any.required': 'Tên danh mục con là bắt buộc'
  }),
  isActive: Joi.boolean().default(true)
});

const createCategorySchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Tên danh mục không được để trống',
    'any.required': 'Tên danh mục là bắt buộc'
  }),
  description: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean().default(true),
  subCategories: Joi.array()
    .items(subCategorySchema)
    .unique((a, b) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase())
    .messages({
      'array.unique': 'Tên danh mục con bị trùng lặp'
    })
    .default([])
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().messages({
    'string.empty': 'Tên danh mục không được để trống'
  }),
  description: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean(),
  subCategories: Joi.array()
    .items(subCategorySchema)
    .unique((a, b) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase())
    .messages({
      'array.unique': 'Tên danh mục con bị trùng lặp'
    })
    .default([])
}).min(1);

module.exports = {
  createCategorySchema,
  updateCategorySchema
};

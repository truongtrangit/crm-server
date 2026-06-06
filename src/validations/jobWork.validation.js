const Joi = require("joi");

const createJobFolderSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  parentId: Joi.string().allow(null, "").optional(),
  icon: Joi.string().allow("", null).max(100).optional(),
  color: Joi.string().allow("", null).max(30).optional(),
  order: Joi.number().integer().min(0).optional(),
  customStatuses: Joi.array().items(Joi.string()).allow(null).optional(),
  assignees: Joi.array().items(Joi.string()).optional(),
});

const updateJobFolderSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  parentId: Joi.string().allow(null, "").optional(),
  icon: Joi.string().allow("", null).max(100).optional(),
  color: Joi.string().allow("", null).max(30).optional(),
  order: Joi.number().integer().min(0).optional(),
  customStatuses: Joi.array().items(Joi.string()).allow(null).optional(),
  assignees: Joi.array().items(Joi.string()).optional(),
});

const reorderJobFoldersSchema = Joi.object({
  orderedIds: Joi.array().items(Joi.string().required()).min(1).unique().required(),
});

const checklistItemSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  assignees: Joi.array().items(Joi.string()).optional(),
  isCompleted: Joi.boolean().optional(),
  dueDate: Joi.date().allow(null, "").optional(),
});

const createJobTaskSchema = Joi.object({
  name: Joi.string().trim().min(1).max(300).required(),
  folderId: Joi.string().allow(null, "").optional(),
  jobChannelIds: Joi.array().items(Joi.string()).optional(),
  jobTaskTypeId: Joi.string().allow(null, "").optional(),
  statusId: Joi.string().required(),
  assignees: Joi.array().items(Joi.string()).optional(),
  scheduledDate: Joi.date().allow(null, "").optional(),
  dueDate: Joi.date().allow(null, "").optional(),
  details: Joi.string().allow("", null).optional(),
  shortDescription: Joi.string().allow("", null).max(500).optional(),
  checklists: Joi.array().items(checklistItemSchema).optional(),
});

const updateJobTaskSchema = Joi.object({
  name: Joi.string().trim().min(1).max(300).optional(),
  folderId: Joi.string().allow(null, "").optional(),
  jobChannelIds: Joi.array().items(Joi.string()).optional(),
  jobTaskTypeId: Joi.string().allow(null, "").optional(),
  statusId: Joi.string().optional(),
  assignees: Joi.array().items(Joi.string()).optional(),
  scheduledDate: Joi.date().allow(null, "").optional(),
  dueDate: Joi.date().allow(null, "").optional(),
  details: Joi.string().allow("", null).optional(),
  shortDescription: Joi.string().allow("", null).max(500).optional(),
  checklists: Joi.array().items(checklistItemSchema).optional(),
});

const updateJobTaskStatusSchema = Joi.object({
  statusId: Joi.string().required(),
});

module.exports = {
  createJobFolderSchema,
  updateJobFolderSchema,
  reorderJobFoldersSchema,
  createJobTaskSchema,
  updateJobTaskSchema,
  updateJobTaskStatusSchema,
};

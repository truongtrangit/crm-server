const Joi = require("joi");
const { JOB_STATUS_TYPES } = require("../constants/jobConfig");

const createJobConfigStatusSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string().valid(...JOB_STATUS_TYPES).required(),
  description: Joi.string().allow("", null).max(500).optional(),
  icon: Joi.string().allow("", null).max(100).optional(),
  color: Joi.string().allow("", null).max(30).optional(),
});

const updateJobConfigStatusSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  type: Joi.string().valid(...JOB_STATUS_TYPES).optional(),
  description: Joi.string().allow("", null).max(500).optional(),
  icon: Joi.string().allow("", null).max(100).optional(),
  color: Joi.string().allow("", null).max(30).optional(),
});

const reorderJobConfigStatusesSchema = Joi.object({
  orderedIds: Joi.array().items(Joi.string().required()).min(1).unique().required(),
});

const createJobConfigTaskTypeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().allow("", null).max(500).optional(),
  icon: Joi.string().allow("", null).max(100).optional(),
  color: Joi.string().allow("", null).max(30).optional(),
});

const updateJobConfigTaskTypeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().allow("", null).max(500).optional(),
  icon: Joi.string().allow("", null).max(100).optional(),
  color: Joi.string().allow("", null).max(30).optional(),
});

const createJobConfigChannelSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  shortDescription: Joi.string().allow("", null).optional(),
  description: Joi.string().allow("", null).optional(),
  icon: Joi.string().allow("", null).max(100).optional(),
  color: Joi.string().allow("", null).max(30).optional(),
  parentId: Joi.string().allow(null, "").optional(),
  urls: Joi.array().items(Joi.string().allow("", null)).optional(),
});

const updateJobConfigChannelSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  shortDescription: Joi.string().allow("", null).optional(),
  description: Joi.string().allow("", null).optional(),
  icon: Joi.string().allow("", null).max(100).optional(),
  color: Joi.string().allow("", null).max(30).optional(),
  parentId: Joi.string().allow(null, "").optional(),
  urls: Joi.array().items(Joi.string().allow("", null)).optional(),
});

const createJobConfigRepeatRuleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  channelIds: Joi.array().items(Joi.string()).min(1).required(),
  taskTypeId: Joi.string().required(),
  assignees: Joi.array().items(Joi.string()).max(50).optional(),
  cycleType: Joi.string().valid("weekly", "monthly").required(),
  cycleValues: Joi.array().items(Joi.number().integer().min(0).max(31)).required(),
  details: Joi.string().allow("", null).optional(),
  shortDescription: Joi.string().allow("", null).max(500).optional(),
  checklists: Joi.array().items(Joi.object({
    title: Joi.string().trim().required(),
    assignees: Joi.array().items(Joi.string()).optional(),
    isCompleted: Joi.boolean().optional(),
    dueDate: Joi.date().allow(null, "").optional(),
    dueOffsetHours: Joi.number().allow(null).optional()
  })).optional(),
  isActive: Joi.boolean().optional(),
});

const updateJobConfigRepeatRuleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  channelIds: Joi.array().items(Joi.string()).optional(),
  taskTypeId: Joi.string().optional(),
  assignees: Joi.array().items(Joi.string()).max(50).optional(),
  cycleType: Joi.string().valid("weekly", "monthly").optional(),
  cycleValues: Joi.array().items(Joi.number().integer().min(0).max(31)).optional(),
  details: Joi.string().allow("", null).optional(),
  shortDescription: Joi.string().allow("", null).max(500).optional(),
  checklists: Joi.array().items(Joi.object({
    title: Joi.string().trim().required(),
    assignees: Joi.array().items(Joi.string()).optional(),
    isCompleted: Joi.boolean().optional(),
    dueDate: Joi.date().allow(null, "").optional(),
    dueOffsetHours: Joi.number().allow(null).optional()
  })).optional(),
  isActive: Joi.boolean().optional(),
});

module.exports = {
  createJobConfigStatusSchema,
  updateJobConfigStatusSchema,
  reorderJobConfigStatusesSchema,
  createJobConfigTaskTypeSchema,
  updateJobConfigTaskTypeSchema,
  createJobConfigChannelSchema,
  updateJobConfigChannelSchema,
  createJobConfigRepeatRuleSchema,
  updateJobConfigRepeatRuleSchema,
};

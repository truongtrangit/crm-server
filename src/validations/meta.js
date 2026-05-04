const Joi = require("joi");

// ─── MetaConfig Validations ───────────────────────────────────────────────────

const metricDefSchema = Joi.object({
  name: Joi.string().trim().required(),
  unit: Joi.string().allow("").optional(),
});

const createMetaConfigSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "Tên loại chương trình là bắt buộc",
  }),
  badgeColor: Joi.string().allow("").optional(),
  icon: Joi.string().allow("").optional(),
  kpiType: Joi.string().valid("metric", "task").optional(),
  metrics: Joi.array().items(metricDefSchema).optional(),
  description: Joi.string().allow("").optional(),
  order: Joi.number().integer().min(0).optional(),
});

const updateMetaConfigSchema = Joi.object({
  name: Joi.string().trim().optional(),
  badgeColor: Joi.string().allow("").optional(),
  icon: Joi.string().allow("").optional(),
  kpiType: Joi.string().valid("metric", "task").optional(),
  metrics: Joi.array().items(metricDefSchema).optional(),
  description: Joi.string().allow("").optional(),
  order: Joi.number().integer().min(0).optional(),
})
  .min(1)
  .messages({ "object.min": "Cần ít nhất 1 trường để cập nhật" });

// ─── MetaProgram Validations ──────────────────────────────────────────────────

const kpiTargetSchema = Joi.object({
  metricName: Joi.string().trim().required(),
  unit: Joi.string().allow("").optional(),
  target: Joi.number().min(0).required(),
  current: Joi.number().min(0).optional(),
});

const createMetaProgramSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "Tên chương trình là bắt buộc",
  }),
  typeId: Joi.string().required().messages({
    "any.required": "Loại chương trình là bắt buộc",
  }),
  budgetType: Joi.string().valid("fixed", "range").optional(),
  budget: Joi.number().min(0).optional(),
  budgetMin: Joi.number().min(0).optional(),
  budgetMax: Joi.number().min(0).optional(),
  startDate: Joi.date().iso().required().messages({
    "any.required": "Ngày bắt đầu là bắt buộc",
  }),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).required().messages({
    "any.required": "Ngày kết thúc là bắt buộc",
    "date.min": "Ngày kết thúc phải sau ngày bắt đầu",
  }),
  picIds: Joi.array().items(Joi.string()).optional(),
  descriptionHtml: Joi.string().allow("").optional(),
  kpiTargets: Joi.array().items(kpiTargetSchema).optional(),
});

const updateMetaProgramSchema = Joi.object({
  name: Joi.string().trim().optional(),
  typeId: Joi.string().optional(),
  budgetType: Joi.string().valid("fixed", "range").optional(),
  budget: Joi.number().min(0).optional(),
  budgetMin: Joi.number().min(0).optional(),
  budgetMax: Joi.number().min(0).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  picIds: Joi.array().items(Joi.string()).optional(),
  descriptionHtml: Joi.string().allow("").optional(),
  kpiTargets: Joi.array().items(kpiTargetSchema).optional(),
})
  .min(1)
  .messages({ "object.min": "Cần ít nhất 1 trường để cập nhật" });

const listMetaProgramsQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  type: Joi.string().allow("").optional(),
  time: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sort: Joi.string().allow("").optional(),
  sortOrder: Joi.string().valid("asc", "desc").optional(),
});

// ─── Milestone ────────────────────────────────────────────────────────────────

const addMilestoneSchema = Joi.object({
  metricName: Joi.string().trim().required(),
  valueAdded: Joi.number().min(0).required(),
  note: Joi.string().allow("").optional(),
});

// ─── Task ─────────────────────────────────────────────────────────────────────

const createTaskSchema = Joi.object({
  title: Joi.string().trim().required().messages({
    "any.required": "Tên công việc là bắt buộc",
  }),
  picId: Joi.string().allow("", null).optional(),
  picName: Joi.string().allow("").optional(),
  deadline: Joi.date().iso().allow(null).optional(),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().trim().optional(),
  picId: Joi.string().allow("", null).optional(),
  picName: Joi.string().allow("").optional(),
  deadline: Joi.date().iso().allow(null).optional(),
  isCompleted: Joi.boolean().optional(),
})
  .min(1)
  .messages({ "object.min": "Cần ít nhất 1 trường để cập nhật" });

// ─── Attachment ───────────────────────────────────────────────────────────────

const addAttachmentSchema = Joi.object({
  fileName: Joi.string().trim().required().messages({
    "any.required": "Tên file là bắt buộc",
  }),
  url: Joi.string().uri().required().messages({
    "any.required": "URL là bắt buộc",
    "string.uri": "URL không hợp lệ",
  }),
});

module.exports = {
  createMetaConfigSchema,
  updateMetaConfigSchema,
  createMetaProgramSchema,
  updateMetaProgramSchema,
  listMetaProgramsQuerySchema,
  addMilestoneSchema,
  createTaskSchema,
  updateTaskSchema,
  addAttachmentSchema,
};

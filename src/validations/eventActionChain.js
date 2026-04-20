const Joi = require("joi");

const NEXT_STEP_TYPES = [
  "next_in_chain", "close_task", "close_chain",
  "close_chain_clone_task", "create_order", "call_block_automation", "add_from_other_chain",
];
const DELAY_UNITS = ["immediate", "minute", "hour", "day", "week"];

// Thêm chain vào event: chỉ cần chainId
const addChainToEventSchema = Joi.object({
  chainId: Joi.string().required().messages({
    "any.required": "chainId là bắt buộc",
    "string.base": "chainId phải là chuỗi",
  }),
});

// Cập nhật step hiện tại (Save result + reason + note)
const saveStepSchema = Joi.object({
  selectedResultId: Joi.string().allow(null, "").default(null),
  selectedReasonId: Joi.string().allow(null, "").default(null),
  note: Joi.string().allow("").max(1000).default(""),
  nextStepDelay: Joi.object({
    delayUnit:   Joi.string().valid(...DELAY_UNITS).allow(null).default(null),
    delayValue:  Joi.number().integer().min(0).allow(null).default(null),
    editNote:    Joi.string().allow("").max(500).default(""),
  }).default(null),
  // User override: chọn step nào kích hoạt tiếp theo
  nextStepOverride: Joi.object({
    targetStepOrder: Joi.number().integer().min(1).required(),
    delayUnit:   Joi.string().valid(...DELAY_UNITS).allow(null).default(null),
    delayValue:  Joi.number().integer().min(0).allow(null).default(null),
  }).allow(null).default(null),
});

// Thêm mới step vào chain (inject)
const injectStepSchema = Joi.object({
  actionId:        Joi.string().required().messages({ "any.required": "actionId là bắt buộc" }),
  delayUnit:  Joi.string().valid(...DELAY_UNITS).allow(null).default(null),
  delayValue: Joi.number().integer().min(0).allow(null).default(null),
  insertAfterOrder: Joi.number().integer().min(1).allow(null).default(null),
});

// Chỉnh sửa delay của step đang active
const updateStepDelaySchema = Joi.object({
  delayUnit:  Joi.string().valid(...DELAY_UNITS).allow(null),
  delayValue: Joi.number().integer().min(0).allow(null),
  editNote:   Joi.string().allow("").max(500),
});

// Chỉnh sửa note của step đã lock
const updateStepNoteSchema = Joi.object({
  note: Joi.string().allow("").max(1000).required(),
});

// Cấu hình kết quả cho step (thêm / cập nhật branch trên EventActionChain step)
const upsertStepBranchSchema = Joi.object({
  resultId:     Joi.string().required().messages({ "any.required": "resultId là bắt buộc" }),
  nextStepType: Joi.string().valid(...NEXT_STEP_TYPES).required().messages({
    "any.only": `nextStepType phải là 1 trong: ${NEXT_STEP_TYPES.join(", ")}`,
    "any.required": "nextStepType là bắt buộc",
  }),
  // Chỉ cần khi nextStepType === 'next_in_chain'
  nextActionId:  Joi.string().allow(null, "").default(null),
  // Chỉ cần khi nextStepType === 'close_task'
  closeOutcome:  Joi.string().valid("success", "failure").allow(null).default(null),
  // Delay tùy chọn
  delayUnit:  Joi.string().valid(...DELAY_UNITS).allow(null).default(null),
  delayValue: Joi.number().integer().min(0).allow(null).default(null),
});

module.exports = {
  addChainToEventSchema,
  saveStepSchema,
  injectStepSchema,
  updateStepDelaySchema,
  updateStepNoteSchema,
  upsertStepBranchSchema,
};

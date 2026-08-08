const Joi = require("joi");
const { SUBMISSION_LEVEL } = require("../../../core/constants/appData");

const linkSchema = Joi.object({
  url: Joi.string().uri().required(),
  label: Joi.string().allow("").optional(),
});

const attachmentSchema = Joi.object({
  name: Joi.string().optional(),
  url: Joi.string().uri().required(),
  fileType: Joi.string().optional(),
});

const submitAssignment = Joi.object({
  courseId: Joi.string().required(),
  courseType: Joi.string()
    .valid("CourseChallenge", "CourseOnline", "CourseOffline")
    .required(),
  enrollmentId: Joi.string().required(),
  submissionLevel: Joi.string()
    .valid("lesson", "chapter", "course")
    .required(),
  targetId: Joi.string().required(),
  links: Joi.array().items(linkSchema).min(0).optional(),
  content: Joi.string().allow("").optional(),
  attachments: Joi.array().items(attachmentSchema).min(0).optional(),
});

const updateSubmission = Joi.object({
  links: Joi.array().items(linkSchema).min(0).optional(),
  content: Joi.string().allow("").optional(),
  attachments: Joi.array().items(attachmentSchema).min(0).optional(),
});

const reviewSubmission = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
  feedback: Joi.string().allow("").optional(),
  grade: Joi.number().min(0).max(100).allow(null).optional(),
});

// Shared submissionSettings validation (reusable in course validations)
const submissionSettingsSchema = Joi.object({
  isCourseSubmissionRequired: Joi.boolean().optional(),
  requireToProgress: Joi.boolean().optional(),
  allowLateSubmission: Joi.boolean().optional(),
  lessonDeadlineHours: Joi.number().min(0).optional(),
  chapterDeadlineHours: Joi.number().min(0).optional(),
  courseDeadlineHours: Joi.number().min(0).optional(),
  courseDeadlineDate: Joi.date().iso().allow(null).optional(),
  allowAdvanceSubmit: Joi.boolean().optional(),
  autoUnlockNext: Joi.boolean().optional(),
})
  .custom((value, helpers) => {
    if (value && value.requireToProgress === true && value.allowLateSubmission === true) {
      return helpers.error("custom.requireToProgressLateSubmissionConflict");
    }
    return value;
  })
  .messages({
    "custom.requireToProgressLateSubmissionConflict":
      "Cho phép nộp bài trễ không thể bật khi Bắt buộc nộp bài mới cho sang bài/chương tiếp theo đang bật",
  })
  .optional();

module.exports = {
  submitAssignment,
  updateSubmission,
  reviewSubmission,
  submissionSettingsSchema,
};

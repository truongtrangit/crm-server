const express = require("express");
const router = express.Router();
const jobConfigController = require("../../controllers/JobConfigController");
const validate = require("../../middleware/validate");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");
const {
  createJobConfigStatusSchema,
  updateJobConfigStatusSchema,
  reorderJobConfigStatusesSchema,
  createJobConfigTaskTypeSchema,
  updateJobConfigTaskTypeSchema,
  createJobConfigChannelSchema,
  updateJobConfigChannelSchema,
  createJobConfigRepeatRuleSchema,
  updateJobConfigRepeatRuleSchema,
} = require("../../validations/jobConfig.validation");

// ==========================================
// STATUS CONFIG
// ==========================================
router
  .route("/statuses")
  .get(requirePermission(PERMISSIONS.JOBHUB_CONFIG_STATUS_READ), jobConfigController.getStatuses)
  .post(
    requirePermission(PERMISSIONS.JOBHUB_CONFIG_STATUS_CREATE),
    validate(createJobConfigStatusSchema),
    jobConfigController.createStatus
  );

router
  .route("/statuses/reorder")
  .patch(
    requirePermission(PERMISSIONS.JOBHUB_CONFIG_STATUS_UPDATE),
    validate(reorderJobConfigStatusesSchema),
    jobConfigController.reorderStatuses
  );

router
  .route("/statuses/:id")
  .put(
    requirePermission(PERMISSIONS.JOBHUB_CONFIG_STATUS_UPDATE),
    validate(updateJobConfigStatusSchema),
    jobConfigController.updateStatus
  )
  .delete(requirePermission(PERMISSIONS.JOBHUB_CONFIG_STATUS_DELETE), jobConfigController.deleteStatus);

// ==========================================
// TASK TYPE CONFIG
// ==========================================
router
  .route("/task-types")
  .get(requirePermission(PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_READ), jobConfigController.getTaskTypes)
  .post(
    requirePermission(PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_CREATE),
    validate(createJobConfigTaskTypeSchema),
    jobConfigController.createTaskType
  );

router
  .route("/task-types/:id")
  .put(
    requirePermission(PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_UPDATE),
    validate(updateJobConfigTaskTypeSchema),
    jobConfigController.updateTaskType
  )
  .delete(requirePermission(PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_DELETE), jobConfigController.deleteTaskType);

// ==========================================
// CHANNEL CONFIG
// ==========================================
router
  .route("/channels")
  .get(requirePermission(PERMISSIONS.JOBHUB_CONFIG_CHANNEL_READ), jobConfigController.getChannels)
  .post(
    requirePermission(PERMISSIONS.JOBHUB_CONFIG_CHANNEL_CREATE),
    validate(createJobConfigChannelSchema),
    jobConfigController.createChannel
  );

router
  .route("/channels/:id")
  .put(
    requirePermission(PERMISSIONS.JOBHUB_CONFIG_CHANNEL_UPDATE),
    validate(updateJobConfigChannelSchema),
    jobConfigController.updateChannel
  )
  .delete(requirePermission(PERMISSIONS.JOBHUB_CONFIG_CHANNEL_DELETE), jobConfigController.deleteChannel);

// ==========================================
// REPEAT RULE CONFIG
// ==========================================
router
  .route("/repeat-rules")
  .get(requirePermission(PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_READ), jobConfigController.getRepeatRules)
  .post(
    requirePermission(PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_CREATE),
    validate(createJobConfigRepeatRuleSchema),
    jobConfigController.createRepeatRule
  );

router
  .route("/repeat-rules/:id")
  .get(requirePermission(PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_READ), jobConfigController.getRepeatRuleById)
  .put(
    requirePermission(PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_UPDATE),
    validate(updateJobConfigRepeatRuleSchema),
    jobConfigController.updateRepeatRule
  )
  .delete(requirePermission(PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_DELETE), jobConfigController.deleteRepeatRule);

module.exports = router;

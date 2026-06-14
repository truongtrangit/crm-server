const express = require("express");
const router = express.Router();
const JobWorkController = require('../../modules/job/jobWork/jobWork.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');
const validate = require('../../core/middleware/validate');
const {
  createJobFolderSchema,
  updateJobFolderSchema,
  reorderJobFoldersSchema,
  createJobTaskSchema,
  updateJobTaskSchema,
  updateJobTaskStatusSchema,
} = require('../../modules/job/jobWork/jobWork.validation');
const {
  jobFolderAccess,
  jobFolderBulkAccess,
  jobTaskAccess,
} = require('../../core/middleware/jobWorkAccess');

// ==========================================
// JOB FOLDER ROUTES
// ==========================================
router
  .route("/folders")
  .get(
    requirePermission(PERMISSIONS.JOBHUB_WORK_READ),
    JobWorkController.getFolders,
  )
  .post(
    requirePermission(PERMISSIONS.JOBHUB_FOLDER_CREATE),
    validate(createJobFolderSchema),
    JobWorkController.createFolder,
  );

router
  .route("/folders/reorder")
  .patch(
    requirePermission(PERMISSIONS.JOBHUB_FOLDER_UPDATE),
    validate(reorderJobFoldersSchema),
    jobFolderBulkAccess,
    JobWorkController.reorderFolders,
  );

router
  .route("/folders/:id")
  .put(
    requirePermission(PERMISSIONS.JOBHUB_FOLDER_UPDATE),
    validate(updateJobFolderSchema),
    jobFolderAccess.with({ allowAssignee: true }),
    JobWorkController.updateFolder,
  )
  .delete(
    requirePermission(PERMISSIONS.JOBHUB_FOLDER_DELETE),
    jobFolderAccess,
    JobWorkController.deleteFolder,
  );

// ==========================================
// JOB TASK ROUTES
// ==========================================
router
  .route("/tasks")
  .get(
    requirePermission(PERMISSIONS.JOBHUB_WORK_READ),
    JobWorkController.getTasks,
  )
  .post(
    requirePermission(PERMISSIONS.JOBHUB_TASK_CREATE),
    validate(createJobTaskSchema),
    JobWorkController.createTask,
  );

router
  .route("/tasks/:id")
  .get(
    requirePermission(PERMISSIONS.JOBHUB_WORK_READ),
    JobWorkController.getTaskById,
  )
  .put(
    requirePermission(PERMISSIONS.JOBHUB_TASK_UPDATE),
    validate(updateJobTaskSchema),
    jobTaskAccess.with({ allowAssignee: true }),
    JobWorkController.updateTask,
  )
  .delete(
    requirePermission(PERMISSIONS.JOBHUB_TASK_DELETE),
    jobTaskAccess,
    JobWorkController.deleteTask,
  );

router
  .route("/tasks/:id/status")
  .patch(
    requirePermission(PERMISSIONS.JOBHUB_TASK_UPDATE),
    validate(updateJobTaskStatusSchema),
    jobTaskAccess.with({ allowAssignee: true }),
    JobWorkController.updateTaskStatus,
  );

module.exports = router;

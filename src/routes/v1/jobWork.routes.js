const express = require("express");
const router = express.Router();
const JobWorkController = require("../../controllers/JobWorkController");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");
const validate = require("../../middleware/validate");
const {
  createJobFolderSchema,
  updateJobFolderSchema,
  reorderJobFoldersSchema,
  createJobTaskSchema,
  updateJobTaskSchema,
  updateJobTaskStatusSchema,
} = require("../../validations/jobWork.validation");

// ==========================================
// JOB FOLDER ROUTES
// ==========================================
router
  .route("/folders")
  .get(requirePermission(PERMISSIONS.JOBHUB_WORK_READ), JobWorkController.getFolders)
  .post(
    requirePermission(PERMISSIONS.JOBHUB_FOLDER_CREATE),
    validate(createJobFolderSchema),
    JobWorkController.createFolder
  );

router
  .route("/folders/reorder")
  .patch(
    requirePermission(PERMISSIONS.JOBHUB_FOLDER_UPDATE),
    validate(reorderJobFoldersSchema),
    JobWorkController.reorderFolders
  );

router
  .route("/folders/:id")
  .put(
    requirePermission(PERMISSIONS.JOBHUB_FOLDER_UPDATE),
    validate(updateJobFolderSchema),
    JobWorkController.updateFolder
  )
  .delete(requirePermission(PERMISSIONS.JOBHUB_FOLDER_DELETE), JobWorkController.deleteFolder);

// ==========================================
// JOB TASK ROUTES
// ==========================================
router
  .route("/tasks")
  .get(requirePermission(PERMISSIONS.JOBHUB_WORK_READ), JobWorkController.getTasks)
  .post(
    requirePermission(PERMISSIONS.JOBHUB_TASK_CREATE),
    validate(createJobTaskSchema),
    JobWorkController.createTask
  );

router
  .route("/tasks/:id")
  .get(requirePermission(PERMISSIONS.JOBHUB_WORK_READ), JobWorkController.getTaskById)
  .put(
    requirePermission(PERMISSIONS.JOBHUB_TASK_UPDATE),
    validate(updateJobTaskSchema),
    JobWorkController.updateTask
  )
  .delete(requirePermission(PERMISSIONS.JOBHUB_TASK_DELETE), JobWorkController.deleteTask);

router
  .route("/tasks/:id/status")
  .patch(
    requirePermission(PERMISSIONS.JOBHUB_TASK_UPDATE),
    validate(updateJobTaskStatusSchema),
    JobWorkController.updateTaskStatus
  );

module.exports = router;

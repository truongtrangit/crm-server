const express = require("express");
const { requirePermission } = require("../../core/middleware/auth");
const { PERMISSIONS } = require("../../core/constants/rbac");
const controller = require("../../modules/course/courseEnrollment/courseEnrollment.controller");
const validate = require("../../core/middleware/validate");
const validation = require("../../modules/course/courseEnrollment/courseEnrollment.validation");

const router = express.Router();

// Admin can view all enrollments across courses
router.get(
  "/all",
  requirePermission(PERMISSIONS.COURSE_ENROLLMENTS_READ),
  validate(validation.getAllEnrollments, "query"),
  controller.getAllEnrollments.bind(controller)
);

// Admin can get enrollment stats
router.get(
  "/stats",
  requirePermission(PERMISSIONS.COURSE_ENROLLMENTS_READ),
  validate(validation.getEnrollmentStats, "query"),
  controller.getEnrollmentStats.bind(controller)
);

// Admin can view enrollments for a course
router.get(
  "/course/:courseId",
  requirePermission(PERMISSIONS.COURSE_ENROLLMENTS_READ),
  controller.getEnrollmentsByCourseId.bind(controller)
);

// Admin can update enrollment status
router.put(
  "/:id/status",
  requirePermission(PERMISSIONS.COURSE_ENROLLMENTS_UPDATE),
  validate(validation.updateEnrollmentStatus, "body"),
  controller.updateEnrollmentStatus.bind(controller)
);

// Admin can update batch enrollment status
router.put(
  "/batch-status",
  requirePermission(PERMISSIONS.COURSE_ENROLLMENTS_UPDATE),
  validate(validation.updateBatchStatus, "body"),
  controller.updateBatchStatus.bind(controller)
);

module.exports = router;

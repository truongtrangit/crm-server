const express = require("express");
const { requirePermission } = require("../../core/middleware/auth");
const { PERMISSIONS } = require("../../core/constants/rbac");
const controller = require("../../modules/course/courseEnrollment/courseEnrollment.controller");

const router = express.Router();

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
  controller.updateEnrollmentStatus.bind(controller)
);

module.exports = router;

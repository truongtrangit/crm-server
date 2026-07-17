const express = require("express");
const { requirePermission } = require("../../core/middleware/auth");
const { PERMISSIONS } = require("../../core/constants/rbac");
const validate = require("../../core/middleware/validate");
const controller = require("../../modules/course/courseSubmission/courseSubmission.controller");
const validation = require("../../modules/course/courseSubmission/courseSubmission.validation");

const router = express.Router();

// Admin: lấy danh sách bài nộp của 1 khoá
router.get(
  "/course/:courseId",
  requirePermission(PERMISSIONS.COURSES_SUBMISSIONS_READ),
  controller.getSubmissionsForCourse.bind(controller),
);

// Admin: lấy chi tiết 1 bài nộp
router.get(
  "/:id",
  requirePermission(PERMISSIONS.COURSES_SUBMISSIONS_READ),
  controller.getSubmissionById.bind(controller),
);

// Admin: chấm bài
router.patch(
  "/:id/review",
  requirePermission(PERMISSIONS.COURSES_SUBMISSIONS_UPDATE),
  validate(validation.reviewSubmission),
  controller.reviewSubmission.bind(controller),
);

module.exports = router;

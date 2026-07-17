const express = require("express");
const CourseSubmissionController = require("../../../modules/course/courseSubmission/courseSubmission.controller");
const validate = require("../../../core/middleware/validate");
const validation = require("../../../modules/course/courseSubmission/courseSubmission.validation");
const {
  botvnAuthenticateRequest,
} = require("../../../core/middleware/externalAuth");

const router = express.Router();

// All student submission routes require authentication
router.use(botvnAuthenticateRequest);

router.post(
  "/",
  validate(validation.submitAssignment),
  CourseSubmissionController.submitAssignment,
);

router.get("/my", CourseSubmissionController.getMySubmissions);

router.put(
  "/:id",
  validate(validation.updateSubmission),
  CourseSubmissionController.updateSubmission,
);

router.delete("/:id", CourseSubmissionController.deleteSubmission);

module.exports = router;

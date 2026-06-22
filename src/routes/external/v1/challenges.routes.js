const express = require("express");
const CourseChallengeController = require("../../../modules/course/courseChallenge/courseChallenge.controller");
const validate = require("../../../core/middleware/validate");
const validation = require("../../../modules/course/courseChallenge/courseChallenge.validation");
const {
  optionalBotvnAuthenticateRequest,
  botvnAuthenticateRequest,
} = require("../../../core/middleware/externalAuth");

const router = express.Router();

router.get(
  "/",
  optionalBotvnAuthenticateRequest,
  CourseChallengeController.getPublicCourses,
);
router.get(
  "/:slug",
  optionalBotvnAuthenticateRequest,
  CourseChallengeController.getPublicCourseBySlug,
);

router.get(
  "/:id/my-progress",
  botvnAuthenticateRequest,
  CourseChallengeController.getMyProgress,
);
router.post(
  "/:id/days/:dayId/submit",
  botvnAuthenticateRequest,
  validate(validation.submitAssignment),
  CourseChallengeController.submitDayAssignment,
);

module.exports = router;

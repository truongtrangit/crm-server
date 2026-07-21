const express = require("express");
const CourseChallengeController = require("../../../modules/course/courseChallenge/courseChallenge.controller");
const validate = require("../../../core/middleware/validate");
const validation = require("../../../modules/course/courseChallenge/courseChallenge.validation");
const {
  optionalBotvnAuthenticateRequest,
  botvnAuthenticateRequest,
} = require("../../../core/middleware/externalAuth");
const {
  videoAccessLimiter,
} = require("../../../core/middleware/rateLimiter");

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

// Video URL endpoint — requires auth + rate limited
router.get(
  "/:courseId/lessons/:lessonId/video",
  botvnAuthenticateRequest,
  videoAccessLimiter,
  CourseChallengeController.getLessonVideoUrl,
);

// Video player event logging — requires auth
router.post(
  "/:courseId/lessons/:lessonId/video/events",
  botvnAuthenticateRequest,
  videoAccessLimiter,
  CourseChallengeController.logVideoEvent,
);

module.exports = router;

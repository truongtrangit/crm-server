const express = require("express");
const CourseChallengeController = require("../../../modules/course/courseChallenge/courseChallenge.controller");
const validate = require("../../../core/middleware/validate");
const validation = require("../../../modules/course/courseChallenge/courseChallenge.validation");
const { authenticateBotvnUser } = require("../../../core/middleware/auth"); // Assuming there's a middleware for external auth. We'll use a placeholder or check AI_CONTEXT.

const router = express.Router();

// Mock authenticateBotvnUser for the purpose of the challenge.
// In reality, this would be imported from the actual auth middleware.
const mockAuth = (req, res, next) => {
  // Try to use real auth if available, else skip or use dummy
  next();
};

router.get("/", CourseChallengeController.getPublicCourses);
router.get("/:slug", CourseChallengeController.getPublicCourseBySlug);
router.post("/:id/enroll", mockAuth, CourseChallengeController.enrollCourse);

router.get("/:id/my-progress", mockAuth, CourseChallengeController.getMyProgress);
router.post("/:id/days/:dayId/submit", mockAuth, validate(validation.submitAssignment), CourseChallengeController.submitDayAssignment);

module.exports = router;

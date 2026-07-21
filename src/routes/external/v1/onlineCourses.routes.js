const express = require("express");
const CourseOnlineController = require("../../../modules/course/courseOnline/courseOnline.controller");
const CourseConfigController = require("../../../modules/course/courseConfig/courseConfig.controller");
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
  CourseOnlineController.getExternalCourses
);
router.get("/categories", CourseConfigController.getCategories);
router.get(
  "/:identifier",
  optionalBotvnAuthenticateRequest,
  CourseOnlineController.getCourseByIdentifier
);

// Video URL endpoint — requires auth + rate limited
router.get(
  "/:courseId/lessons/:lessonId/video",
  botvnAuthenticateRequest,
  videoAccessLimiter,
  CourseOnlineController.getLessonVideoUrl,
);

// Video player event logging — requires auth
router.post(
  "/:courseId/lessons/:lessonId/video/events",
  botvnAuthenticateRequest,
  videoAccessLimiter,
  CourseOnlineController.logVideoEvent,
);

module.exports = router;

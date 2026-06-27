const express = require('express');
const router = express.Router();
const courseOfflineController = require('../../../modules/course/courseOffline/courseOffline.controller');
const CourseConfigController = require('../../../modules/course/courseConfig/courseConfig.controller');
const {
  optionalBotvnAuthenticateRequest,
} = require("../../../core/middleware/externalAuth");

// Note: External routes typically do not strictly require permission checks like admin panel,
// but they might require optional auth for personalized content (like enrolled status).

router.get(
  '/',
  optionalBotvnAuthenticateRequest,
  courseOfflineController.getExternalCourses.bind(courseOfflineController)
);

router.get(
  '/hashtags',
  CourseConfigController.getHashtags
);

router.get(
  '/:identifier',
  optionalBotvnAuthenticateRequest,
  courseOfflineController.getCourseByIdentifier.bind(courseOfflineController)
);

module.exports = router;

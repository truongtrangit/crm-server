const express = require('express');
const router = express.Router();
const courseOfflineController = require('../../../modules/course/courseOffline/courseOffline.controller');

// Note: External routes typically do not strictly require permission checks like admin panel,
// but they might require optional auth for personalized content (like enrolled status).

router.get(
  '/',
  courseOfflineController.getExternalCourses.bind(courseOfflineController)
);

router.get(
  '/:identifier',
  courseOfflineController.getCourseByIdentifier.bind(courseOfflineController)
);

module.exports = router;

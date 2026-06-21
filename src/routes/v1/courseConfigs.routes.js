const express = require("express");
const { requirePermission } = require("../../core/middleware/auth");
const { PERMISSIONS } = require("../../core/constants/rbac");
const CourseConfigController = require("../../modules/course/courseConfig/courseConfig.controller");

const router = express.Router();

// Categories
router
  .route("/categories")
  .get(
    requirePermission(PERMISSIONS.COURSE_CONFIG_READ),
    CourseConfigController.getCategories,
  )
  .post(
    requirePermission(PERMISSIONS.COURSE_CONFIG_CREATE),
    CourseConfigController.createCategory,
  );

router
  .route("/categories/:id")
  .put(
    requirePermission(PERMISSIONS.COURSE_CONFIG_UPDATE),
    CourseConfigController.updateCategory,
  )
  .delete(
    requirePermission(PERMISSIONS.COURSE_CONFIG_DELETE),
    CourseConfigController.deleteCategory,
  );

// Hashtags
router
  .route("/hashtags")
  .get(
    requirePermission(PERMISSIONS.COURSE_CONFIG_READ),
    CourseConfigController.getHashtags,
  )
  .post(
    requirePermission(PERMISSIONS.COURSE_CONFIG_CREATE),
    CourseConfigController.createHashtag,
  );

router
  .route("/hashtags/:id")
  .put(
    requirePermission(PERMISSIONS.COURSE_CONFIG_UPDATE),
    CourseConfigController.updateHashtag,
  )
  .delete(
    requirePermission(PERMISSIONS.COURSE_CONFIG_DELETE),
    CourseConfigController.deleteHashtag,
  );

// Utilities
router.get(
  "/youtube-duration",
  requirePermission([
    PERMISSIONS.COURSE_CONFIG_READ,
    PERMISSIONS.COURSES_ONLINE_CREATE,
    PERMISSIONS.COURSES_ONLINE_UPDATE,
    PERMISSIONS.COURSES_CHALLENGES_CREATE,
    PERMISSIONS.COURSES_CHALLENGES_UPDATE,
  ]),
  CourseConfigController.getYoutubeDuration,
);

module.exports = router;

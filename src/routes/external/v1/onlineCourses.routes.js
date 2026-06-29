const express = require("express");
const CourseOnlineController = require("../../../modules/course/courseOnline/courseOnline.controller");
const CourseConfigController = require("../../../modules/course/courseConfig/courseConfig.controller");
const {
  optionalBotvnAuthenticateRequest,
} = require("../../../core/middleware/externalAuth");

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

module.exports = router;

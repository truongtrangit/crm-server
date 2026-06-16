const express = require("express");
const CourseOnlineController = require("../../../modules/course/courseOnline/courseOnline.controller");
const CourseConfigController = require("../../../modules/course/courseConfig/courseConfig.controller");

const router = express.Router();

router.get("/", CourseOnlineController.getExternalCourses);
router.get("/categories", CourseConfigController.getCategories);
router.get("/:identifier", CourseOnlineController.getCourseByIdentifier);

module.exports = router;

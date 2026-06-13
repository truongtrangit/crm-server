const express = require("express");
const CourseOnlineController = require('../../../modules/course/courseOnline/courseOnline.controller');

const router = express.Router();

router.get("/", CourseOnlineController.getCourses);
router.get("/:identifier", CourseOnlineController.getCourseByIdentifier);

module.exports = router;

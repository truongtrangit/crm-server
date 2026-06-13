const express = require("express");
const CourseOnlineController = require('../../../modules/course/courseOnline/courseOnline.controller');

const router = express.Router();

router.get("/", CourseOnlineController.getCourses);
router.get("/:id", CourseOnlineController.getCourseById);

module.exports = router;

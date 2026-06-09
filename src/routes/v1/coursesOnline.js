const express = require("express");
const CourseOnlineController = require("../../controllers/CourseOnlineController");
const validate = require("../../middleware/validate");
const {
  createCourseOnline,
  updateCourseOnline,
} = require("../../validations/courseOnline.validation");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");

const router = express.Router();

router.post(
  "/",
  requirePermission(PERMISSIONS.COURSES_ONLINE_CREATE),
  validate(createCourseOnline),
  CourseOnlineController.createCourse,
);

router.get(
  "/",
  requirePermission(PERMISSIONS.COURSES_ONLINE_READ),
  CourseOnlineController.getCourses,
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.COURSES_ONLINE_READ),
  CourseOnlineController.getCourseById,
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.COURSES_ONLINE_UPDATE),
  validate(updateCourseOnline),
  CourseOnlineController.updateCourse,
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.COURSES_ONLINE_DELETE),
  CourseOnlineController.deleteCourse,
);

module.exports = router;

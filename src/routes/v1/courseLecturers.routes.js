const express = require("express");
const CourseLecturerController = require('../../modules/course/courseLecturer/courseLecturer.controller');
const validate = require('../../core/middleware/validate');
const { createLecturer, updateLecturer } = require('../../modules/course/courseLecturer/courseLecturer.validation');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const router = express.Router();

router.get(
  "/",
  requirePermission(PERMISSIONS.COURSE_LECTURERS_READ),
  CourseLecturerController.getLecturers
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.COURSE_LECTURERS_READ),
  CourseLecturerController.getLecturerById
);

router.post(
  "/",
  requirePermission(PERMISSIONS.COURSE_LECTURERS_CREATE),
  validate(createLecturer),
  CourseLecturerController.createLecturer
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.COURSE_LECTURERS_UPDATE),
  validate(updateLecturer),
  CourseLecturerController.updateLecturer
);

router.delete(
  "/:id",
  requirePermission(PERMISSIONS.COURSE_LECTURERS_DELETE),
  CourseLecturerController.deleteLecturer
);

module.exports = router;

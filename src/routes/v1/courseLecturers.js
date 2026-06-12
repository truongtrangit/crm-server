const express = require("express");
const CourseLecturerController = require("../../controllers/CourseLecturerController");
const validate = require("../../middleware/validate");
const { createLecturer, updateLecturer } = require("../../validations/courseLecturer.validation");
const { requirePermission } = require("../../middleware/auth");
const { PERMISSIONS } = require("../../constants/rbac");

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

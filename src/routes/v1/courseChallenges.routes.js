const express = require("express");
const validate = require("../../core/middleware/validate");
const { requirePermission } = require("../../core/middleware/auth");
const { PERMISSIONS } = require("../../core/constants/rbac");

const controller = require("../../modules/course/courseChallenge/courseChallenge.controller");
const validation = require("../../modules/course/courseChallenge/courseChallenge.validation");

const router = express.Router();

// ---------------------------------------------------------------------------
// TEMPLATES (/api/v1/courses/challenges/templates)
// ---------------------------------------------------------------------------
router.get(
  "/templates",
  requirePermission(PERMISSIONS.COURSES_CHALLENGES_READ),
  controller.getTemplates.bind(controller)
);

router.get(
  "/templates/:id",
  requirePermission(PERMISSIONS.COURSES_CHALLENGES_READ),
  controller.getTemplateById.bind(controller)
);

router.post(
  "/templates",
  requirePermission(PERMISSIONS.COURSES_CHALLENGES_CREATE),
  validate(validation.createTemplate),
  controller.createTemplate.bind(controller)
);

router.put(
  "/templates/:id",
  requirePermission(PERMISSIONS.COURSES_CHALLENGES_UPDATE),
  validate(validation.updateTemplate),
  controller.updateTemplate.bind(controller)
);

router.delete(
  "/templates/:id",
  requirePermission(PERMISSIONS.COURSES_CHALLENGES_DELETE),
  controller.deleteTemplate.bind(controller)
);

router.post(
  "/templates/:id/clone",
  requirePermission(PERMISSIONS.COURSES_CHALLENGES_CLONE),
  validate(validation.cloneCourse),
  controller.cloneTemplateToCourse.bind(controller)
);

// ---------------------------------------------------------------------------
// DEPLOYED COURSES (/api/v1/courses/challenges/deployed)
// ---------------------------------------------------------------------------
router.get(
  "/deployed",
  requirePermission(PERMISSIONS.COURSES_CHALLENGES_READ),
  controller.getCourses.bind(controller)
);

router.get(
  "/deployed/:id",
  requirePermission(PERMISSIONS.COURSES_CHALLENGES_READ),
  controller.getCourseById.bind(controller)
);

router.put(
  "/deployed/:id",
  requirePermission(PERMISSIONS.COURSES_CHALLENGES_UPDATE),
  validate(validation.updateCourse),
  controller.updateCourse.bind(controller)
);

module.exports = router;

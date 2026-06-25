const express = require('express');
const router = express.Router();
const courseOfflineController = require('../../modules/course/courseOffline/courseOffline.controller');
const { requirePermission } = require('../../core/middleware/auth');
const validate = require('../../core/middleware/validate');
const { createCourseOffline, updateCourseOffline } = require('../../modules/course/courseOffline/courseOffline.validation');
const { PERMISSIONS } = require('../../core/constants/rbac');

router.post(
  '/',
  requirePermission(PERMISSIONS.COURSES_OFFLINE_CREATE),
  validate(createCourseOffline),
  courseOfflineController.createCourse.bind(courseOfflineController)
);

router.get(
  '/',
  requirePermission(PERMISSIONS.COURSES_OFFLINE_READ),
  courseOfflineController.getCourses.bind(courseOfflineController)
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.COURSES_OFFLINE_READ),
  courseOfflineController.getCourseById.bind(courseOfflineController)
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.COURSES_OFFLINE_UPDATE),
  validate(updateCourseOffline),
  courseOfflineController.updateCourse.bind(courseOfflineController)
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.COURSES_OFFLINE_DELETE),
  courseOfflineController.deleteCourse.bind(courseOfflineController)
);

module.exports = router;

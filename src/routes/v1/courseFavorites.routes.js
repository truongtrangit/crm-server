const express = require('express');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');
const controller = require('../../modules/course/favoriteCourse/favoriteCourse.controller');
const validate = require('../../core/middleware/validate');
const validation = require('../../modules/course/favoriteCourse/favoriteCourse.validation');

const router = express.Router();

// CRM staff xem danh sách tất cả khoá học yêu thích
router.get(
  '/all',
  requirePermission(PERMISSIONS.COURSES_FAVORITES_READ),
  validate(validation.getAllFavorites, 'query'),
  controller.getAllFavorites.bind(controller),
);

// CRM staff xem thống kê khoá học yêu thích
router.get(
  '/stats',
  requirePermission(PERMISSIONS.COURSES_FAVORITES_READ),
  validate(validation.getFavoriteStats, 'query'),
  controller.getFavoriteStats.bind(controller),
);

module.exports = router;

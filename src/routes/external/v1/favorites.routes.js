const express = require('express');
const router = express.Router();
const controller = require('../../../modules/course/favoriteCourse/favoriteCourse.controller');
const {
  verifyCustomerAuth,
} = require('../../../core/middleware/customerAuth');
const validate = require('../../../core/middleware/validate');
const validation = require('../../../modules/course/favoriteCourse/favoriteCourse.validation');

// Tất cả routes đều yêu cầu đăng nhập
router.use(verifyCustomerAuth);

// Lấy danh sách yêu thích
router.get(
  '/',
  controller.getMyFavorites.bind(controller),
);

// Thêm khoá học yêu thích
router.post(
  '/',
  validate(validation.addFavorite),
  controller.addFavorite.bind(controller),
);

// Xoá khoá học khỏi yêu thích
router.delete(
  '/:courseId',
  controller.removeFavorite.bind(controller),
);

// Batch check favorite status
router.post(
  '/check',
  validate(validation.checkFavorites),
  controller.checkFavorites.bind(controller),
);

module.exports = router;

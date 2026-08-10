const FavoriteCourseService = require('./favoriteCourse.service');
const { sendSuccess } = require('../../../core/utils/http');

class FavoriteCourseController {
  // ─── External API (BotVN) ─────────────────────────────────────────

  async getMyFavorites(req, res) {
    const customerId = req.customer.id;
    const favorites = await FavoriteCourseService.getMyFavorites(customerId);
    return sendSuccess(res, 200, 'Lấy danh sách yêu thích thành công', favorites);
  }

  async addFavorite(req, res) {
    const customerId = req.customer.id;
    const { courseId, courseType } = req.body;
    const favorite = await FavoriteCourseService.addFavorite(customerId, courseId, courseType);
    return sendSuccess(res, 200, 'Đã thêm vào yêu thích', favorite);
  }

  async removeFavorite(req, res) {
    const customerId = req.customer.id;
    const { courseId } = req.params;
    await FavoriteCourseService.removeFavorite(customerId, courseId);
    return sendSuccess(res, 200, 'Đã xoá khỏi yêu thích');
  }

  async checkFavorites(req, res) {
    const customerId = req.customer.id;
    const { courseIds } = req.body;
    const result = await FavoriteCourseService.checkFavorites(customerId, courseIds);
    return sendSuccess(res, 200, 'Kiểm tra yêu thích thành công', result);
  }

  // ─── CRM Internal API ─────────────────────────────────────────────

  async getAllFavorites(req, res) {
    const result = await FavoriteCourseService.getAllFavorites(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách yêu thích thành công', result);
  }

  async getFavoriteStats(req, res) {
    const result = await FavoriteCourseService.getFavoriteStats(req.query);
    return sendSuccess(res, 200, 'Lấy thống kê yêu thích thành công', result);
  }
}

module.exports = new FavoriteCourseController();

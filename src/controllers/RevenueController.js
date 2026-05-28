const revenueService = require("../services/RevenueService");
const { sendSuccess } = require("../utils/http");

class RevenueController {
  // ─── Revenue Categories ──────────────────────────────────────────────────

  async getCategories(req, res) {
    const categories = await revenueService.getCategories(req.query);
    return sendSuccess(res, 200, "Lấy danh sách danh mục thành công", categories);
  }

  async createCategory(req, res) {
    const category = await revenueService.createCategory(req.body);
    return sendSuccess(res, 200, "Tạo danh mục thành công", category);
  }

  async updateCategory(req, res) {
    const category = await revenueService.updateCategory(req.params.id, req.body);
    return sendSuccess(res, 200, "Cập nhật danh mục thành công", category);
  }

  async deleteCategory(req, res) {
    await revenueService.deleteCategory(req.params.id);
    return sendSuccess(res, 200, "Xóa danh mục thành công");
  }

  // ─── Revenues ─────────────────────────────────────────────────────────────

  async getRevenues(req, res) {
    const result = await revenueService.getRevenues(req.query);
    return sendSuccess(res, 200, "Lấy danh sách doanh thu thành công", result);
  }

  async getRevenueById(req, res) {
    const revenue = await revenueService.getRevenueById(req.params.id);
    return sendSuccess(res, 200, "Lấy chi tiết doanh thu thành công", revenue);
  }

  async createRevenue(req, res) {
    const revenue = await revenueService.createRevenue(req.body);
    return sendSuccess(res, 200, "Tạo doanh thu thành công", revenue);
  }

  async updateRevenue(req, res) {
    const revenue = await revenueService.updateRevenue(req.params.id, req.body);
    return sendSuccess(res, 200, "Cập nhật doanh thu thành công", revenue);
  }

  async deleteRevenue(req, res) {
    await revenueService.deleteRevenue(req.params.id);
    return sendSuccess(res, 200, "Xóa doanh thu thành công");
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  async getRevenueStats(req, res) {
    const stats = await revenueService.getRevenueStats(req.query);
    return sendSuccess(res, 200, "Lấy thống kê doanh thu thành công", stats);
  }
}

module.exports = new RevenueController();

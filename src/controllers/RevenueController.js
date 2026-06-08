const revenueService = require("../services/RevenueService");
const { sendSuccess } = require("../utils/http");
const SystemLogService = require("../services/SystemLogService");
const { RESOURCES } = require("../constants/rbac");

class RevenueController {
  // ─── Revenue Categories ──────────────────────────────────────────────────

  async getCategories(req, res) {
    const categories = await revenueService.getCategories(req.query);
    return sendSuccess(
      res,
      200,
      "Lấy danh sách danh mục thành công",
      categories,
    );
  }

  async createCategory(req, res) {
    const category = await revenueService.createCategory(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.REVENUES,
      resourceId: category.id || category._id?.toString(),
      resourceName: category.name,
      description: `Tạo danh mục doanh thu: "${category.name}"`,
      metadata: { newItem: category },
      req,
    });
    return sendSuccess(res, 200, "Tạo danh mục thành công", category);
  }

  async updateCategory(req, res) {
    const { category, changes } = await revenueService.updateCategory(
      req.params.id,
      req.body,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.REVENUES,
      resourceId: category.id || category._id?.toString() || req.params.id,
      resourceName: category.name,
      description: `Cập nhật danh mục doanh thu: "${category.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật danh mục thành công", category);
  }

  async deleteCategory(req, res) {
    const force = req.query.force === "true";
    const category = await revenueService.deleteCategory(req.params.id, force);
    SystemLogService.log({
      action: force ? "force_delete" : "delete",
      resource: RESOURCES.REVENUES,
      resourceId: req.params.id,
      resourceName: category?.name,
      description: `Xóa danh mục doanh thu: "${category?.name || req.params.id}" (force: ${force})`,
      metadata: { deletedItem: category },
      req,
    });
    return sendSuccess(res, 200, "Xóa danh mục thành công");
  }

  // ─── Expected Revenues ────────────────────────────────────────────────────

  async getExpectedRevenues(req, res) {
    const result = await revenueService.getExpectedRevenues(req.query);
    return sendSuccess(
      res,
      200,
      "Lấy danh sách doanh thu dự kiến thành công",
      result,
    );
  }

  async createExpectedRevenue(req, res) {
    const result = await revenueService.createExpectedRevenue(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.REVENUES,
      resourceId: result.id || result._id?.toString(),
      resourceName: result.customerName,
      description: `Tạo doanh thu dự kiến cho khách hàng "${result.customerName}"`,
      metadata: { newItem: result },
      req,
    });
    return sendSuccess(res, 200, "Tạo doanh thu dự kiến thành công", result);
  }

  async updateExpectedRevenue(req, res) {
    const force = req.query.force === "true" || req.body.force === true;
    const { expected, changes } = await revenueService.updateExpectedRevenue(
      req.params.id,
      req.body,
      force,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.REVENUES,
      resourceId: expected.id || expected._id?.toString() || req.params.id,
      resourceName: expected.name,
      description: `Cập nhật doanh thu dự kiến cho khách hàng "${expected.name}" (force: ${force})`,
      metadata: { changes },
      req,
    });
    return sendSuccess(
      res,
      200,
      "Cập nhật doanh thu dự kiến thành công",
      expected,
    );
  }

  async deleteExpectedRevenue(req, res) {
    const force = req.query.force === "true";
    const expected = await revenueService.deleteExpectedRevenue(
      req.params.id,
      force,
    );
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.REVENUES,
      resourceId: req.params.id,
      resourceName: expected?.name,
      description: `Xóa doanh thu dự kiến: "${expected?.name || req.params.id}" (force: ${force})`,
      metadata: { deletedItem: expected },
      req,
    });
    return sendSuccess(res, 200, "Xóa doanh thu dự kiến thành công");
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
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.REVENUES,
      resourceId: revenue.id || revenue._id?.toString() || revenue.orderId,
      resourceName: revenue.orderId,
      description: `Tạo khoản doanh thu thực tế: "${revenue.orderId}" cho "${revenue.customerName}" (Số tiền: ${revenue.amount})`,
      metadata: { newItem: revenue },
      req,
    });
    return sendSuccess(res, 200, "Tạo doanh thu thành công", revenue);
  }

  async updateRevenue(req, res) {
    const { revenue, changes } = await revenueService.updateRevenue(
      req.params.id,
      req.body,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.REVENUES,
      resourceId: revenue.id || revenue._id?.toString() || req.params.id,
      resourceName: revenue.orderId,
      description: `Cập nhật khoản doanh thu thực tế: "${revenue.orderId}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật doanh thu thành công", revenue);
  }

  async deleteRevenue(req, res) {
    const revenue = await revenueService.deleteRevenue(req.params.id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.REVENUES,
      resourceId: req.params.id,
      resourceName: revenue?.orderId,
      description: `Xóa khoản doanh thu thực tế (ID: ${req.params.id})`,
      metadata: { deletedItem: revenue },
      req,
    });
    return sendSuccess(res, 200, "Xóa doanh thu thành công");
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  async getRevenueStats(req, res) {
    const stats = await revenueService.getRevenueStats(req.query);
    return sendSuccess(res, 200, "Lấy thống kê doanh thu thành công", stats);
  }
}

module.exports = new RevenueController();

const expenseService = require('./expense.service');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');

class ExpenseController {
  // ─── Expense Categories ──────────────────────────────────────────────────

  async getCategories(req, res) {
    const categories = await expenseService.getCategories(req.query);
    return sendSuccess(res, 200, "Lấy danh sách danh mục thành công", categories);
  }

  async createCategory(req, res) {
    const category = await expenseService.createCategory(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.EXPENSES,
      resourceId: category.id || category._id?.toString(),
      resourceName: category.name,
      description: `Tạo danh mục chi phí: "${category.name}"`,
      metadata: { newItem: category },
      req
    });
    return sendSuccess(res, 200, "Tạo danh mục thành công", category);
  }

  async updateCategory(req, res) {
    const { category, changes } = await expenseService.updateCategory(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.EXPENSES,
      resourceId: category.id || category._id?.toString() || req.params.id,
      resourceName: category.name,
      description: `Cập nhật danh mục chi phí: "${category.name}"`,
      metadata: { changes },
      req
    });
    return sendSuccess(res, 200, "Cập nhật danh mục thành công", category);
  }

  async deleteCategory(req, res) {
    const force = req.query.force === "true";
    const category = await expenseService.deleteCategory(req.params.id, force);
    SystemLogService.log({
      action: force ? "force_delete" : "delete",
      resource: RESOURCES.EXPENSES,
      resourceId: req.params.id,
      resourceName: category?.name,
      description: `Xóa danh mục chi phí: "${category?.name || req.params.id}" (force: ${force})`,
      metadata: { deletedItem: category },
      req
    });
    return sendSuccess(res, 200, "Xóa danh mục thành công");
  }

  // ─── Expected Expenses ────────────────────────────────────────────────────

  async getExpectedExpenses(req, res) {
    const result = await expenseService.getExpectedExpenses(req.query);
    return sendSuccess(res, 200, "Lấy danh sách chi phí dự kiến thành công", result);
  }

  async createExpectedExpense(req, res) {
    const result = await expenseService.createExpectedExpense(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.EXPENSES,
      resourceId: result.id || result._id?.toString(),
      resourceName: result.customerName,
      description: `Tạo chi phí dự kiến cho khách hàng "${result.customerName}"`,
      metadata: { newItem: result },
      req
    });
    return sendSuccess(res, 200, "Tạo chi phí dự kiến thành công", result);
  }

  async updateExpectedExpense(req, res) {
    const force = req.query.force === "true" || req.body.force === true;
    const { expected, changes } = await expenseService.updateExpectedExpense(req.params.id, req.body, force);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.EXPENSES,
      resourceId: expected.id || expected._id?.toString() || req.params.id,
      resourceName: expected.customerName,
      description: `Cập nhật chi phí dự kiến cho khách hàng "${expected.customerName}" (force: ${force})`,
      metadata: { changes },
      req
    });
    return sendSuccess(res, 200, "Cập nhật chi phí dự kiến thành công", expected);
  }

  async deleteExpectedExpense(req, res) {
    const force = req.query.force === "true";
    const expected = await expenseService.deleteExpectedExpense(req.params.id, force);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.EXPENSES,
      resourceId: req.params.id,
      resourceName: expected?.name,
      description: `Xóa chi phí dự kiến: "${expected?.name || req.params.id}" (force: ${force})`,
      metadata: { deletedItem: expected },
      req
    });
    return sendSuccess(res, 200, "Xóa chi phí dự kiến thành công");
  }

  // ─── Expenses ─────────────────────────────────────────────────────────────

  async getExpenses(req, res) {
    const result = await expenseService.getExpenses(req.query);
    return sendSuccess(res, 200, "Lấy danh sách chi phí thành công", result);
  }

  async getExpenseById(req, res) {
    const expense = await expenseService.getExpenseById(req.params.id);
    return sendSuccess(res, 200, "Lấy chi tiết chi phí thành công", expense);
  }

  async createExpense(req, res) {
    const expense = await expenseService.createExpense(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.EXPENSES,
      resourceId: expense.id || expense._id?.toString() || expense.orderId,
      resourceName: expense.orderId,
      description: `Tạo khoản chi phí thực tế: "${expense.orderId}" cho "${expense.customerName}" (Số tiền: ${expense.amount})`,
      metadata: { newItem: expense },
      req
    });
    return sendSuccess(res, 200, "Tạo chi phí thành công", expense);
  }

  async updateExpense(req, res) {
    const { expense, changes } = await expenseService.updateExpense(req.params.id, req.body);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.EXPENSES,
      resourceId: expense.id || expense._id?.toString() || req.params.id,
      resourceName: expense.orderId,
      description: `Cập nhật khoản chi phí thực tế: "${expense.orderId}"`,
      metadata: { changes },
      req
    });
    return sendSuccess(res, 200, "Cập nhật chi phí thành công", expense);
  }

  async deleteExpense(req, res) {
    const expense = await expenseService.deleteExpense(req.params.id);
    SystemLogService.log({
      action: "delete",
      resource: RESOURCES.EXPENSES,
      resourceId: req.params.id,
      resourceName: expense?.orderId,
      description: `Xóa khoản chi phí thực tế (ID: ${req.params.id})`,
      metadata: { deletedItem: expense },
      req
    });
    return sendSuccess(res, 200, "Xóa chi phí thành công");
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  async getExpenseStats(req, res) {
    const stats = await expenseService.getExpenseStats(req.query);
    return sendSuccess(res, 200, "Lấy thống kê chi phí thành công", stats);
  }
}

module.exports = new ExpenseController();

const expenseService = require("../services/ExpenseService");
const { sendSuccess } = require("../utils/http");

class ExpenseController {
  // ─── Expense Categories ──────────────────────────────────────────────────

  async getCategories(req, res) {
    const categories = await expenseService.getCategories(req.query);
    return sendSuccess(res, 200, "Lấy danh sách danh mục thành công", categories);
  }

  async createCategory(req, res) {
    const category = await expenseService.createCategory(req.body);
    return sendSuccess(res, 200, "Tạo danh mục thành công", category);
  }

  async updateCategory(req, res) {
    const category = await expenseService.updateCategory(req.params.id, req.body);
    return sendSuccess(res, 200, "Cập nhật danh mục thành công", category);
  }

  async deleteCategory(req, res) {
    const force = req.query.force === "true";
    await expenseService.deleteCategory(req.params.id, force);
    return sendSuccess(res, 200, "Xóa danh mục thành công");
  }

  // ─── Expected Expenses ────────────────────────────────────────────────────

  async getExpectedExpenses(req, res) {
    const result = await expenseService.getExpectedExpenses(req.query);
    return sendSuccess(res, 200, "Lấy danh sách chi phí dự kiến thành công", result);
  }

  async createExpectedExpense(req, res) {
    const result = await expenseService.createExpectedExpense(req.body);
    return sendSuccess(res, 200, "Tạo chi phí dự kiến thành công", result);
  }

  async updateExpectedExpense(req, res) {
    const result = await expenseService.updateExpectedExpense(req.params.id, req.body);
    return sendSuccess(res, 200, "Cập nhật chi phí dự kiến thành công", result);
  }

  async deleteExpectedExpense(req, res) {
    await expenseService.deleteExpectedExpense(req.params.id);
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
    return sendSuccess(res, 200, "Tạo chi phí thành công", expense);
  }

  async updateExpense(req, res) {
    const expense = await expenseService.updateExpense(req.params.id, req.body);
    return sendSuccess(res, 200, "Cập nhật chi phí thành công", expense);
  }

  async deleteExpense(req, res) {
    await expenseService.deleteExpense(req.params.id);
    return sendSuccess(res, 200, "Xóa chi phí thành công");
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  async getExpenseStats(req, res) {
    const stats = await expenseService.getExpenseStats(req.query);
    return sendSuccess(res, 200, "Lấy thống kê chi phí thành công", stats);
  }
}

module.exports = new ExpenseController();

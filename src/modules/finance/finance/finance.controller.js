const FinanceService = require('./finance.service');
const { createHttpError, sendSuccess } = require('../../../core/utils/http');

class FinanceController {
  async getDashboard(req, res) {
    const { year } = req.query;
    if (!year) {
      throw createHttpError(400, "Vui lòng cung cấp năm (year)");
    }
    const data = await FinanceService.getDashboard(year);
    return sendSuccess(res, 200, "Lấy thống kê tài chính thành công", data);
  }
}

module.exports = new FinanceController();

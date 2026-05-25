const SalaryService = require('../services/SalaryService');
const { sendSuccess } = require('../utils/http');

class SalaryController {
  async generateSalary(req, res) {
    const { month } = req.body;
    if (!month) {
      return res.status(400).json({ status: 'error', message: 'Month is required (MM/YYYY)' });
    }
    
    const count = await SalaryService.generateSalaryForMonth(month);
    return sendSuccess(res, 200, `Generated ${count} salary records for ${month}`, { count });
  }

  async getSalaries(req, res) {
    const { month, search } = req.query;
    if (!month) {
      return res.status(400).json({ status: 'error', message: 'Month is required (MM/YYYY)' });
    }

    const records = await SalaryService.getSalaries(month, search);
    return sendSuccess(res, 200, "Get salaries success", records);
  }

  async batchUpdate(req, res) {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ status: 'error', message: 'Updates must be an array' });
    }

    await SalaryService.batchUpdateSalaries(updates);
    return sendSuccess(res, 200, "Batch update successful");
  }

  async paySalary(req, res) {
    const { id } = req.params;
    const { paymentMethod } = req.body;

    const record = await SalaryService.paySalary(id, paymentMethod);
    return sendSuccess(res, 200, "Pay salary success", record);
  }

  async getStaffHistory(req, res) {
    const { staffId } = req.params;
    const records = await SalaryService.getStaffSalaryHistory(staffId);
    return sendSuccess(res, 200, "Get staff salary history success", records);
  }
}

module.exports = new SalaryController();

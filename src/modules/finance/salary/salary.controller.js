const SalaryService = require('./salary.service');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');

class SalaryController {
  async generateSalary(req, res) {
    const { month } = req.body;
    if (!month) {
      return res
        .status(400)
        .json({ status: "error", message: "Month is required (MM/YYYY)" });
    }

    const count = await SalaryService.generateSalaryForMonth(month);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.SALARIES,
      description: `Khởi tạo bảng lương cho tháng ${month} (${count} nhân viên)`,
      metadata: { month, count },
      req,
    });
    return sendSuccess(
      res,
      200,
      `Generated ${count} salary records for ${month}`,
      { count },
    );
  }

  async getSalaries(req, res) {
    const { month, search } = req.query;
    if (!month) {
      return res
        .status(400)
        .json({ status: "error", message: "Month is required (MM/YYYY)" });
    }

    const records = await SalaryService.getSalaries(month, search);
    return sendSuccess(res, 200, "Get salaries success", records);
  }

  async batchUpdate(req, res) {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res
        .status(400)
        .json({ status: "error", message: "Updates must be an array" });
    }

    const changesList = await SalaryService.batchUpdateSalaries(updates);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.SALARIES,
      description: `Cập nhật thông tin bảng lương hàng loạt`,
      metadata: { updatesCount: updates.length, changesList },
      req,
    });
    return sendSuccess(res, 200, "Batch update successful");
  }

  async paySalary(req, res) {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    const userId = req.user._id;

    const record = await SalaryService.paySalary(id, paymentMethod, userId);
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.SALARIES,
      resourceId: id,
      resourceName: record.staffName,
      description: `Duyệt chi thanh toán lương tháng ${record.month} cho nhân viên "${record.staffName}" qua ${paymentMethod}`,
      metadata: {
        recordId: id,
        staffId: record.staffId,
        amount: record.finalReceivedAmount,
        paymentMethod,
      },
      req,
    });
    return sendSuccess(res, 200, "Pay salary success", record);
  }

  async getStaffHistory(req, res) {
    const { staffId } = req.params;
    const records = await SalaryService.getStaffSalaryHistory(staffId);
    return sendSuccess(res, 200, "Get staff salary history success", records);
  }
}

module.exports = new SalaryController();

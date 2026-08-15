const IntegrationLogService = require('./integrationLog.service');
const { sendSuccess } = require('../../../core/utils/http');

class IntegrationLogController {
  async getLogs(req, res) {
    const result = await IntegrationLogService.listLogs(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách log thành công', result);
  }

  async getLogById(req, res) {
    const { id } = req.params;
    const log = await IntegrationLogService.getLogById(id);
    if (!log) {
      return sendSuccess(res, 404, 'Không tìm thấy log', null);
    }
    return sendSuccess(res, 200, 'Lấy chi tiết log thành công', log);
  }
}

module.exports = new IntegrationLogController();

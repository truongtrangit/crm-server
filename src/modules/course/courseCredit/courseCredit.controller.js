const courseCreditService = require('./courseCredit.service');
const { sendSuccess } = require('../../../core/utils/http');

class CourseCreditController {
  getTopupHistory = async (req, res) => {
    const result = await courseCreditService.getTopupHistory(req.query);
    return sendSuccess(
      res,
      200,
      'Lấy lịch sử nạp credit thành công',
      result
    );
  };
}

module.exports = new CourseCreditController();

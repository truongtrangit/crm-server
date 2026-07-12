const creditService = require('./credit.service');
const SystemLogService = require('../../system/log/systemLog.service');
const { sendSuccess } = require('../../../core/utils/http');

class CreditController {
  redeemVoucher = async (req, res, next) => {
    try {
      const customerId = req.user.id || req.user._id; // Extracted from Botvn auth token
      const { code } = req.body;
      const idempotencyKey = req.headers['idempotency-key'];

      const result = await creditService.redeemVoucher(
        customerId,
        code,
        idempotencyKey,
      );

      SystemLogService.log({
        action: 'update',
        resource: 'customers',
        resourceId: customerId,
        resourceName: req.user.name,
        description: `Sử dụng mã voucher ${code} nhận ${result.mainCredit} credit chính, ${result.rewardCredit} credit tặng, ${result.eduCredit} credit giáo dục`,
        req,
      });

      return sendSuccess(res, 200, 'Voucher redeemed successfully', result);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          statusCode: 400,
          message: 'Mã code đã được nạp trước đó hoặc yêu cầu trùng lặp.',
        });
      }
      next(error);
    }
  };

  redeemSmaxAi = async (req, res, next) => {
    try {
      const customerId = req.user.id || req.user._id;
      const { code } = req.body;
      const idempotencyKey = req.headers['idempotency-key'];

      const result = await creditService.redeemSmaxAi(
        customerId,
        code,
        idempotencyKey,
      );

      SystemLogService.log({
        action: 'update',
        resource: 'customers',
        resourceId: customerId,
        resourceName: req.user.name,
        description: `Sử dụng mã SmaxAi ${code} nhận ${result.amount} credit`,
        req,
      });

      return sendSuccess(res, 200, 'Nạp SmaxAi thành công', result);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          statusCode: 400,
          message: 'Mã code đã được nạp trước đó hoặc yêu cầu trùng lặp.',
        });
      }
      next(error);
    }
  };

  getCredits = async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const credits = await creditService.getCredits(customerId);

    return sendSuccess(res, 200, 'Get credits successfully', credits);
  };

  getHistory = async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const type = req.query.type || 'IN';
    const history = await creditService.getHistory(customerId, type);

    return sendSuccess(res, 200, 'Get history successfully', history);
  };
}

module.exports = new CreditController();

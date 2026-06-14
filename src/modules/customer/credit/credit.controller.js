const creditService = require("./credit.service");
const SystemLogService = require("../../system/log/systemLog.service");
const { sendSuccess } = require("../../../core/utils/http");

class CreditController {
  redeemVoucher = async (req, res) => {
    const customerId = req.user.id || req.user._id; // Extracted from Botvn auth token
    const { code } = req.body;

    const result = await creditService.redeemVoucher(customerId, code);

    SystemLogService.log({
      action: "update",
      resource: "customers",
      resourceId: customerId,
      resourceName: req.user.name,
      description: `Sử dụng mã voucher ${code} nhận ${result.rewardPoints} credit thưởng`,
      req,
    });

    return sendSuccess(res, 200, "Voucher redeemed successfully", result);
  };

  getCredits = async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const credits = await creditService.getCredits(customerId);

    return sendSuccess(res, 200, "Get credits successfully", credits);
  };
}

module.exports = new CreditController();

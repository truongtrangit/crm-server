const CheckoutService = require("./checkout.service");
const { sendSuccess } = require("../../core/utils/http");

class CheckoutController {
  async processCheckout(req, res) {
    const studentId = req.customer.id; // From auth middleware
    const { items } = req.body;

    const result = await CheckoutService.processCheckout(studentId, items);

    return sendSuccess(res, 200, "Thanh toán thành công", result);
  }
}

module.exports = new CheckoutController();

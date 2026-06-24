const express = require("express");
const router = express.Router();
const checkoutController = require("../../../modules/checkout/checkout.controller");
const { verifyCustomerAuth } = require("../../../middlewares/customerAuth.middleware");

// Checkout requires the user to be logged in
router.post(
  "/",
  verifyCustomerAuth,
  checkoutController.processCheckout.bind(checkoutController)
);

module.exports = router;

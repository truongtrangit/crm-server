const express = require("express");
const router = express.Router();
const checkoutController = require("../../../modules/checkout/checkout.controller");
const {
  verifyCustomerAuth,
} = require("../../../middlewares/customerAuth.middleware");
const validate = require("../../../core/middleware/validate");
const checkoutValidation = require("../../../modules/checkout/checkout.validation");

// Checkout requires the user to be logged in
router.post(
  "/",
  verifyCustomerAuth,
  validate(checkoutValidation.processCheckout),
  checkoutController.processCheckout.bind(checkoutController),
);

module.exports = router;

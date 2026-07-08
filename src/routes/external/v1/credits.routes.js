const { Router } = require("express");
const creditController = require("../../../modules/customer/credit/credit.controller");
const {
  voucherRedeemLimiter,
} = require("../../../core/middleware/rateLimiter");
const {
  botvnAuthenticateRequest,
} = require("../../../core/middleware/externalAuth");
const validate = require("../../../core/middleware/validate");
const creditValidation = require("../../../modules/customer/credit/credit.validation");

const creditsRouter = Router();

// Apply auth to all credit routes
creditsRouter.use(botvnAuthenticateRequest);

// /api/external/v1/credits

// Get current user's credits
creditsRouter.get("/", creditController.getCredits);

// Get current user's deposit history
creditsRouter.get("/history", creditController.getHistory);

// Redeem a voucher with Rate Limiting (10 requests / 15 mins)
creditsRouter.post(
  "/voucher/redeem",
  voucherRedeemLimiter,
  validate(creditValidation.redeemVoucher, "body"),
  creditController.redeemVoucher,
);

// Redeem SmaxAi code
creditsRouter.post(
  "/smaxai/redeem",
  voucherRedeemLimiter, // Can reuse the same rate limiter for now
  validate(creditValidation.redeemSmaxAi, "body"),
  creditController.redeemSmaxAi,
);

module.exports = creditsRouter;

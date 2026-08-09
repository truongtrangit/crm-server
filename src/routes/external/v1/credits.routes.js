const { Router } = require("express");
const creditController = require("../../../modules/customer/credit/credit.controller");
const topupRequestController = require("../../../modules/customer/credit/topupRequest.controller");
const {
  voucherRedeemLimiter,
} = require("../../../core/middleware/rateLimiter");
const {
  botvnAuthenticateRequest,
} = require("../../../core/middleware/externalAuth");
const validate = require("../../../core/middleware/validate");
const creditValidation = require("../../../modules/customer/credit/credit.validation");
const topupRequestValidation = require("../../../modules/customer/credit/topupRequest.validation");

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

// ─── Bank Transfer Topup ──────────────────────────────────────────────────

// Get topup config (bank info, quick amounts, etc.)
creditsRouter.get("/topup-config", topupRequestController.getTopupConfig);

// Create a new topup request
creditsRouter.post(
  "/topup-request",
  validate(topupRequestValidation.createTopupRequest, "body"),
  topupRequestController.createTopupRequest,
);

// Confirm transfer (user says they've transferred)
creditsRouter.put(
  "/topup-request/:id/confirm",
  topupRequestController.confirmTransfer,
);

creditsRouter.post(
  "/topup-request/:id/cancel",
  topupRequestController.cancelRequest,
);

// Get user's topup requests
creditsRouter.get("/topup-requests", topupRequestController.getMyRequests);

// ─── Billing Info ─────────────────────────────────────────────────────────

// Get saved billing info
creditsRouter.get("/billing-info", topupRequestController.getBillingInfo);

// Save billing info
creditsRouter.put(
  "/billing-info",
  validate(topupRequestValidation.saveBillingInfo, "body"),
  topupRequestController.saveBillingInfo,
);

module.exports = creditsRouter;

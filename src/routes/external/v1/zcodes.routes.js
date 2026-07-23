const express = require('express');
const ZCodeController = require('../../../modules/zcode/zcode.controller');
const env = require('../../../core/config/env');
const { requireApiKey } = require('../../../core/middleware/externalAuth');
const { EXTERNAL_SYSTEMS } = require('../../../core/constants/externalSystems');
const {
  checkZcodeIpAllowlist,
} = require('../../../core/middleware/zcodeAuth');
const {
  zcodeRedeemLimiter,
} = require('../../../core/middleware/rateLimiter');

const router = express.Router();

// POST /api/external/v1/zcodes/redeem
router.post(
  '/redeem',
  requireApiKey(env.zcodeApiKey, EXTERNAL_SYSTEMS.ZCODE),
  checkZcodeIpAllowlist,
  zcodeRedeemLimiter,
  ZCodeController.redeemCode,
);

module.exports = router;

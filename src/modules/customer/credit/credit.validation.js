const Joi = require("joi");

const redeemVoucher = Joi.object({
  code: Joi.string().required(),
});

const redeemSmaxAi = Joi.object({
  code: Joi.string().required(),
});

module.exports = {
  redeemVoucher,
  redeemSmaxAi,
};

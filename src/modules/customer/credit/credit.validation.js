const Joi = require("joi");

const redeemVoucher = Joi.object({
  code: Joi.string().required(),
});

module.exports = {
  redeemVoucher,
};

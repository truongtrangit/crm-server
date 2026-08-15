const Joi = require("joi");

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
});

const registerSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email",
    "any.required": "Email is required",
  }),
  password: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.pattern.base": "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
      "any.required": "Password is required",
    }),
});

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email",
    "any.required": "Email is required",
  }),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.empty": "OTP is required",
      "string.pattern.base": "OTP phải là 6 chữ số",
      "any.required": "OTP is required",
    }),
});

const resendOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Email must be a valid email",
    "any.required": "Email is required",
  }),
});

module.exports = {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
};

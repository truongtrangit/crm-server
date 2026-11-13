const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
});

const zaloMiniAppLoginSchema = Joi.object({
  zalo_id: Joi.string().required().messages({
    'string.empty': 'zalo_id is required',
    'any.required': 'zalo_id is required',
  }),
  phone: Joi.string().required().messages({
    'string.empty': 'phone is required',
    'any.required': 'phone is required',
  }),
  name: Joi.string().allow('').optional(),
  avatar: Joi.string().allow('').optional(),
});

const registerSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Name is required',
    'any.required': 'Name is required',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email',
    'any.required': 'Email is required',
  }),
  password: Joi.string()
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    )
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.pattern.base':
        'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
      'any.required': 'Password is required',
    }),
});

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email',
    'any.required': 'Email is required',
  }),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.empty': 'OTP is required',
      'string.pattern.base': 'OTP phải là 6 chữ số',
      'any.required': 'OTP is required',
    }),
});

const resendOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email',
    'any.required': 'Email is required',
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email',
    'any.required': 'Email is required',
  }),
});

const forgotPasswordVerifyOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email',
    'any.required': 'Email is required',
  }),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.empty': 'OTP is required',
      'string.pattern.base': 'OTP phải là 6 chữ số',
      'any.required': 'OTP is required',
    }),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email',
    'any.required': 'Email is required',
  }),
  resetToken: Joi.string().trim().required().messages({
    'string.empty': 'Reset token is required',
    'any.required': 'Reset token is required',
  }),
  newPassword: Joi.string()
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    )
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.pattern.base':
        'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
      'any.required': 'Password is required',
    }),
});

const googleLoginSchema = Joi.object({
  idToken: Joi.string().optional().messages({
    'string.empty': 'Google ID token must not be empty',
  }),
  accessToken: Joi.string().optional().messages({
    'string.empty': 'Google access token must not be empty',
  }),
}).or('idToken', 'accessToken').messages({
  'object.missing': 'Either idToken or accessToken is required',
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Tên không được để trống',
    'any.required': 'Tên không được để trống',
  }),
  phone: Joi.string().allow('').optional(),
  bio: Joi.string().allow('').optional(),
  jobTitle: Joi.string().allow('').optional(),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().allow('').optional(),
  newPassword: Joi.string()
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    )
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.pattern.base':
        'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
      'any.required': 'Password is required',
    }),
});

const deleteAccountSchema = Joi.object({
  password: Joi.string().allow('').optional(),
});

module.exports = {
  loginSchema,
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  forgotPasswordVerifyOtpSchema,
  resetPasswordSchema,
  googleLoginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  zaloMiniAppLoginSchema,
};

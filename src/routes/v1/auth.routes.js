const express = require("express");
const {
  authenticateRequest,
  requirePermission,
} = require('../../core/middleware/auth');
const validate = require('../../core/middleware/validate');
const { PERMISSIONS } = require('../../core/constants/rbac');
const AuthController = require('../../modules/system/auth/auth.controller');
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  registerSchema,
} = require('../../modules/system/auth/auth.validation');

const router = express.Router();

router.post("/login", validate(loginSchema), AuthController.login);

router.post("/refresh", AuthController.refresh);

router.post("/forgot-password", validate(forgotPasswordSchema), AuthController.forgotPassword);

router.post("/reset-password", validate(resetPasswordSchema), AuthController.resetPassword);

router.post("/logout", AuthController.logout);

router.get("/me", authenticateRequest, AuthController.getMe);

router.put("/me", authenticateRequest, validate(updateProfileSchema), AuthController.updateMe);

router.post("/change-password", authenticateRequest, validate(changePasswordSchema), AuthController.changePassword);

router.post(
  "/register",
  authenticateRequest,
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate(registerSchema),
  AuthController.register
);

module.exports = router;

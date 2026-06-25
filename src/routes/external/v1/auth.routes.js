const express = require("express");
const BotvnAuthController = require("../../../modules/customer/botvnAuth/botvnAuth.controller");

const validate = require("../../../core/middleware/validate");
const {
  loginSchema,
  registerSchema,
} = require("../../../modules/customer/botvnAuth/botvnAuth.validation");

const router = express.Router();

router.post("/login", validate(loginSchema), BotvnAuthController.login);
router.post(
  "/register",
  validate(registerSchema),
  BotvnAuthController.register,
);
router.post("/logout", BotvnAuthController.logout);

module.exports = router;

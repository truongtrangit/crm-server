const express = require("express");
const BotvnAuthController = require("../../../modules/customer/botvnAuth/botvnAuth.controller");

const router = express.Router();

router.post("/login", BotvnAuthController.login);

module.exports = router;

const express = require("express");
const CourseConfigService = require("../../../modules/course/courseConfig/courseConfig.service");
const { sendSuccess } = require("../../../core/utils/http");

const router = express.Router();

// GET /api/external/v1/config/botvn
router.get("/botvn", async (req, res, next) => {
  try {
    const config = await CourseConfigService.getBotvnConfig();
    return sendSuccess(res, 200, "Get botvn config success", { config });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

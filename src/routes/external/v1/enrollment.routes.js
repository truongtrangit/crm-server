const express = require("express");
const CourseEnrollmentController = require("../../../modules/course/courseEnrollment/courseEnrollment.controller");
const { botvnAuthenticateRequest } = require("../../../core/middleware/externalAuth");

const router = express.Router();

router.use(botvnAuthenticateRequest);
router.get("/my", CourseEnrollmentController.getMyEnrollments);

module.exports = router;

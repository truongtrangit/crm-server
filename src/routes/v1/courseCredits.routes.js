const { Router } = require('express');
const courseCreditController = require('../../modules/course/courseCredit/courseCredit.controller');
const validate = require('../../core/middleware/validate');
const courseCreditValidation = require('../../modules/course/courseCredit/courseCredit.validation');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const courseCreditsRouter = Router();

// /api/v1/courses/credits/topup-history
courseCreditsRouter.get(
  '/topup-history',
  requirePermission(PERMISSIONS.COURSES_CREDITS_READ),
  validate(courseCreditValidation.getTopupHistory, 'query'),
  courseCreditController.getTopupHistory,
);

module.exports = courseCreditsRouter;

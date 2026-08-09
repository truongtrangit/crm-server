const { Router } = require('express');
const courseCreditController = require('../../modules/course/courseCredit/courseCredit.controller');
const topupRequestController = require('../../modules/customer/credit/topupRequest.controller');
const validate = require('../../core/middleware/validate');
const courseCreditValidation = require('../../modules/course/courseCredit/courseCredit.validation');
const topupRequestValidation = require('../../modules/customer/credit/topupRequest.validation');
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

// ─── Topup Requests (Admin) ───────────────────────────────────────────────

// Get topup request stats
courseCreditsRouter.get(
  '/topup-requests/stats',
  requirePermission(PERMISSIONS.COURSES_CREDITS_READ),
  topupRequestController.adminGetStats,
);

// Get list of topup requests
courseCreditsRouter.get(
  '/topup-requests',
  requirePermission(PERMISSIONS.COURSES_CREDITS_READ),
  validate(topupRequestValidation.adminGetRequests, 'query'),
  topupRequestController.adminGetRequests,
);

// Get single topup request detail
courseCreditsRouter.get(
  '/topup-requests/:id',
  requirePermission(PERMISSIONS.COURSES_CREDITS_READ),
  topupRequestController.adminGetRequestById,
);

// Approve topup request
courseCreditsRouter.put(
  '/topup-requests/:id/approve',
  requirePermission(PERMISSIONS.COURSES_CREDITS_MANAGE),
  validate(topupRequestValidation.adminApproveRequest, 'body'),
  topupRequestController.adminApprove,
);

// Reject topup request
courseCreditsRouter.put(
  '/topup-requests/:id/reject',
  requirePermission(PERMISSIONS.COURSES_CREDITS_MANAGE),
  validate(topupRequestValidation.adminRejectRequest, 'body'),
  topupRequestController.adminReject,
);

module.exports = courseCreditsRouter;

const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const asyncHandler = require("../../utils/asyncHandler");
const CustomerController = require("../../controllers/CustomerController");

const {
  createCustomerSchema,
  updateCustomerSchema,
  assignCustomerSchema,
  unassignCustomerQuerySchema,
  listCustomersQuerySchema,
} = require("../../validations/customers");

const router = express.Router();

/**
 * GET /api/customers
 * List all customers - requires customers_read permission
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  validate(listCustomersQuerySchema, "query"),
  asyncHandler(CustomerController.getCustomers)
);

/**
 * GET /api/customers/meta/assignment-roles
 * Get available assignment roles — must be before /:id to avoid conflict
 */
router.get(
  "/meta/assignment-roles",
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  asyncHandler(CustomerController.getAssignmentRoles)
);

/**
 * GET /api/customers/:id
 * Get customer detail - requires customers_read permission
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  asyncHandler(CustomerController.getCustomerById)
);

/**
 * POST /api/customers
 * Create new customer - requires customers_create permission
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CUSTOMERS_CREATE),
  validate(createCustomerSchema),
  asyncHandler(CustomerController.createCustomer)
);

/**
 * PUT /api/customers/:id
 * Update customer - requires customers_update permission
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  validate(updateCustomerSchema),
  asyncHandler(CustomerController.updateCustomer)
);

/**
 * DELETE /api/customers/:id
 * Delete customer - requires customers_delete permission
 */
router.delete(
  "/:id",
  requirePermission(
    [PERMISSIONS.CUSTOMERS_DELETE, PERMISSIONS.CUSTOMERS_READ],
    "any",
  ),
  asyncHandler(CustomerController.deleteCustomer)
);

/**
 * POST /api/customers/:id/assignees
 * Assign a staff member to a customer
 */
router.post(
  "/:id/assignees",
  requirePermission(
    [PERMISSIONS.CUSTOMERS_UPDATE, PERMISSIONS.CUSTOMERS_READ],
    "any",
  ),
  validate(assignCustomerSchema),
  asyncHandler(CustomerController.assignCustomer)
);

/**
 * DELETE /api/customers/:id/assignees/:userId
 * Remove a staff assignment from a customer
 */
router.delete(
  "/:id/assignees/:userId",
  requirePermission(
    [PERMISSIONS.CUSTOMERS_UPDATE, PERMISSIONS.CUSTOMERS_READ],
    "any",
  ),
  validate(unassignCustomerQuerySchema, "query"),
  asyncHandler(CustomerController.unassignCustomer)
);

/**
 * PUT /api/customers/:id/restore
 * Restore a soft-deleted customer - requires customers_delete permission
 */
router.put(
  "/:id/restore",
  requirePermission(PERMISSIONS.CUSTOMERS_DELETE),
  asyncHandler(CustomerController.restoreCustomer)
);

module.exports = router;

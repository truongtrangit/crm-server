const express = require("express");
const { requirePermission } = require("../../middleware/auth");
const validate = require("../../middleware/validate");
const { PERMISSIONS } = require("../../constants/rbac");
const CustomerController = require("../../controllers/CustomerController");

const {
  createCustomerSchema,
  updateCustomerSchema,

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
  CustomerController.getCustomers
);


/**
 * GET /api/customers/:id
 * Get customer detail - requires customers_read permission
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  CustomerController.getCustomerById
);

/**
 * POST /api/customers
 * Create new customer - requires customers_create permission
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CUSTOMERS_CREATE),
  validate(createCustomerSchema),
  CustomerController.createCustomer
);

/**
 * PUT /api/customers/:id
 * Update customer - requires customers_update permission
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  validate(updateCustomerSchema),
  CustomerController.updateCustomer
);

/**
 * DELETE /api/customers/:id
 * Delete customer - requires customers_delete permission
 */
router.delete(
  "/:id",
  requirePermission(
    PERMISSIONS.CUSTOMERS_DELETE
  ),
  CustomerController.deleteCustomer
);


/**
 * PUT /api/customers/:id/restore
 * Restore a soft-deleted customer - requires customers_delete permission
 */
router.put(
  "/:id/restore",
  requirePermission(PERMISSIONS.CUSTOMER_RESTORE),
  CustomerController.restoreCustomer
);

/**
 * DELETE /api/customers/:id/permanent
 * Permanently delete a soft-deleted customer from DB
 */
router.delete(
  "/:id/permanent",
  requirePermission(PERMISSIONS.CUSTOMERS_PERMANENT_DELETE),
  CustomerController.permanentDeleteCustomer
);

module.exports = router;

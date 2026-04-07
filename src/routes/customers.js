const express = require("express");
const Customer = require("../models/Customer");
const User = require("../models/User");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { sendError, sendSuccess } = require("../utils/http");
const {
  buildPaginatedResponse,
  resolvePagination,
} = require("../utils/pagination");
const { requirePermission } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { PERMISSIONS } = require("../constants/rbac");
const {
  ASSIGNMENT_ROLES,
  ASSIGNMENT_ROLE_VALUES,
} = require("../constants/assignmentRoles");
const {
  createCustomerSchema,
  updateCustomerSchema,
  assignCustomerSchema,
  unassignCustomerQuerySchema,
  listCustomersQuerySchema,
} = require("../validations/customers");

const router = express.Router();

/**
 * GET /api/customers
 * List all customers - requires customers_read permission
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  validate(listCustomersQuerySchema, "query"),
  async (req, res) => {
    const { search = "", type, group, platform } = req.query;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(req.query || {});
    const query = {};

    if (searchRegex) {
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    if (type && type !== "All") {
      query.type = type;
    }

    if (group) {
      query.group = group;
    }

    if (platform) {
      query.platforms = platform;
    }

    const [customers, totalItems] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(query),
    ]);

    return sendSuccess(
      res,
      200,
      "Get customer list success",
      buildPaginatedResponse(customers, totalItems, page, limit),
    );
  },
);

/**
 * GET /api/customers/meta/assignment-roles
 * Get available assignment roles — must be before /:id to avoid conflict
 */
router.get(
  "/meta/assignment-roles",
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (_req, res) => {
    return sendSuccess(res, 200, "Get assignment roles success", {
      items: ASSIGNMENT_ROLES,
    });
  },
);

/**
 * GET /api/customers/:id
 * Get customer detail - requires customers_read permission
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.id });

    if (!customer) {
      return sendError(res, 404, "Customer not found", {
        code: "CUSTOMER_NOT_FOUND",
      });
    }

    return sendSuccess(res, 200, "Get customer detail success", customer);
  },
);

/**
 * POST /api/customers
 * Create new customer - requires customers_create permission
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CUSTOMERS_CREATE),
  validate(createCustomerSchema),
  async (req, res) => {
    const payload = req.body || {};

    const customer = await Customer.create({
      id: await generateSequentialId(Customer, "CUST"),
      name: payload.name,
      avatar:
        payload.avatar ||
        `https://i.pravatar.cc/150?u=${encodeURIComponent(payload.email)}`,
      type: payload.type || "Standard Customer",
      email: payload.email,
      phone: payload.phone || "",
      biz: Array.isArray(payload.biz) ? payload.biz.filter(Boolean) : [],
      platforms: Array.isArray(payload.platforms)
        ? payload.platforms.filter(Boolean)
        : [],
      group: payload.group || "",
      registeredAt:
        payload.registeredAt || new Date().toLocaleDateString("vi-VN"),
      lastLoginAt:
        payload.lastLoginAt || new Date().toLocaleDateString("vi-VN"),
      tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [],
    });

    return sendSuccess(res, 201, "Create customer success", customer);
  },
);

/**
 * PUT /api/customers/:id
 * Update customer - requires customers_update permission
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  validate(updateCustomerSchema),
  async (req, res) => {
    const existing = await Customer.findOne({ id: req.params.id });

    if (!existing) {
      return sendError(res, 404, "Customer not found", {
        code: "CUSTOMER_NOT_FOUND",
      });
    }

    Object.assign(existing, {
      name: req.body.name ?? existing.name,
      avatar: req.body.avatar ?? existing.avatar,
      type: req.body.type ?? existing.type,
      email: req.body.email ?? existing.email,
      phone: req.body.phone ?? existing.phone,
      biz: Array.isArray(req.body.biz) ? req.body.biz : existing.biz,
      platforms: Array.isArray(req.body.platforms)
        ? req.body.platforms
        : existing.platforms,
      group: req.body.group ?? existing.group,
      registeredAt: req.body.registeredAt ?? existing.registeredAt,
      lastLoginAt: req.body.lastLoginAt ?? existing.lastLoginAt,
      tags: Array.isArray(req.body.tags) ? req.body.tags : existing.tags,
    });

    await existing.save();
    return sendSuccess(res, 200, "Update customer success", existing);
  },
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
  async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.id });

    if (!customer) {
      return sendError(res, 404, "Customer not found", {
        code: "CUSTOMER_NOT_FOUND",
      });
    }

    const currentUserId = req.user?.id;
    const assignees = Array.isArray(customer.assignees) ? customer.assignees : [];
    const hasAssigneeOtherThanCurrentUser = assignees.some(
      (assignee) => assignee.userId !== currentUserId,
    );

    if (hasAssigneeOtherThanCurrentUser) {
      return sendError(
        res,
        403,
        "Cannot delete customer while assigned to other users",
        {
          code: "CUSTOMER_HAS_OTHER_ASSIGNEES",
        },
      );
    }

    await customer.deleteOne();

    return sendSuccess(res, 200, "Delete customer success", null);
  },
);

/**
 * POST /api/customers/:id/assignees
 * Assign a staff member to a customer
 * Body: { userId: string, role: string }
 * Authorization:
 *   - OWNER/ADMIN: can assign anyone
 *   - MANAGER: can assign self + staff under them (managerId match)
 *   - STAFF: can only assign self
 */
router.post(
  "/:id/assignees",
  requirePermission(
    [PERMISSIONS.CUSTOMERS_UPDATE, PERMISSIONS.CUSTOMERS_READ],
    "any",
  ),
  validate(assignCustomerSchema),
  async (req, res) => {
    const { userId, role } = req.body || {};

    // Validate role
    if (!ASSIGNMENT_ROLE_VALUES.includes(role)) {
      return sendError(res, 400, `Invalid assignment role: ${role}. Valid roles: ${ASSIGNMENT_ROLE_VALUES.join(", ")}`, {
        code: "INVALID_ASSIGNMENT_ROLE",
      });
    }

    // Find the customer
    const customer = await Customer.findOne({ id: req.params.id });
    if (!customer) {
      return sendError(res, 404, "Customer not found", {
        code: "CUSTOMER_NOT_FOUND",
      });
    }

    // Find the target user to assign
    const targetUser = await User.findOne({ id: userId });
    if (!targetUser) {
      return sendError(res, 404, "User not found", {
        code: "USER_NOT_FOUND",
      });
    }

    // Authorization check
    const currentUser = req.user;
    const currentRole = currentUser.role.toUpperCase();

    if (currentRole === "MANAGER") {
      // Manager can assign self or staff under them
      const isSelf = currentUser.id === userId;
      const isSubordinate = targetUser.managerId === currentUser.id;
      if (!isSelf && !isSubordinate) {
        return sendError(res, 403, "Manager chỉ có thể gán cho chính mình hoặc nhân viên dưới quyền", {
          code: "FORBIDDEN",
        });
      }
    } else if (currentRole === "STAFF") {
      // Staff can only assign self
      if (currentUser.id !== userId) {
        return sendError(res, 403, "Staff chỉ có thể gán cho chính mình", {
          code: "FORBIDDEN",
        });
      }
    }
    // OWNER and ADMIN can assign anyone — no extra check needed

    // Check for duplicate assignment (same user + same role)
    const isDuplicate = customer.assignees.some(
      (a) => a.userId === userId && a.role === role,
    );
    if (isDuplicate) {
      return sendError(res, 409, "Nhân viên này đã được gán với vai trò này", {
        code: "DUPLICATE_ASSIGNMENT",
      });
    }

    // Add the assignment
    customer.assignees.push({
      userId: targetUser.id,
      userName: targetUser.name,
      userAvatar: targetUser.avatar || "",
      role,
      assignedAt: new Date(),
      assignedBy: currentUser.id,
    });

    await customer.save();
    return sendSuccess(res, 200, "Assign staff success", customer);
  },
);

/**
 * DELETE /api/customers/:id/assignees/:userId
 * Remove a staff assignment from a customer
 * Query: ?role=sale (to specify which assignment to remove)
 * Authorization: Same rules as assign
 */
router.delete(
  "/:id/assignees/:userId",
  requirePermission(
    [PERMISSIONS.CUSTOMERS_UPDATE, PERMISSIONS.CUSTOMERS_READ],
    "any",
  ),
  validate(unassignCustomerQuerySchema, "query"),
  async (req, res) => {
    const { userId } = req.params;
    const { role } = req.query;

    const customer = await Customer.findOne({ id: req.params.id });
    if (!customer) {
      return sendError(res, 404, "Customer not found", {
        code: "CUSTOMER_NOT_FOUND",
      });
    }

    // Authorization check
    const currentUser = req.user;
    const currentRole = currentUser.role.toUpperCase();

    if (currentRole === "MANAGER") {
      const targetUser = await User.findOne({ id: userId });
      const isSelf = currentUser.id === userId;
      const isSubordinate = targetUser && targetUser.managerId === currentUser.id;
      if (!isSelf && !isSubordinate) {
        return sendError(res, 403, "Manager chỉ có thể gỡ gán cho chính mình hoặc nhân viên dưới quyền", {
          code: "FORBIDDEN",
        });
      }
    } else if (currentRole === "STAFF") {
      if (currentUser.id !== userId) {
        return sendError(res, 403, "Staff chỉ có thể gỡ gán cho chính mình", {
          code: "FORBIDDEN",
        });
      }
    }

    const before = customer.assignees.length;
    customer.assignees = customer.assignees.filter(
      (a) => !(a.userId === userId && a.role === role),
    );

    if (customer.assignees.length === before) {
      return sendError(res, 404, "Assignment not found", {
        code: "ASSIGNMENT_NOT_FOUND",
      });
    }

    await customer.save();
    return sendSuccess(res, 200, "Unassign staff success", customer);
  },
);



module.exports = router;

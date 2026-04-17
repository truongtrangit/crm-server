const Customer = require("../models/Customer");
const User = require("../models/User");
const { generateSequentialId } = require("../utils/id");
const { buildSearchRegex } = require("../utils/query");
const { resolvePagination } = require("../utils/pagination");
const { ASSIGNMENT_ROLES, ASSIGNMENT_ROLE_VALUES } = require("../constants/assignmentRoles");
const { createHttpError } = require("../utils/http");
const { getUserRoleName } = require("../utils/rbac");

class CustomerService {
  async getCustomers(queryParams) {
    const { search = "", type, group, platform } = queryParams;
    const searchRegex = buildSearchRegex(search);
    const { page, limit, skip } = resolvePagination(queryParams || {});
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

    return { customers, totalItems, page, limit };
  }

  getAssignmentRoles() {
    return ASSIGNMENT_ROLES;
  }

  async getCustomerById(id) {
    const customer = await Customer.findOne({ id });
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }
    return customer;
  }

  async createCustomer(payload) {
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
    return customer;
  }

  async updateCustomer(id, payload) {
    const existing = await Customer.findOne({ id });
    if (!existing) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }

    Object.assign(existing, {
      name: payload.name ?? existing.name,
      avatar: payload.avatar ?? existing.avatar,
      type: payload.type ?? existing.type,
      email: payload.email ?? existing.email,
      phone: payload.phone ?? existing.phone,
      biz: Array.isArray(payload.biz) ? payload.biz : existing.biz,
      platforms: Array.isArray(payload.platforms)
        ? payload.platforms
        : existing.platforms,
      group: payload.group ?? existing.group,
      registeredAt: payload.registeredAt ?? existing.registeredAt,
      lastLoginAt: payload.lastLoginAt ?? existing.lastLoginAt,
      tags: Array.isArray(payload.tags) ? payload.tags : existing.tags,
    });

    await existing.save();
    return existing;
  }

  async deleteCustomer(id, currentUserId) {
    const customer = await Customer.findOne({ id });
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }

    const assignees = Array.isArray(customer.assignees) ? customer.assignees : [];
    const hasAssigneeOtherThanCurrentUser = assignees.some(
      (assignee) => assignee.userId !== currentUserId,
    );

    if (hasAssigneeOtherThanCurrentUser) {
      throw createHttpError(403, "Cannot delete customer while assigned to other users", {
        code: "CUSTOMER_HAS_OTHER_ASSIGNEES",
      });
    }

    await customer.deleteOne();
  }

  async assignCustomer(customerId, assignData, currentUser) {
    const { userId, role } = assignData;

    // Validate role
    if (!ASSIGNMENT_ROLE_VALUES.includes(role)) {
      throw createHttpError(400, `Invalid assignment role: ${role}. Valid roles: ${ASSIGNMENT_ROLE_VALUES.join(", ")}`, {
        code: "INVALID_ASSIGNMENT_ROLE",
      });
    }

    // Find the customer
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }

    // Find target user
    const targetUser = await User.findOne({ id: userId });
    if (!targetUser) {
      throw createHttpError(404, "User not found", { code: "USER_NOT_FOUND" });
    }

    // Authorization check
    const currentRole = (await getUserRoleName(currentUser) || "STAFF").toUpperCase();
    if (currentRole === "MANAGER") {
      const isSelf = currentUser.id === userId;
      const isSubordinate = targetUser.managerId === currentUser.id;
      if (!isSelf && !isSubordinate) {
        throw createHttpError(403, "Manager chỉ có thể gán cho chính mình hoặc nhân viên dưới quyền", {
          code: "FORBIDDEN",
        });
      }
    } else if (currentRole === "STAFF") {
      if (currentUser.id !== userId) {
        throw createHttpError(403, "Staff chỉ có thể gán cho chính mình", {
          code: "FORBIDDEN",
        });
      }
    }

    // Check for duplicate
    const isDuplicate = customer.assignees.some(
      (a) => a.userId === userId && a.role === role,
    );
    if (isDuplicate) {
      throw createHttpError(409, "Nhân viên này đã được gán với vai trò này", {
        code: "DUPLICATE_ASSIGNMENT",
      });
    }

    // Add assignment
    customer.assignees.push({
      userId: targetUser.id,
      userName: targetUser.name,
      userAvatar: targetUser.avatar || "",
      role,
      assignedAt: new Date(),
      assignedBy: currentUser.id,
    });

    await customer.save();
    return customer;
  }

  async unassignCustomer(customerId, userId, role, currentUser) {
    const customer = await Customer.findOne({ id: customerId });
    if (!customer) {
      throw createHttpError(404, "Customer not found", { code: "CUSTOMER_NOT_FOUND" });
    }

    // Authorization check
    const currentRole = (await getUserRoleName(currentUser) || "STAFF").toUpperCase();
    if (currentRole === "MANAGER") {
      const targetUser = await User.findOne({ id: userId });
      const isSelf = currentUser.id === userId;
      const isSubordinate = targetUser && targetUser.managerId === currentUser.id;
      if (!isSelf && !isSubordinate) {
        throw createHttpError(403, "Manager chỉ có thể gỡ gán cho chính mình hoặc nhân viên dưới quyền", {
          code: "FORBIDDEN",
        });
      }
    } else if (currentRole === "STAFF") {
      if (currentUser.id !== userId) {
        throw createHttpError(403, "Staff chỉ có thể gỡ gán cho chính mình", {
          code: "FORBIDDEN",
        });
      }
    }

    const before = customer.assignees.length;
    customer.assignees = customer.assignees.filter(
      (a) => !(a.userId === userId && a.role === role),
    );

    if (customer.assignees.length === before) {
      throw createHttpError(404, "Assignment not found", {
        code: "ASSIGNMENT_NOT_FOUND",
      });
    }

    await customer.save();
    return customer;
  }
}

module.exports = new CustomerService();

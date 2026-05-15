const { getManagerSubordinateIds } = require("./managerScope");

/**
 * Build MongoDB query filter for resource-level scoping.
 * Dùng trong List endpoints để filter data theo quyền user.
 *
 * - OWNER/ADMIN: không filter (thấy tất cả)
 * - MANAGER: thấy resource của mình + subordinates (cùng phòng ban) + unassigned
 * - STAFF: thấy resource của mình (assigned/created) + unassigned
 *
 * @param {Object} currentUser - User document từ req.user
 * @param {Object} [options]
 * @param {string} [options.assigneeField='assignees.userId'] - Path đến assignee userId
 * @param {string} [options.creatorField='createdBy'] - Path đến createdBy field
 * @param {boolean} [options.includeUnassigned=true] - Bao gồm resource chưa assign?
 * @param {string} [options.assigneesArrayField='assignees'] - Field name cho $size check
 * @returns {Object} MongoDB query clause (hoặc {} nếu bypass)
 */
async function buildResourceScopeFilter(currentUser, options = {}) {
  const role = (currentUser?.roleId || "").toUpperCase();

  // OWNER/ADMIN → see everything
  if (["OWNER", "ADMIN"].includes(role)) return {};

  const assigneeField = options.assigneeField || "assignees.userId";
  const creatorField = options.creatorField || "createdBy";
  const includeUnassigned = options.includeUnassigned ?? true;
  const assigneesArrayField = options.assigneesArrayField || "assignees";

  // Collect allowed user IDs (self + department-based subordinates for MANAGER)
  const allowedUserIds = [currentUser.id];

  if (role === "MANAGER") {
    const subIds = await getManagerSubordinateIds(currentUser);
    allowedUserIds.push(...subIds);
  }

  // Deduplicate
  const uniqueIds = [...new Set(allowedUserIds)];

  const orConditions = [
    { [assigneeField]: { $in: uniqueIds } },
    { [creatorField]: { $in: uniqueIds } },
  ];

  if (includeUnassigned) {
    orConditions.push({ [assigneesArrayField]: { $size: 0 } });
    orConditions.push({ [assigneesArrayField]: { $exists: false } });
  }

  return { $or: orConditions };
}

module.exports = { buildResourceScopeFilter };

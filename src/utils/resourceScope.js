const { getManagerSubordinateIds, isUserManagerial } = require("./managerScope");
const { isOwnerOrAdmin } = require("./userRoles");

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
  if (isOwnerOrAdmin(role)) return {};

  const assigneeField = options.assigneeField || "assignees.userId";
  const creatorField = options.creatorField || "createdBy";
  const includeUnassigned = options.includeUnassigned ?? true;
  const assigneesArrayField = options.assigneesArrayField || "assignees";

  // Behavioral Flags (matching requireResourceAccess)
  const allowAssignee = options.allowAssignee ?? true;
  const allowManagerSubordinateAssignee = options.allowManagerSubordinateAssignee ?? true;
  const allowCreator = options.allowCreator ?? false;
  const allowManagerSubordinateCreator = options.allowManagerSubordinateCreator ?? false;

  const isManagerial = isUserManagerial(currentUser);

  // Collect allowed user IDs for Assignee
  const assigneeUserIds = [];
  if (allowAssignee) assigneeUserIds.push(currentUser.id);
  if (isManagerial && allowManagerSubordinateAssignee) {
    const subIds = await getManagerSubordinateIds(currentUser);
    assigneeUserIds.push(...subIds);
  }

  // Collect allowed user IDs for Creator
  const creatorUserIds = [];
  if (allowCreator) creatorUserIds.push(currentUser.id);
  if (isManagerial && allowManagerSubordinateCreator) {
    const subIds = await getManagerSubordinateIds(currentUser);
    creatorUserIds.push(...subIds);
  }

  const orConditions = [];

  if (assigneeUserIds.length > 0) {
    orConditions.push({ [assigneeField]: { $in: [...new Set(assigneeUserIds)] } });
  }

  if (creatorUserIds.length > 0) {
    orConditions.push({ [creatorField]: { $in: [...new Set(creatorUserIds)] } });
  }

  if (includeUnassigned) {
    orConditions.push({ [assigneesArrayField]: { $size: 0 } });
    orConditions.push({ [assigneesArrayField]: { $exists: false } });
  }

  const filter = {};
  
  if (options.moduleTypeFilter) {
    const { field, mapping } = options.moduleTypeFilter;
    const moduleAccess = currentUser.moduleAccess || [];
    const allowedValues = [];
    
    for (const [moduleId, value] of Object.entries(mapping)) {
      if (moduleAccess.some(e => e.isEnabled && e.moduleId === moduleId)) {
        allowedValues.push(value);
      }
    }

    if (allowedValues.length === 0) {
      return { _id: null }; // Cannot match anything
    } else if (allowedValues.length < Object.keys(mapping).length) {
      filter[field] = { $in: allowedValues };
    }
  }

  if (Object.keys(filter).length > 0) {
    return { $and: [filter, { $or: orConditions }] };
  }
  
  return { $or: orConditions };
}

module.exports = { buildResourceScopeFilter };

const User = require("../models/User");
const { sendError } = require("../utils/http");

/**
 * Universal resource-level access check middleware.
 * Chạy SAU requirePermission(), TRƯỚC controller.
 *
 * Quy tắc:
 * - OWNER/ADMIN: bypass hoàn toàn
 * - MANAGER: có quyền nếu là assignee, creator, hoặc manager của 1 assignee
 * - STAFF: có quyền nếu là assignee hoặc creator
 * - Resource chưa assign (assignees rỗng): cho phép nếu allowUnassigned = true
 *
 * @param {Object} options
 * @param {Function} options.getResource       - (req) => Promise<Document|null> — lấy resource từ DB
 * @param {Function} options.getAssigneeIds    - (resource) => string[] — danh sách assignee userId
 * @param {Function} [options.getCreatorId]    - (resource) => string|null — creator userId
 * @param {string[]} [options.bypassRoles]     - Roles được bypass (default: ['OWNER', 'ADMIN'])
 * @param {boolean}  [options.allowManager]    - Manager bypass qua subordinates? (default: true)
 * @param {boolean}  [options.allowUnassigned] - Resource chưa assign → ai cũng thao tác? (default: true)
 */
function requireResourceAccess(options) {
  return async (req, res, next) => {
    const user = req.user;
    if (!user) {
      return sendError(res, 401, "Bạn cần đăng nhập để thực hiện hành động này", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const role = (user.roleId || "").toUpperCase();

    // 1. Bypass roles (OWNER, ADMIN mặc định)
    const bypassRoles = options.bypassRoles || ["OWNER", "ADMIN"];
    if (bypassRoles.includes(role)) return next();

    // 2. Fetch resource (reuse nếu đã fetch trước đó)
    let resource = req.resource;
    if (!resource) {
      resource = await options.getResource(req);
      if (!resource) {
        return sendError(res, 404, "Không tìm thấy tài nguyên", {
          code: "RESOURCE_NOT_FOUND",
        });
      }
      // Cache vào req để controller dùng lại — tránh query DB lần 2
      req.resource = resource;
    }

    // 3. Check creator
    if (options.getCreatorId) {
      const creatorId = options.getCreatorId(resource);
      if (creatorId && creatorId === user.id) return next();
    }

    // 4. Check assignees
    const assigneeIds = options.getAssigneeIds(resource);

    if (assigneeIds.includes(user.id)) return next();

    // 5. Unassigned resource → allow all (để nhân viên có thể nhận)
    const allowUnassigned = options.allowUnassigned ?? true;
    if (allowUnassigned && assigneeIds.length === 0) return next();

    // 6. Manager subordinate check:
    //    Manager có quyền thao tác resource mà nhân viên dưới cấp là assignee hoặc creator
    const allowManager = options.allowManager ?? true;
    if (allowManager && role === "MANAGER") {
      const subordinates = await User.find({ managerId: user.id })
        .select("id")
        .lean();
      const subIds = subordinates.map((u) => u.id);
      
      const isSubordinateAssignee = assigneeIds.some((id) => subIds.includes(id));
      const creatorId = options.getCreatorId ? options.getCreatorId(resource) : null;
      const isSubordinateCreator = creatorId && subIds.includes(creatorId);

      if (isSubordinateAssignee || isSubordinateCreator) return next();
    }

    return sendError(res, 403, "Bạn không có quyền thao tác trên tài nguyên này", {
      code: "RESOURCE_ACCESS_DENIED",
    });
  };
}

module.exports = { requireResourceAccess };

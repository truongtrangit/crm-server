const { sendError } = require("../utils/http");
const { getManagerSubordinateIds, isUserManagerial } = require("../utils/managerScope");
const { buildResourceScopeFilter } = require("../utils/resourceScope");

/**
 * Universal resource-level access check middleware.
 * Chạy SAU requirePermission(), TRƯỚC controller.
 *
 * Quy tắc:
 * - OWNER/ADMIN: bypass hoàn toàn
 * - MANAGER: có quyền nếu là assignee, creator, hoặc subordinate (cùng phòng ban) là assignee/creator
 * - STAFF: có quyền nếu là assignee hoặc creator
 * - Resource chưa assign (assignees rỗng): cho phép nếu allowUnassigned = true
 *
 * @param {Object} options
 * @param {Function} options.getResource       - (req) => Promise<Document|null> — lấy resource từ DB
 * @param {Function} [options.getAssigneeIds]  - (resource) => string[] — danh sách assignee userId
 * @param {Function} [options.getCreatorId]    - (resource) => string|null — creator userId
 * @param {Function} [options.getTargetUserId]   - (resource) => string|null — ID of the resource entity
 * @param {string[]} [options.bypassRoles]     - Roles được bypass (default: ['OWNER', 'ADMIN'])
 * @param {boolean}  [options.allowCreator]    - Cho phép user thao tác nếu là người tạo (default: false)
 * @param {boolean}  [options.allowAssignee]   - Cho phép user thao tác nếu là người phụ trách (default: false)
 * @param {boolean}  [options.allowUnassigned] - Resource chưa assign → ai cũng thao tác? (default: false)
 * @param {boolean}  [options.allowManagerSubordinateCreator]  - Manager thao tác resource do nhân viên tạo? (default: false)
 * @param {boolean}  [options.allowManagerSubordinateAssignee] - Manager thao tác resource do nhân viên phụ trách? (default: false)
 * @param {boolean}  [options.allowManagerSubordinateTarget]   - Manager thao tác user profile của nhân viên? (default: false)
 */
function requireResourceAccess(options) {
  const middleware = async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return sendError(res, 401, "Bạn cần đăng nhập để thực hiện hành động này", {
          code: "AUTHENTICATION_REQUIRED",
        });
      }

      const role = (user.roleId || "").toUpperCase();

      // 1. Fetch resource (reuse nếu đã fetch trước đó)
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

      // 2. Bypass roles (OWNER, ADMIN mặc định)
      const bypassRoles = options.bypassRoles || ["OWNER", "ADMIN"];
      if (bypassRoles.includes(role)) return next();

      // 3. Check creator — user tạo ra resource
      const creatorId = options?.getCreatorId?.(resource);
      const allowCreator = options.allowCreator ?? true;
      if (allowCreator && creatorId && creatorId === user.id) return next();

      // 4. Check assignees — user được phân công trên resource
      const assigneeIds = options.getAssigneeIds ? (options.getAssigneeIds(resource) || []) : [];
      const allowAssignee = options.allowAssignee ?? false;
      if (allowAssignee && assigneeIds.includes(user.id)) return next();

      // 5. Unassigned resource → allow all (để nhân viên có thể nhận)
      const allowUnassigned = options.allowUnassigned ?? false;
      if (options.getAssigneeIds && allowUnassigned && assigneeIds.length === 0 && !options.getTargetUserId) return next();

      // 6. Manager subordinate check (department-based/group-based):
      const isManagerial = isUserManagerial(user);
      if (isManagerial) {
        const subIds = await getManagerSubordinateIds(user);

        // Check: resource's assignee is a subordinate?
        const allowManagerSubordinateAssignee = options.allowManagerSubordinateAssignee ?? false;
        if (allowManagerSubordinateAssignee && assigneeIds.some((id) => subIds.includes(id))) {
          return next();
        }

        // Check: resource's creator is a subordinate?
        const allowManagerSubordinateCreator = options.allowManagerSubordinateCreator ?? false;
        if (allowManagerSubordinateCreator && creatorId && subIds.includes(creatorId)) {
          return next();
        }

        // Check: resource itself IS a subordinate user? (dùng cho user management)
        const allowManagerSubordinateTarget = options.allowManagerSubordinateTarget ?? false;
        if (allowManagerSubordinateTarget && options.getTargetUserId) {
          const targetUserId = options.getTargetUserId(resource);
          if (targetUserId && subIds.includes(targetUserId)) {
            return next();
          }
        }
      }

      return sendError(res, 403, "Bạn không có quyền thao tác trên tài nguyên này", {
        code: "RESOURCE_ACCESS_DENIED",
      });
    } catch (err) {
      next(err);
    }
  };

  middleware.with = (overrides) => requireResourceAccess({ ...options, ...overrides });
  return middleware;
}

/**
 * Middleware: Ngăn chặn gán người phụ trách lung tung.
 * Sử dụng cho cả API Create và Update.
 * - OWNER/ADMIN: Không giới hạn.
 * @param {Object} options
 * @param {Function} options.getNewAssigneeIds
 * @param {Function} [options.getCurrentAssigneeIds]
 * @param {boolean} [options.allowManagerSubordinateAssignment] - Mặc định: false
 * @param {boolean} [options.allowSelfAssignment] - Mặc định: false
 * @param {boolean} [options.allowStaffReassignment] - Mặc định: false
 */
function enforceAssignmentRules(options) {
  const middleware = async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return next();

      const role = (user.roleId || "").toUpperCase();
      if (["OWNER", "ADMIN"].includes(role)) return next();

      const newAssigneeIds = options.getNewAssigneeIds(req) || [];
      const currentAssignees = req.resource && options.getCurrentAssigneeIds ? options.getCurrentAssigneeIds(req.resource) : [];

      // Chỉ validate những người MỚI ĐƯỢC THÊM VÀO (không validate những người đã có sẵn)
      const addedAssigneeIds = newAssigneeIds.filter(id => !currentAssignees.includes(id));
      if (addedAssigneeIds.length === 0) return next(); // Không thêm người mới -> bỏ qua check gán

      const allowSelfAssignment = options.allowSelfAssignment ?? false;
      const allowManagerSubordinateAssignment = options.allowManagerSubordinateAssignment ?? false;

      const isManagerial = isUserManagerial(user);
      if (isManagerial) {
        const subIds = await getManagerSubordinateIds(user);
        const isAssigningInvalidUser = addedAssigneeIds.some((id) => {
          if (id === user.id) return !allowSelfAssignment;
          return !allowManagerSubordinateAssignment || !subIds.includes(id);
        });

        if (isAssigningInvalidUser) {
          return sendError(res, 403, "Bạn chỉ có thể phân công theo quyền hạn được giao.", {
            code: "ASSIGN_FORBIDDEN",
          });
        }
        return next();
      }

      // STAFF role
      const allowStaffReassignment = options.allowStaffReassignment ?? false;
      if (req.resource && !allowStaffReassignment) {
        if (currentAssignees.length > 0) {
          return sendError(res, 403, "Tài nguyên này đã có người phụ trách. Chỉ Manager hoặc Admin mới có quyền thêm người khác.", {
            code: "ASSIGN_FORBIDDEN",
          });
        }
      }

      const isAssigningSomeoneElse = addedAssigneeIds.some((id) => id !== user.id);
      if (isAssigningSomeoneElse || (!allowSelfAssignment && addedAssigneeIds.includes(user.id))) {
        return sendError(res, 403, "Bạn chỉ có thể tự nhận phân công cho chính mình.", {
          code: "ASSIGN_FORBIDDEN",
        });
      }

      return next();
    } catch (err) {
      next(err);
    }
  };

  middleware.with = (overrides) => enforceAssignmentRules({ ...options, ...overrides });
  return middleware;
}

/**
 * Middleware kiểm tra quyền bỏ gán (unassign) người phụ trách khỏi tài nguyên.
 * @param {Object} options
 * @param {Function} options.getTargetUserId
 * @param {boolean} [options.allowManagerSubordinateUnassignment=false] - Behavior flag
 * @param {boolean} [options.allowSelfUnassignment=false] - Behavior flag
 */
function enforceUnassignmentRules(options) {
  const middleware = async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return next();

      const role = (user.roleId || "").toUpperCase();
      if (["OWNER", "ADMIN"].includes(role)) return next();

      let removedAssigneeIds = [];
      if (options.getNewAssigneeIds && options.getCurrentAssigneeIds) {
        const newIds = options.getNewAssigneeIds(req);
        // Nếu không có payload assignees (không update mảng assignees), bỏ qua
        if (newIds === null || newIds === undefined) return next();
        const currentIds = req.resource ? options.getCurrentAssigneeIds(req.resource) : [];
        removedAssigneeIds = currentIds.filter(id => !newIds.includes(id));
      } else {
        const targetUserId = options.getTargetUserId ? options.getTargetUserId(req) : null;
        if (targetUserId) removedAssigneeIds.push(targetUserId);
      }

      if (removedAssigneeIds.length === 0) return next();

      const allowSelfUnassignment = options.allowSelfUnassignment ?? false;
      const allowManagerSubordinateUnassignment = options.allowManagerSubordinateUnassignment ?? false;

      const isManagerial = isUserManagerial(user);
      if (isManagerial) {
        const subIds = await getManagerSubordinateIds(user);

        for (const targetUserId of removedAssigneeIds) {
          if (targetUserId === user.id) {
            if (!allowSelfUnassignment) {
              return sendError(res, 403, "Bạn không thể tự bỏ phân công của chính mình.", { code: "ASSIGN_FORBIDDEN" });
            }
          } else {
            if (!allowManagerSubordinateUnassignment) {
              return sendError(res, 403, "Bạn không thể bỏ phân công của nhân viên.", { code: "ASSIGN_FORBIDDEN" });
            }
            if (!subIds.includes(targetUserId)) {
              return sendError(res, 403, "Bạn chỉ có thể bỏ phân công nhân viên trong phòng ban.", { code: "ASSIGN_FORBIDDEN" });
            }
          }
        }
        return next();
      }

      // STAFF role
      for (const targetUserId of removedAssigneeIds) {
        if (targetUserId !== user.id) {
          return sendError(res, 403, "Bạn chỉ có thể bỏ nhận phân công của chính mình.", { code: "ASSIGN_FORBIDDEN" });
        }
        if (!allowSelfUnassignment) {
          return sendError(res, 403, "Bạn không thể tự bỏ nhận phân công.", { code: "ASSIGN_FORBIDDEN" });
        }
      }

      return next();
    } catch (err) {
      next(err);
    }
  };

  middleware.with = (overrides) => enforceUnassignmentRules({ ...options, ...overrides });
  return middleware;
}

/**
 * Middleware để lọc danh sách user dựa trên assignmentScope
 * @param {Object} [options]
 * @param {boolean} [options.allowManagerSubordinateScope] - Mặc định: false
 */
function scopeAssignmentList(options = {}) {
  return async (req, res, next) => {
    try {
      // if (req.query.assignmentScope === "true") {
      const user = req.user;
      if (!user) return next();
      const role = (user.roleId || "").toUpperCase();

      if (!["OWNER", "ADMIN"].includes(role)) {
        const allowManagerSubordinateScope = options.allowManagerSubordinateScope ?? false;
        const isManagerial = isUserManagerial(user);
        let allowedIds = [];
        if (isManagerial && allowManagerSubordinateScope) {
          const subIds = await getManagerSubordinateIds(user);
          allowedIds = [user.id, ...subIds];
        } else {
          allowedIds = [user.id];
        }

        if (req.query.scopedUserIds) {
          const requestedIds = Array.isArray(req.query.scopedUserIds) ? req.query.scopedUserIds : [req.query.scopedUserIds];
          const intersectedIds = requestedIds.filter(id => allowedIds.includes(id));
          req.scopedUserIds = intersectedIds.length > 0 ? intersectedIds : ["_NO_MATCH_"];
        } else {
          req.scopedUserIds = allowedIds;
        }
        // }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware để giới hạn dữ liệu list trả về theo quyền của user.
 * Nó gọi buildResourceScopeFilter và gán query mongoose vào req.resourceScopeFilter.
 * @param {Object} options - Các tham số chuyển cho buildResourceScopeFilter
 */
function scopeResourceList(options = {}) {
  const middleware = async (req, res, next) => {
    try {
      const filter = await buildResourceScopeFilter(req.user, options);
      req.resourceScopeFilter = filter || {};
      next();
    } catch (err) {
      next(err);
    }
  };

  middleware.with = (overrides) => scopeResourceList({ ...options, ...overrides });
  return middleware;
}

module.exports = { requireResourceAccess, enforceAssignmentRules, enforceUnassignmentRules, scopeAssignmentList, scopeResourceList };

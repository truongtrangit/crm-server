const SystemLog = require('./systemLog.model');
const logger = require('../../../core/utils/logger');
const { resolvePagination, buildPaginatedResponse, resolveSort } = require('../../../core/utils/pagination');

/**
 * SystemLogService — Centralized system activity logging.
 *
 * Usage pattern (fire-and-forget):
 *   SystemLogService.log({
 *     action: "create",
 *     resource: "customer",
 *     resourceId: customer.id,
 *     resourceName: customer.name,
 *     description: "Tạo khách hàng mới",
 *     req,                          // auto-extract user + IP
 *   });
 *
 * Or with explicit performedBy (for system/webhook actions):
 *   SystemLogService.log({
 *     action: "create",
 *     resource: "event",
 *     resourceId: event.id,
 *     resourceName: event.name,
 *     description: "Event tạo tự động từ webhook",
 *     performedBy: { userId: null, userName: "Webhook System" },
 *   });
 */
class SystemLogService {
  /**
   * Log a system activity. Fire-and-forget — errors are caught and logged
   * to prevent logging failures from breaking business logic.
   *
   * @param {object} params
   * @param {string} params.action      - CRUD action: create, update, delete, etc.
   * @param {string} params.resource    - Resource type: customer, event, user, etc.
   * @param {string} [params.resourceId]   - ID of the affected resource
   * @param {string} [params.resourceName] - Display name snapshot
   * @param {string} [params.description]  - Human-readable summary
   * @param {object} [params.req]          - Express req object (auto-extract user + IP)
   * @param {object} [params.performedBy]  - Override: { userId, userName, userAvatar }
   * @param {string} [params.status]       - 'success' | 'failed'
   * @param {string} [params.error]        - Error message if failed
   * @param {object} [params.metadata]     - Optional extra context
   */
  static log({
    action,
    resource,
    resourceId = null,
    resourceName = "",
    description = "",
    req = null,
    performedBy = null,
    status = "success",
    error = null,
    metadata = null,
  }) {
    // Extract performedBy from req.user if not explicitly provided
    const actor = performedBy || SystemLogService.extractPerformer(req);
    const ipAddress = 
      req?.headers?.['cf-connecting-ip'] || 
      (req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || 
      req?.ip || 
      req?.socket?.remoteAddress || 
      "";

    // Fire-and-forget — don't await, don't block
    SystemLog.create({
      action,
      resource,
      resourceId,
      resourceName,
      description,
      performedBy: actor,
      status,
      error,
      metadata,
      ipAddress,
    }).catch((err) => {
      logger.error("[SystemLog] Failed to write log", {
        action,
        resource,
        resourceId,
        error: err.message,
      });
    });
  }

  /**
   * Extract performer info from Express req object.
   * @param {object} req - Express request with req.user
   * @returns {object} { userId, userName, userAvatar }
   */
  static extractPerformer(req) {
    if (!req?.user) {
      return { userId: null, userName: "System", userAvatar: "" };
    }
    return {
      userId: req.user.id || null,
      userName: req.user.name || "Unknown",
      userAvatar: req.user.avatar || "",
    };
  }

  /**
   * Get system logs with pagination and filters.
   * @param {object} queryParams - { page, limit, action, resource, status, userId, sort, sortOrder }
   * @returns {Promise<object>} Paginated response
   */
  static async getLogs(queryParams) {
    const { action, resource, status, userId } = queryParams;
    const { page, limit, skip } = resolvePagination(queryParams);
    const sort = resolveSort(queryParams, ["createdAt"], { createdAt: -1 });
    const query = {};

    if (action) query.action = action;
    if (resource) query.resource = resource;
    if (status) query.status = status;
    if (userId) query["performedBy.userId"] = userId;

    const [logs, totalItems] = await Promise.all([
      SystemLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      SystemLog.countDocuments(query),
    ]);

    return buildPaginatedResponse(logs, totalItems, page, limit);
  }
}

module.exports = SystemLogService;

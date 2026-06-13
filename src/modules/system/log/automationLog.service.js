const AutomationLog = require('./automationLog.model');
const logger = require('../../../core/utils/logger');
const { resolvePagination, buildPaginatedResponse, resolveSort } = require('../../../core/utils/pagination');

/**
 * AutomationLogService — Logs every Block Automation execution.
 *
 * Usage:
 *   AutomationLogService.log({
 *     eventId, eventName,
 *     chainId, chainName,
 *     actionId, actionName,
 *     blockAutomationId, blockAutomationName,
 *     url, method,
 *     resolvedPayload,
 *     responseStatus, responseStatusText, responseData,
 *     status: 'success' | 'failed',
 *     error,
 *     duration,
 *     req,
 *   });
 */
class AutomationLogService {
  /**
   * Log a block automation execution. Fire-and-forget.
   *
   * @param {object} params - Execution context and result data
   */
  static log({
    eventId,
    eventName = "",
    chainId = null,
    chainName = "",
    actionId = null,
    actionName = "",
    blockAutomationId = null,
    blockAutomationName = "",
    url = "",
    method = "POST",
    resolvedPayload = null,
    responseStatus = null,
    responseStatusText = null,
    responseData = null,
    status,
    error = null,
    duration = 0,
    attemptCount = 1,
    req = null,
    performedBy = null,
  }) {
    const actor = performedBy || AutomationLogService.extractPerformer(req);

    // Truncate large response data to prevent DB bloat
    let safeResponseData = responseData;
    if (responseData) {
      const serialized = JSON.stringify(responseData);
      if (serialized.length > 5000) {
        safeResponseData = JSON.parse(serialized.substring(0, 5000));
      }
    }

    AutomationLog.create({
      eventId,
      eventName,
      chainId,
      chainName,
      actionId,
      actionName,
      blockAutomationId,
      blockAutomationName,
      url,
      method,
      resolvedPayload,
      responseStatus,
      responseStatusText,
      responseData: safeResponseData,
      performedBy: actor,
      status,
      error,
      duration,
      attemptCount,
    }).catch((err) => {
      logger.error("[AutomationLog] Failed to write log", {
        eventId,
        blockAutomationId,
        error: err.message,
      });
    });
  }

  /**
   * Extract performer info from Express req object.
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
   * Get automation logs with pagination and filters.
   * @param {object} queryParams - { page, limit, status, eventId, blockAutomationId, sort, sortOrder }
   * @returns {Promise<object>} Paginated response
   */
  static async getLogs(queryParams) {
    const { status, eventId, blockAutomationId } = queryParams;
    const { page, limit, skip } = resolvePagination(queryParams);
    const sort = resolveSort(queryParams, ["createdAt"], { createdAt: -1 });
    const query = {};

    if (status) query.status = status;
    if (eventId) query.eventId = eventId;
    if (blockAutomationId) query.blockAutomationId = blockAutomationId;

    const [logs, totalItems] = await Promise.all([
      AutomationLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      AutomationLog.countDocuments(query),
    ]);

    return buildPaginatedResponse(logs, totalItems, page, limit);
  }
}

module.exports = AutomationLogService;

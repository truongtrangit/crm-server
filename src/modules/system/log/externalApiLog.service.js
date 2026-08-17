const ExternalApiLog = require('../../../core/models/externalApiLog.model');
const logger = require('../../../core/utils/logger');
const { resolvePagination, buildPaginatedResponse, resolveSort } = require('../../../core/utils/pagination');
const { createHttpError } = require('../../../core/utils/http');
const SystemLogService = require('./systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');
const BankLogController = require('../../bankLog/bankLog.controller');
const { EXTERNAL_SYSTEMS } = require('../../../core/constants/externalSystems');

class ExternalApiLogService {
  /**
   * Get external API logs with pagination and filters.
   * @param {object} queryParams 
   * @returns {Promise<object>} Paginated response
   */
  static async getLogs(queryParams) {
    const { system, method, path, responseStatus, callerIp } = queryParams;
    const { page, limit, skip } = resolvePagination(queryParams);
    const sort = resolveSort(queryParams, ["createdAt"], { createdAt: -1 });
    const query = {};

    if (system) query.system = system;
    if (method) query.method = method;
    if (path) query.path = new RegExp(path, 'i');
    if (responseStatus) query.responseStatus = responseStatus;
    if (callerIp) query.callerIp = callerIp;

    const [logs, totalItems] = await Promise.all([
      ExternalApiLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      ExternalApiLog.countDocuments(query),
    ]);

    return buildPaginatedResponse(logs, totalItems, page, limit);
  }

  /**
   * Replay an external API log by bypassing security middlewares
   * @param {string} id - The ExternalApiLog ID
   * @param {object} req - Express request object of the admin
   * @returns {Promise<object>} Replay result
   */
  static async replayEvent(id, req) {
    const log = await ExternalApiLog.findById(id).lean();
    if (!log) {
      throw createHttpError(404, 'Không tìm thấy log external API');
    }

    // Mock Express Request
    const mockReq = {
      body: log.requestBody || {},
      headers: {},
      ip: log.callerIp,
      method: log.method,
      originalUrl: log.path,
    };

    // Mock Express Response to capture result instead of sending it
    let statusCode = 200;
    let responseData = null;
    let isFinished = false;

    const mockRes = {
      status: function (code) {
        statusCode = code;
        return this;
      },
      json: function (data) {
        responseData = data;
        isFinished = true;
        return this;
      },
      send: function (data) {
        responseData = data;
        isFinished = true;
        return this;
      }
    };

    // Routing based on system and path
    try {
      switch (log.system) {
        case EXTERNAL_SYSTEMS.ACB:
          // ACB Webhook Routing
          await BankLogController.ingestAcbTransaction(mockReq, mockRes);
          break;
        default:
          throw createHttpError(400, `Hệ thống ${log.system} chưa được hỗ trợ replay`);
      }

      if (statusCode >= 400) {
        let errorMsg = `Controller returned HTTP ${statusCode}`;
        if (responseData) {
          if (typeof responseData === 'string') {
            errorMsg = responseData;
          } else if (responseData.message) {
            errorMsg = responseData.message;
          } else {
            errorMsg = JSON.stringify(responseData);
          }
        }
        throw new Error(errorMsg);
      }

      SystemLogService.log({
        action: 'update',
        resource: RESOURCES.LOGS, // Defaulting to LOGS
        resourceId: id,
        resourceName: `Replay External Log: ${log.system}`,
        description: `Admin replay sự kiện từ hệ thống ${log.system}`,
        metadata: {
          originalLogId: id,
          system: log.system,
          path: log.path,
          replayResponseStatus: statusCode,
        },
        req, // To extract admin info
      });

      await ExternalApiLog.findByIdAndUpdate(id, {
        $inc: { replayCount: 1 },
        $set: { lastReplayError: null }
      });

      return {
        success: true,
        originalLogId: id,
        system: log.system,
        replayResponse: responseData,
        replayStatus: statusCode,
        replayCount: (log.replayCount || 0) + 1
      };
    } catch (error) {
      logger.error('Error during replayEvent', error);
      
      await ExternalApiLog.findByIdAndUpdate(id, {
        $inc: { replayCount: 1 },
        $set: { lastReplayError: error.message || 'Unknown error' }
      });

      SystemLogService.log({
        action: 'update',
        resource: RESOURCES.LOGS,
        resourceId: id,
        resourceName: `Replay External Log: ${log.system}`,
        description: `Admin replay sự kiện từ hệ thống ${log.system} thất bại: ${error.message}`,
        req,
      });

      // We throw the error so the controller handles it normally via global error handler
      throw error;
    }
  }
}

module.exports = ExternalApiLogService;

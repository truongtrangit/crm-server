const IntegrationLog = require('./integrationLog.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const logger = require('../../../core/utils/logger');

class IntegrationLogService {
  /**
   * Tạo 1 log mới. Hàm này fire-and-forget, không bao giờ throw lỗi ra ngoài.
   */
  async createLog(data) {
    try {
      const id = await generateMonotonicId(ID_PREFIXES.INTEGRATION_LOG);
      await IntegrationLog.create({
        id,
        configId: data.configId || null,
        source: data.source,
        eventType: data.eventType,
        status: data.status,
        payload: data.payload || {},
        error: data.error || null,
        actionResults: data.actionResults || [],
      });
    } catch (error) {
      logger.error('IntegrationLogService: Failed to create log', {
        error: error.message,
        source: data.source,
      });
    }
  }

  /**
   * Lấy danh sách log có phân trang, filter theo configId, source, status.
   */
  async listLogs(queryParams = {}) {
    const { configId, source, status, page = 1, limit = 20 } = queryParams;

    const filter = {};
    if (configId) filter.configId = configId;
    if (source) filter.source = source;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      IntegrationLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      IntegrationLog.countDocuments(filter),
    ]);

    return {
      docs: logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLogById(id) {
    const log = await IntegrationLog.findOne({ id }).lean();
    return log;
  }
}

module.exports = new IntegrationLogService();

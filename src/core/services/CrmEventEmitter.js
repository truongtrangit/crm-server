const logger = require('../utils/logger');

/**
 * CRM Event Emitter — Interface duy nhất để bất kỳ module nào
 * bắn event vào hệ thống CRM.
 *
 * CÁCH DÙNG (cho developer):
 *   const CrmEventEmitter = require('path/to/CrmEventEmitter');
 *   CrmEventEmitter.emit("botvn", "botvn_user_moi", { name, email, phone });
 *
 * - source: string tự do, ví dụ "botvn", "zcode", "shopee"
 * - eventType: string tự do, ví dụ "botvn_user_moi"
 * - payload: object chứa data, sẽ được map theo fieldMapping trong IntegrationConfig
 *
 * Nếu không có IntegrationConfig nào match → im lặng bỏ qua (no-op).
 * Lỗi KHÔNG ảnh hưởng flow chính (fire-and-forget).
 */
class CrmEventEmitter {
  #configService = null;

  /**
   * Lazy load IntegrationConfigService để tránh circular dependency.
   */
  _getConfigService() {
    if (!this.#configService) {
      this.#configService = require('../../modules/system/integrationConfig/integrationConfig.service');
    }
    return this.#configService;
  }

  /**
   * Emit a CRM event — fire-and-forget.
   *
   * @param {string} source    — module identifier ("botvn", "zcode", ...)
   * @param {string} eventType — event type identifier
   * @param {object} payload   — raw data from the module
   */
  async emit(source, eventType, payload = {}) {
    try {
      const result = await this._getConfigService().executeActions(
        source,
        eventType,
        payload,
      );

      if (result) {
        logger.info('CrmEventEmitter: event processed', {
          source,
          eventType,
          eventId: result.event?.id || null,
          leadId: result.lead?.id || null,
        });
      }
      // result === null → no config found, silently skip
    } catch (error) {
      // Fire-and-forget — NEVER throw, NEVER crash the caller
      logger.error('CrmEventEmitter: failed (non-blocking)', {
        source,
        eventType,
        error: error.message,
      });
    }
  }
}

module.exports = new CrmEventEmitter();

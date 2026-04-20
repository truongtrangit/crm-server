const { getRedisClient } = require("../config/redis");
const logger = require("../utils/logger");

class CacheService {
  /**
   * Lấy giá trị từ Cache (tự động parse JSON)
   * @param {string} key KHOÁ CACHE
   * @returns {any} Dữ liệu đã parse (hoặc null nếu hụt)
   */
  static async get(key) {
    try {
      const client = getRedisClient();
      if (!client) return null;

      const data = await client.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      logger.error("Cache GET error", { key, error: error.message });
      return null;
    }
  }

  /**
   * Lưu giá trị vào Cache (tự động stringify)
   * @param {string} key KHOÁ CACHE
   * @param {any} value GIÁ TRỊ OBJECT/ARRAY
   * @param {number} ttlSeconds THỜI GIAN TỒN TẠI (Giây) - Mặc định 24h
   */
  static async set(key, value, ttlSeconds = 86400) {
    try {
      const client = getRedisClient();
      if (!client) return;

      const stringValue = JSON.stringify(value);
      await client.set(key, stringValue, "EX", ttlSeconds);
    } catch (error) {
      logger.error("Cache SET error", { key, error: error.message });
    }
  }

  /**
   * Xoá giá trị Cache
   * @param {string} key KHOÁ CACHE
   */
  static async del(key) {
    try {
      const client = getRedisClient();
      if (!client) return;

      await client.del(key);
    } catch (error) {
      logger.error("Cache DEL error", { key, error: error.message });
    }
  }
}

module.exports = CacheService;

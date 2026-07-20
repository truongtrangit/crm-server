const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const crypto = require("crypto");
const stringify = require("fast-json-stable-stringify");

const memoryCache = new Map(); // In-memory fallback cache

function safeParse(str, client, key) {
  try {
    return JSON.parse(str);
  } catch (err) {
    // Tự động xoá cache bị lỗi định dạng
    if (client && key) {
      client.del(key).catch(e => logger.error("Failed to delete corrupted cache", { key, error: e.message }));
    } else if (key) {
      memoryCache.delete(key);
    }
    return null;
  }
}

class CacheService {
  /**
   * Lấy giá trị từ Cache (tự động parse JSON)
   * @param {string} key KHOÁ CACHE
   * @returns {any} Dữ liệu đã parse (hoặc null nếu hụt/lỗi)
   */
  static async get(key) {
    try {
      const client = getRedisClient();
      let data = null;

      if (!client) {
        // Fallback in-memory
        const item = memoryCache.get(key);
        if (item) {
          if (Date.now() > item.expiresAt) {
            memoryCache.delete(key);
          } else {
            data = item.value;
          }
        }
      } else {
        data = await client.get(key);
      }

      if (data) {
        return safeParse(data, client, key);
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

      // TTL validation/max limit để tránh lưu vô thời hạn (Max 7 ngày)
      const MAX_TTL = 604800;
      const finalTtl = Math.min(ttlSeconds, MAX_TTL);

      const stringValue = JSON.stringify(value || {});

      if (!client) {
        // Fallback in-memory
        const expiresAt = Date.now() + finalTtl * 1000;
        memoryCache.set(key, { value: stringValue, expiresAt });
        
        // Thỉnh thoảng dọn dẹp bộ nhớ thừa
        if (memoryCache.size > 10000) {
          for (const [k, v] of memoryCache.entries()) {
            if (Date.now() > v.expiresAt) memoryCache.delete(k);
          }
        }
        return;
      }

      await client.set(key, stringValue, "EX", finalTtl);
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
      if (!client) {
        memoryCache.delete(key);
        return;
      }

      await client.del(key);
    } catch (error) {
      logger.error("Cache DEL error", { key, error: error.message });
    }
  }

  /**
   * Lấy version hiện tại của một namespace (Dùng cho Cache Versioning)
   */
  static async getNamespaceVersion(namespace) {
    try {
      const client = getRedisClient();
      if (!client) return 1;
      const v = await client.get(`v:${namespace}`);
      if (!v) {
        await client.set(`v:${namespace}`, 1);
        return 1;
      }
      return parseInt(v, 10);
    } catch (err) {
      return 1;
    }
  }

  /**
   * Tăng version của một namespace, khiến toàn bộ cache cũ của namespace đó (chứa version cũ) bị vô hiệu hoá. O(1) time.
   */
  static async bumpNamespaceVersion(namespace) {
    try {
      const client = getRedisClient();
      if (!client) return;
      await client.incr(`v:${namespace}`);
    } catch (err) {
      logger.error("Cache BUMP VERSION error", { namespace, error: err.message });
    }
  }

  /**
   * Tự động xử lý Cache Versioning với chống Stampede và tuỳ chọn Stale-While-Revalidate
   */
  static async withVersionedCache(namespace, queryObj, ttlSeconds, fetcher, options = {}) {
    const { swr = false, maxTtl = 86400 } = options;
    const finalTtl = Math.min(ttlSeconds, maxTtl); // TTL validation

    try {
      const client = getRedisClient();
      if (!client) return await fetcher();

      const version = await this.getNamespaceVersion(namespace);

      // fast-json-stable-stringify đảm bảo thứ tự properties không làm sai lệch hash
      const queryString = stringify(queryObj || {});

      // Sử dụng md5 thay vì base64 nguyên bản để rút ngắn size key trong Redis
      const queryHash = crypto.createHash('md5').update(queryString).digest('hex');
      const key = `cache:${namespace}:v${version}:${queryHash}`;
      const lockKey = `lock:${key}`;

      const cached = await client.get(key);
      if (cached) {
        const parsed = safeParse(cached, client, key);
        if (parsed) {
          const { data, staleAt } = parsed;
          // Stale-while-revalidate: Nếu dữ liệu đã cũ (vượt staleAt) nhưng vẫn nằm trong TTL vật lý
          if (swr && staleAt && Date.now() > staleAt) {
            this._asyncRefresh(client, key, lockKey, finalTtl, fetcher).catch(err =>
              logger.error("SWR refresh error", { key, error: err.message })
            );
          }
          return data;
        }
      }

      // Stampede protection: Tránh nhiều request đồng loạt hit DB khi cache miss
      const lockAcquired = await client.set(lockKey, "1", "NX", "EX", 5);
      if (!lockAcquired) {
        // Chờ và thử lấy lại cache (Polling) tối đa 2 giây (20 vòng * 100ms)
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          const retryCached = await client.get(key);
          if (retryCached) {
            const parsed = safeParse(retryCached, client, key);
            if (parsed) return parsed.data;
          }
        }
      }

      // Vẫn không có cache (hoặc ta là người giữ lock) -> Fetch từ DB
      const result = await fetcher();

      // Lưu vào cache
      const payload = {
        data: result,
        staleAt: swr ? Date.now() + finalTtl * 1000 : null
      };

      // Nếu dùng swr, thời gian sống vật lý trên Redis gấp đôi để có thể phục vụ cache cũ
      const physicalTtl = swr ? finalTtl * 2 : finalTtl;
      await client.set(key, JSON.stringify(payload), "EX", physicalTtl);

      if (lockAcquired) {
        await client.del(lockKey);
      }

      return result;
    } catch (err) {
      logger.error("Versioned cache wrapper error", { namespace, error: err.message });
      return await fetcher();
    }
  }

  static async _asyncRefresh(client, key, lockKey, finalTtl, fetcher) {
    // Đảm bảo chỉ 1 tiến trình background thực hiện refresh
    const lockAcquired = await client.set(lockKey, "1", "NX", "EX", 5);
    if (!lockAcquired) return;

    try {
      const result = await fetcher();
      const payload = {
        data: result,
        staleAt: Date.now() + finalTtl * 1000
      };
      await client.set(key, JSON.stringify(payload), "EX", finalTtl * 2);
    } finally {
      await client.del(lockKey);
    }
  }
}

module.exports = CacheService;

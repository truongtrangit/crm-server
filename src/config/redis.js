const Redis = require("ioredis");
const env = require("./env");
const logger = require("../utils/logger");

let redisClient = null;

async function connectRedis() {
  if (redisClient) {
    return redisClient;
  }

  // Khởi tạo client nhưng nếu ko có env.redisUri thì không connect để tránh lỗi
  if (!env.redisUri) {
    logger.warn("REDIS_URI is not defined. Redis caching will be skipped.");
    return null;
  }

  try {
    // Sử dụng ioredis với lazyConnect để bắt lỗi ngay trong hàm `connect()`
    redisClient = new Redis(env.redisUri, {
      username: env.redisUsername,
      password: env.redisPassword,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });

    redisClient.on("error", (err) => {
      logger.error("Redis Client Error", { error: err.message });
    });

    redisClient.on("connect", () => {
      logger.info("Redis connected successfully");
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.warn("Failed to connect to Redis, caching will be disabled", { error: error.message });
    redisClient = null;
    return null; // Trả về null để chạy app không cần cache
  }
}

function getRedisClient() {
  return redisClient;
}

async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis connection closed");
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  closeRedis,
};

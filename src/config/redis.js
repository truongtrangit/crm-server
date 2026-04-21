const Redis = require("ioredis");
const env = require("./env");
const logger = require("../utils/logger");

let redisClient = null;

async function connectRedis() {
  if (redisClient) {
    return redisClient;
  }

  // Disable hoàn toàn theo config env, không cố thử connect
  if (!env.enableRedis) {
    logger.info("Redis is disabled via ENV. Falling back to MongoDB only.");
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
    logger.error("Failed to connect to Redis", { error: error.message });
    throw error;
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

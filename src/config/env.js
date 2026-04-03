const dotenv = require("dotenv");

dotenv.config();

function readBooleanEnv(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return ["true", "1", "yes", "on"].includes(
    String(value).trim().toLowerCase(),
  );
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES) || 15,
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30,
  // migratedUserDefaultPassword:
  //   process.env.MIGRATED_USER_DEFAULT_PASSWORD || "ChangeMe@123",
  // cleanLegacyStaffCollection: readBooleanEnv(
  //   process.env.CLEAN_LEGACY_STAFF_COLLECTION,
  //   true,
  // ),
};

module.exports = env;

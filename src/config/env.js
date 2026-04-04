const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES) || 15,
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30,
  passwordResetTokenTtlMinutes:
    Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 30,
  defaultUserPassword: process.env.DEFAULT_USER_PASSWORD || "crm123456",
};

module.exports = env;

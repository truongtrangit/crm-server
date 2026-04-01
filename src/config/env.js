const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017",
  //   clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
};

module.exports = env;

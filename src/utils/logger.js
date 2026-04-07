const winston = require("winston");
const env = require("../config/env");

const isProduction = env.nodeEnv === "production";

/**
 * Custom format: structured JSON in production, colorized console in development.
 */
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}: ${message}${metaStr}`;
  }),
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  defaultMeta: { service: "crm-server" },
  format: isProduction ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    ...(isProduction
      ? [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 5 * 1024 * 1024, // 5 MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 10,
          }),
        ]
      : []),
  ],
});

module.exports = logger;

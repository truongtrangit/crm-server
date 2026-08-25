const winston = require("winston");
const env = require('../config/env');

const { getContext } = require('./asyncContext');

const isProduction = env.nodeEnv === "production";

/**
 * Winston format to auto-inject traceId into log metadata
 */
const injectTraceId = winston.format((info) => {
  const traceId = getContext('traceId');
  if (traceId) {
    info.traceId = traceId;
  }
  return info;
});

/**
 * Custom format: structured JSON in production, colorized console in development.
 */
const devFormat = winston.format.combine(
  injectTraceId(),
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, traceId, ...meta }) => {
    const { service, ...restMeta } = meta;
    const traceStr = traceId ? ` [${traceId}]` : "";
    const metaStr = Object.keys(restMeta).length ? ` \n${JSON.stringify(restMeta, null, 2)}` : "";
    return `${timestamp} ${level}${traceStr}: ${message}${metaStr}`;
  }),
);

const prodFormat = winston.format.combine(
  injectTraceId(),
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

/**
 * Winston logger configured for structured JSON output in production
 * and pretty console output during development.
 */
import winston from "winston";
import { config } from "../config";

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: config.isDev() ? "debug" : "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
    errors({ stack: true }),
    config.isProd() ? json() : combine(colorize(), simple())
  ),
  transports: [
    new winston.transports.Console(),
    // In production you'd add a file or cloud transport here
  ],
  exitOnError: false,
});

// Shorthand helpers
export const log = {
  info: (msg: string, meta?: object) => logger.info(msg, meta),
  warn: (msg: string, meta?: object) => logger.warn(msg, meta),
  error: (msg: string, meta?: object) => logger.error(msg, meta),
  debug: (msg: string, meta?: object) => logger.debug(msg, meta),
};

import pino from "pino";
import { env } from "./env.js";

const config = env();

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: "salescontent-api", env: config.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.apiKey",
      "*.secret",
      "*.password",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
  transport:
    config.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, singleLine: false } }
      : undefined,
});

export type Logger = typeof logger;

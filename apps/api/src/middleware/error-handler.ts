import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { ApiError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

/**
 * Global error handler — converts every thrown error into a structured JSON
 * envelope: `{ error: { code, message, details, requestId } }`.
 * Never leak stack traces in production.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.res.headers.get("x-request-id") ?? undefined;

  if (err instanceof ApiError) {
    logger.warn(
      { requestId, code: err.code, status: err.statusCode },
      err.message,
    );
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          requestId,
        },
      },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
    );
  }

  if (err instanceof ZodError) {
    logger.warn({ requestId, issues: err.flatten() }, "validation_error");
    return c.json(
      {
        error: {
          code: "validation_error",
          message: "Request failed validation",
          details: err.flatten(),
          requestId,
        },
      },
      422,
    );
  }

  logger.error({ requestId, err }, "unhandled_error");
  return c.json(
    {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred",
        requestId,
      },
    },
    500,
  );
};

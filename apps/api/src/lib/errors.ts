/**
 * Typed error hierarchy. Every thrown error that reaches the global error
 * handler should derive from ApiError so the handler can emit the right
 * status code and shape.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = "ApiError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Not authenticated") {
    super(401, "unauthorized", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(403, "forbidden", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, "not_found", `${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(422, "validation_error", message, details);
    this.name = "ValidationError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, "conflict", message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(429, "rate_limited", "Too many requests", { retryAfterSeconds });
    this.retryAfterSeconds = retryAfterSeconds;
    this.name = "RateLimitError";
  }
}

export class ClaudeBudgetExceededError extends ApiError {
  constructor(tenantId: string, spentUsd: number, capUsd: number) {
    super(
      429,
      "claude_budget_exceeded",
      `Daily Claude spend cap reached for tenant ${tenantId}: ${spentUsd.toFixed(2)}/${capUsd.toFixed(2)} USD`,
      { spentUsd, capUsd },
    );
    this.name = "ClaudeBudgetExceededError";
  }
}

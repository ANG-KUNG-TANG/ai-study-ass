export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;

  /** @deprecated Keep for compatibility with older middleware. */
  readonly isOperatinal: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.isOperatinal = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400, "BAD_REQUEST");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    const message = /not found$/i.test(resource)
      ? resource
      : `${resource} not found`;
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

export class ValidationError extends AppError {
  readonly fields?: Record<string, string>;

  constructor(message = "Validation failed", fields?: Record<string, string>) {
    super(message, 422, "VALIDATION_ERROR");
    this.fields = fields;
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterMs?: number;

  constructor(message = "Too many requests", retryAfterMs?: number) {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.retryAfterMs = retryAfterMs;
  }
}

// Backward-compatible misspelled export.
export { RateLimitError as RateLImitError };

export class FileError extends AppError {
  constructor(message = "File processing failed") {
    super(message, 400, "FILE_ERROR");
  }
}

export class AIError extends AppError {
  readonly provider?: string;

  constructor(message = "AI service unavailable", provider?: string) {
    super(message, 502, "AI_ERROR");
    this.provider = provider;
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500, "INTERNAL_ERROR", false);
  }
}

// Backward-compatible misspelled export.
export { InternalError as InternalErro };

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable") {
    super(
      message,
      503,
      "SERVICE_UNAVAILABLE",
    );
  }
}
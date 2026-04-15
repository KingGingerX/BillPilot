/**
 * Global error handling middleware.
 * Catches all errors thrown in route handlers and formats consistent
 * JSON error responses. Never leaks stack traces to the client.
 */
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { config } from "../config";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(message, 422, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Log all errors server-side
  logger.error("Request error", {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: config.isDev() ? err.stack : undefined,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code ?? "ERROR",
      message: err.message,
    });
    return;
  }

  // Prisma unique constraint violation
  if ((err as { code?: string }).code === "P2002") {
    res.status(409).json({
      success: false,
      code: "CONFLICT",
      message: "A record with these details already exists",
    });
    return;
  }

  // Prisma record not found
  if ((err as { code?: string }).code === "P2025") {
    res.status(404).json({
      success: false,
      code: "NOT_FOUND",
      message: "Record not found",
    });
    return;
  }

  // Fallback — 500
  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: config.isProd() ? "An unexpected error occurred" : err.message,
  });
}

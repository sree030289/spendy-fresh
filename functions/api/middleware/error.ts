// src/middleware/error.ts
import { Request, Response, NextFunction } from 'express';
import { ApiError, ApiResponse } from '../types';
import { ENV } from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number, code: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

// Error handling middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  // Convert generic errors to AppError
  if (!(error instanceof AppError)) {
    if (error.name === 'ValidationError') {
      error = new ValidationError(error.message);
    } else if (error.name === 'CastError') {
      error = new BadRequestError('Invalid ID format');
    } else if (error.name === 'MongoError' && (error as any).code === 11000) {
      error = new ConflictError('Duplicate field value');
    } else {
      error = new InternalServerError();
    }
  }

  const appError = error as AppError;

  // Log error in development
  if (ENV.isDevelopment()) {
    console.error('Error:', {
      message: appError.message,
      stack: appError.stack,
      statusCode: appError.statusCode,
      code: appError.code,
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params
    });
  }

  // Prepare error response
  const response: ApiResponse = {
    success: false,
    message: appError.message,
    error: appError.code
  };

  // Add details in development mode
  if (ENV.isDevelopment() && appError.details) {
    response.data = appError.details;
  }

  // Add stack trace in development mode
  if (ENV.isDevelopment() && appError.stack) {
    (response as any).stack = appError.stack;
  }

  res.status(appError.statusCode || 500).json(response);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: 'ROUTE_NOT_FOUND'
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error formatter
export const formatValidationErrors = (errors: any[]): Array<{field: string, message: string}> => {
  return errors.map(error => ({
    field: error.path || error.param || 'unknown',
    message: error.msg || error.message || 'Invalid value'
  }));
};

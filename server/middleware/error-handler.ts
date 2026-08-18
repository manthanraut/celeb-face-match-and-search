import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface ErrorWithHttpMetadata extends Error {
  status?: number;
  type?: string;
}

function hasHttpMetadata(error: unknown): error is ErrorWithHttpMetadata {
  return error instanceof Error;
}

export const apiErrorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request contains invalid data.",
        details: error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path.join("."),
        })),
      },
    });
    return;
  }

  if (hasHttpMetadata(error) && error.type === "entity.parse.failed") {
    response.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "The request body must contain valid JSON.",
      },
    });
    return;
  }

  if (hasHttpMetadata(error) && (error.type === "entity.too.large" || error.status === 413)) {
    response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "The request body exceeds the allowed size.",
      },
    });
    return;
  }

  if (hasHttpMetadata(error) && error.status === 400) {
    response.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "The request could not be processed.",
      },
    });
    return;
  }

  console.error("Unhandled API error.", error);
  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "The server could not complete the request.",
    },
  });
};

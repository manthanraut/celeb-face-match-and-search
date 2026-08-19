import type { RequestHandler } from "express";

export const apiNotFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      code: "API_ROUTE_NOT_FOUND",
      message: `No API route matches ${request.method} ${request.originalUrl}.`,
    },
  });
};

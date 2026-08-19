import type { RequestHandler } from "express";

const ALLOWED_METHODS = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";

export const allowAllCors: RequestHandler = (request, response, next) => {
  response.set({
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "*",
  });

  const requestedHeaders = request.headers["access-control-request-headers"];
  if (requestedHeaders) {
    response.set("Access-Control-Allow-Headers", requestedHeaders);
    response.vary("Access-Control-Request-Headers");
  }

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
};

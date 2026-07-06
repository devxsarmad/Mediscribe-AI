import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (env.nodeEnv === "development" && error instanceof Error) {
    console.error(error);
  }

  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      ...(env.nodeEnv === "development" && error instanceof Error
        ? { stack: error.stack }
        : {}),
    },
  });
};

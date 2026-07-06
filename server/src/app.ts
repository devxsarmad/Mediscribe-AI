import cors from "cors";
import express from "express";
import { corsOptions } from "./config/cors";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found-handler";
import { apiRouter } from "./routes";

export const app = express();

app.use(
  cors(corsOptions),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "mediscribe-ai-api",
    version: "0.1.0",
  });
});

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

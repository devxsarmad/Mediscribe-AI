import type { Request, Response } from "express";
import { env } from "../config/env";

export function getApiHealth(_req: Request, res: Response) {
  res.json({
    status: "ok",
    service: "mediscribe-ai-api",
    scope: "api",
    version: "v1",
    sttProvider: env.sttProvider,
    localSttUrl: env.sttProvider === "local" ? env.localSttUrl : undefined,
  });
}

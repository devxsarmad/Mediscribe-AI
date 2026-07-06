import { Router } from "express";
import { getApiHealth } from "../controllers/health.controller";

export const healthRouter = Router();

healthRouter.get("/health", getApiHealth);

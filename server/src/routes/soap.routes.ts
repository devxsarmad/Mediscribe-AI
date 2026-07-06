import { Router } from "express";
import { createSoapNote } from "../controllers/soap.controller";
import { asyncHandler } from "../middleware/async-handler";

export const soapRouter = Router();

soapRouter.post("/soap-notes", asyncHandler(createSoapNote));

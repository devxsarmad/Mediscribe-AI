import { Router } from "express";
import { createTranscription } from "../controllers/transcription.controller";
import { asyncHandler } from "../middleware/async-handler";
import { uploadAudio } from "../middleware/upload.middleware";

export const transcriptionRouter = Router();

transcriptionRouter.post(
  "/transcriptions",
  uploadAudio,
  asyncHandler(createTranscription),
);

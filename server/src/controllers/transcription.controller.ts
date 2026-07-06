import type { Request, Response } from "express";
import { transcribeAudio } from "../services/transcription.service";
import { HttpError } from "../utils/http-error";

export async function createTranscription(req: Request, res: Response) {
  const audioFile = req.file;

  if (!audioFile) {
    throw new HttpError(400, "Audio file is required in the `audio` field.");
  }

  const result = await transcribeAudio({
    buffer: audioFile.buffer,
    mimeType: audioFile.mimetype,
    originalName: audioFile.originalname,
  });

  res.status(201).json(result);
}

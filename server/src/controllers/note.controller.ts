import type { Request, Response } from "express";
import {
  createReviewedNote,
  getNoteById,
  listNotes,
} from "../services/note.service";
import { HttpError } from "../utils/http-error";

export async function createNote(req: Request, res: Response) {
  const result = await createReviewedNote(req.body);
  res.status(201).json(result);
}

export async function getNotes(_req: Request, res: Response) {
  const result = await listNotes();
  res.json(result);
}

export async function getNote(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    throw new HttpError(400, "Note id is required.");
  }

  const result = await getNoteById(id as string);
  res.json(result);
}

import { Router } from "express";
import { createNote, getNote, getNotes } from "../controllers/note.controller";
import { asyncHandler } from "../middleware/async-handler";

export const noteRouter = Router();

noteRouter.post("/notes", asyncHandler(createNote));
noteRouter.get("/notes", asyncHandler(getNotes));
noteRouter.get("/notes/:id", asyncHandler(getNote));

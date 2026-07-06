import type { Request } from "express";
import multer from "multer";

type UploadedFileMeta = {
  mimetype: string;
};

type FileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (
    _req: Request,
    file: UploadedFileMeta,
    callback: FileFilterCallback,
  ) => {
    if (!file.mimetype.startsWith("audio/")) {
      callback(new Error("Only audio files are allowed."));
      return;
    }

    callback(null, true);
  },
});

export const uploadAudio = audioUpload.single("audio");

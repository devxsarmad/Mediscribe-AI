declare namespace Express {
  namespace Multer {
    interface File {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    }
  }

  interface Request {
    file?: Multer.File;
  }
}

declare module "multer";

import multer from "multer";
import path from "path";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../lib/errors";
import { EXPENSE_CONFIG } from "./expense.config";

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (!EXPENSE_CONFIG.ALLOWED_RECEIPT_MIME_TYPES.has(mime)) {
    cb(
      AppError.badRequest(
        `Invalid receipt file type "${file.mimetype}". Allowed types: PDF, JPG, and PNG.`
      )
    );
    return;
  }

  if (!EXPENSE_CONFIG.ALLOWED_RECEIPT_EXTENSIONS.has(ext)) {
    cb(
      AppError.badRequest(
        `Invalid receipt file extension "${ext}". Allowed extensions: .pdf, .jpg, .jpeg, .png.`
      )
    );
    return;
  }

  cb(null, true);
};

export const receiptMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: EXPENSE_CONFIG.MAX_RECEIPT_BYTES,
  },
  fileFilter,
});

const multiFields = receiptMulter.fields([
  { name: "receipt", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

export function handleReceiptUpload(req: Request, res: Response, next: NextFunction) {
  multiFields(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return next(
          AppError.badRequest(
            `Receipt file exceeds maximum allowed size of 5 MB`
          )
        );
      }
      return next(err);
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      if (files.receipt && files.receipt[0]) {
        req.file = files.receipt[0];
      } else if (files.file && files.file[0]) {
        req.file = files.file[0];
      }
    }
    next();
  });
}

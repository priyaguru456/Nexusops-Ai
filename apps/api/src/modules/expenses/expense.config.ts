export const EXPENSE_CONFIG = {
  // Configurable amount threshold above which an item requires a receipt (in integer paise).
  // 100,000 paise = ₹1,000.00
  RECEIPT_REQUIRED_THRESHOLD_PAISE: Number(process.env.EXPENSE_RECEIPT_THRESHOLD_PAISE) || 100000,

  // Maximum file size for receipt uploads: 5 MB
  MAX_RECEIPT_BYTES: 5 * 1024 * 1024,

  // Allowed receipt MIME types (PDF, JPG, PNG only)
  ALLOWED_RECEIPT_MIME_TYPES: new Set([
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ]),

  // Allowed file extensions
  ALLOWED_RECEIPT_EXTENSIONS: new Set([".pdf", ".jpg", ".jpeg", ".png"]),
};

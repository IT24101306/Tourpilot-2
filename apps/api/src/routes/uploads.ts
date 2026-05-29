import { Router } from "express";
import multer from "multer";
import { authRequired, requireRoles } from "../middleware/auth.js";
import {
  UPLOAD_DIR,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME_TYPES,
  ensureUploadDir,
  newUploadFilename,
} from "../lib/uploadStorage.js";

export const uploadsRouter = Router();

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, newUploadFilename(file.mimetype));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (UPLOAD_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
  },
});

uploadsRouter.post(
  "/",
  authRequired,
  requireRoles("AGENCY", "ADMIN"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        const message =
          err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
            ? "Image must be 5 MB or smaller"
            : err instanceof Error
              ? err.message
              : "Upload failed";
        return res.status(400).json({ error: message });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      res.status(201).json({ url: `/uploads/${req.file.filename}` });
    });
  }
);

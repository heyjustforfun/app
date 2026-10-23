import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from './validate.js';

const ALLOWED = {
  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
};

const EXTENSION_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

/** Multer instance that stores files in UPLOAD_DIR/<folder>/ with random names. */
export function uploader(folder, options = {}) {
  const dir = path.join(config.uploadDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  const maxBytes = options.maxSize || 15 * 1024 * 1024; // 15MB

  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, file, cb) => {
        let ext = ALLOWED[file.mimetype];
        if (!ext) {
          const originalExt = path.extname(file.originalname).toLowerCase();
          if (EXTENSION_MAP[originalExt]) ext = originalExt;
        }
        cb(null, crypto.randomBytes(16).toString('hex') + (ext || '.bin'));
      },
    }),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      const originalExt = path.extname(file.originalname).toLowerCase();
      if (ALLOWED[file.mimetype] || EXTENSION_MAP[originalExt]) {
        return cb(null, true);
      }
      cb(new HttpError(400, 'File type not supported. Allowed: PDF, DOC, DOCX, TXT, CSV, XLS, XLSX, ZIP, JPG, PNG, WEBP, GIF'));
    },
  });
}

/** Path stored in the DB, relative to UPLOAD_DIR. */
export const storedPath = (folder, file) => (file ? `${folder}/${file.filename}` : null);

export function absolutePath(rel) {
  const abs = path.resolve(config.uploadDir, rel);
  if (!abs.startsWith(config.uploadDir + path.sep)) throw new HttpError(400, 'Invalid file path');
  return abs;
}

export function removeFile(rel) {
  if (!rel) return;
  fs.promises.unlink(absolutePath(rel)).catch(() => {});
}

export function sendStored(res, rel, downloadName, options = {}) {
  if (!rel) throw new HttpError(404, 'File not found');
  const abs = absolutePath(rel);
  if (!fs.existsSync(abs)) throw new HttpError(404, 'File not found');
  const forceDownload = typeof options === 'boolean' ? options : !!options.download;
  if (downloadName && forceDownload) {
    res.attachment(downloadName);
  }
  res.sendFile(abs);
}

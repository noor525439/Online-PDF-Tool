import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import * as pdfController from '../controllers/pdf.controller.js';

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
try {
  fs.accessSync(uploadDir, fs.constants.W_OK);
} catch (err) {
  console.error('Upload directory is NOT writable:', err);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}.pdf`);
  }
});
const upload = multer({ storage });

router.post('/rotate', upload.single('file'), pdfController.rotatePDF);
router.post('/split', upload.single('file'), pdfController.splitPDF);
router.post('/merge', upload.array('files'), pdfController.mergePDF);
router.post('/compress', upload.single('file'), (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  next();
}, pdfController.compressPDF);
router.get('/job/:jobId', pdfController.getJobStatus);
router.get('/download/:jobId', pdfController.downloadFile);

export default router;
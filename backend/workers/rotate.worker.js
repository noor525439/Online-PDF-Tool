import fs from 'fs';
import Job from '../models/job.model.js';
import { PDFDocument, degrees } from 'pdf-lib';
import path from 'path';

const uploadDir = path.resolve(process.cwd(), 'uploads');

export const processRotate = async (payload) => {
  try {
    console.log('=== ROTATE WORKER STARTED ===', payload);
    let { jobId, fileName, file, degrees: deg, pages } = payload;
    
    let inputPath = null;
    const fileIdentifier = fileName || file;
    if (!fileIdentifier) throw new Error('No file identifier provided');

    const possiblePath = path.resolve(fileIdentifier);
    if (fs.existsSync(possiblePath)) {
      inputPath = possiblePath;
    } else {
      const baseName = path.basename(fileIdentifier);
      const files = fs.readdirSync(uploadDir);
      let matchedFile = files.find(f => f === baseName);
      if (!matchedFile) {
        const baseWithoutExt = baseName.replace(/\.pdf$/i, '');
        matchedFile = files.find(f => f.startsWith(baseWithoutExt) && f.endsWith('.pdf'));
      }
      if (!matchedFile) {
        matchedFile = files.find(f => f.includes(baseName));
      }
      if (!matchedFile) {
        throw new Error(`No file matching "${baseName}" found in ${uploadDir}. Available: ${files.join(', ')}`);
      }
      inputPath = path.join(uploadDir, matchedFile);
    }
    
    console.log(`Input file found: ${inputPath}`);
    await Job.updateOne({ jobId }, { status: 'processing' });

    const bytes = fs.readFileSync(inputPath);
    const pdf = await PDFDocument.load(bytes);
    const allPages = pdf.getPages();
    
    const rotationAngle = parseInt(deg) || 0;
    const targetPages = pages 
      ? pages.map(p => Number(p) - 1).filter(i => i >= 0 && i < allPages.length)
      : allPages.map((_, i) => i);
    
    targetPages.forEach(i => allPages[i].setRotation(degrees(rotationAngle)));
    const outputFileName = `${jobId}-rotated.pdf`;
    const outputPath = path.join(uploadDir, outputFileName);
    const pdfBytes = await pdf.save();
    fs.writeFileSync(outputPath, pdfBytes);
    
    await Job.updateOne({ jobId }, {
      status: 'done',
      outputFile: outputPath,
      downloadUrl: `/api/pdf/download/${jobId}`
    });
    
    console.log(`Rotate job ${jobId} completed!`);
  } catch (error) {
    console.error(`Error in processRotate:`, error);
    await Job.updateOne({ jobId: payload.jobId }, { status: 'failed', error: error.message });
  }
};
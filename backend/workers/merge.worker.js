import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import Job from '../models/job.model.js';

export const processMerge = async ({ jobId, files }) => {
    try {
        await Job.updateOne({ jobId }, { status: 'processing' });

        const mergedPdf = await PDFDocument.create();

        for (const filePath of files) {
            if (fs.existsSync(filePath)) { 
                const bytes = fs.readFileSync(filePath);
                const pdf = await PDFDocument.load(bytes);
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(p => mergedPdf.addPage(p));
            }
        }
        const outputFileName = `${jobId}-merged.pdf`;
        const outputPath = path.join('uploads', outputFileName);
        const pdfBytes = await mergedPdf.save();
        fs.writeFileSync(outputPath, pdfBytes);

        await Job.updateOne({ jobId }, {
            status: 'done',
            outputFile: outputPath,
            downloadUrl: `/download/${outputFileName}`
        });

        console.log(`Job ${jobId} completed successfully.`);

    } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        await Job.updateOne({ jobId }, { status: 'failed' });
    }
};
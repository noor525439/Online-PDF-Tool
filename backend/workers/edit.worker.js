import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import Job from '../models/Job.js';

const processEdit = async (data) => {
  const { jobId, file, editType, options } = data;

  try {
    await Job.findOneAndUpdate({ jobId }, { status: "processing" });

    const existingPdfBytes = await fs.readFile(file);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    if (editType === 'rotate') {
      const pages = pdfDoc.getPages();
      pages.forEach(page => page.setRotation({ angle: (options.degrees || 90) % 360 }));
    } 
    else if (editType === 'watermark') {
    }

    const outputFileName = `${jobId}-edit.pdf`;
    const outputPath = path.join('uploads', outputFileName);
    const pdfBytes = await editPDF.save();
    fs.writeFile(outputPath, pdfBytes);
    

    await Job.updateOne({ jobId }, {
                status: 'done',
                outputFile: outputPath,
                downloadUrl: `/download/${outputFileName}`
            });

    console.log(`Job ${jobId} Done.`);
  } catch (error) {
    console.error(`Job ${jobId} Failed:`, error);
    await Job.findOneAndUpdate({ jobId }, { status: "failed", error: error.message });
  }
};

consumeJobs("pdf.edit", async (msg) => {
  await processEdit(JSON.parse(msg.value.toString()));
});
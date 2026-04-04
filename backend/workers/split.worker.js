import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import Job from "../models/job.model.js";

const uploadDir = path.resolve(process.cwd(), "uploads");

export const processSplit = async ({ jobId, file }) => {
  try {

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let inputPath = path.resolve(file);

    if (!fs.existsSync(inputPath)) {
      console.warn(
        `File not found at ${inputPath}. Searching in ${uploadDir}...`,
      );
      const availableFiles = fs.readdirSync(uploadDir);                                                                                                                                             
      let matchedFile = availableFiles.find((f) => f.includes(jobId));
      if (!matchedFile) {
        const baseName = path.basename(file);
        matchedFile = availableFiles.find((f) => f === baseName);
      }
      if (!matchedFile) {
        const baseWithoutExt = path.basename(file).replace(/\.pdf$/i, "");
        matchedFile = availableFiles.find(
          (f) => f.startsWith(baseWithoutExt) && f.endsWith(".pdf"),
        );
      }
      if (!matchedFile) {
        throw new Error(
          `No input file found for job ${jobId}. Tried: ${file}. Available: ${availableFiles.join(", ")}`,
        );
      }
      inputPath = path.join(uploadDir, matchedFile);
    }

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Still cannot find input file at ${inputPath}`);
    }

    await Job.updateOne({ jobId }, { status: "processing" });

    const data = fs.readFileSync(inputPath);
    const mainPdf = await PDFDocument.load(data);
    const pageCount = mainPdf.getPageCount();

    const tempFiles = [];

    for (let i = 0; i < pageCount; i++) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(mainPdf, [i]);
      newPdf.addPage(copiedPage);

      const fileName = `${jobId}-page-${i + 1}.pdf`;
      const outputPath = path.join(uploadDir, fileName);
      const pdfBytes = await newPdf.save();
      fs.writeFileSync(outputPath, pdfBytes);
      tempFiles.push(outputPath);
    }

    const zipFileName = `${jobId}-pages.zip`;
    const zipPath = path.join(uploadDir, zipFileName);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => {
        console.log(
          `ZIP created at ${zipPath}, size: ${archive.pointer()} bytes`,
        );
        resolve();
      });
      output.on("error", reject);
      archive.on("error", reject);

      archive.pipe(output);
      tempFiles.forEach((filePath) => {
        archive.file(filePath, { name: path.basename(filePath) });
      });
      archive.finalize();
    });

    await Job.updateOne(
      { jobId },
      {
        status: "done",
        outputFile: zipPath,
        outputFiles: tempFiles,
        downloadUrl: `/api/pdf/download/${jobId}`,
        stats: {
          originalSize: fs.statSync(inputPath).size,
          compressedSize: fs.statSync(zipPath).size,
          pageCount: pageCount,
        },
      },
    );

    console.log(`Split Job ${jobId} completed successfully.`);
  } catch (error) {
    console.error(`Split Error for job ${jobId}:`, error);
    await Job.updateOne({ jobId }, { status: "failed", error: error.message });
  }
};

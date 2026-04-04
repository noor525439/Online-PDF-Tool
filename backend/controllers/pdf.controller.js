import fs from "fs";
import path from "path";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { publishJob } from "../kafka/producer.js";
import Job from "../models/job.model.js";

const uploadDir = path.resolve(process.cwd(), "uploads");

export const mergePDF = async (req, res) => {
  try {
    const jobId = uuidv4();
    const filePaths = req.files.map((f) => f.path);
    await Job.create({ jobId, type: "merge", inputFiles: filePaths });
    await publishJob("pdf.merge", { jobId, files: filePaths });
    res.json({ jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const splitPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const jobId = uuidv4();
    const absolutePath = path.resolve(req.file.path);

    await Job.create({
      jobId,
      type: "split",
      status: "pending",
      inputFiles: [absolutePath],
    });
    await publishJob("pdf.split", { jobId, file: absolutePath });
    res.json({ jobId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
export const compressPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const compressionLevel = req.body.compressionLevel || "recommended";
    const jobId = crypto.randomBytes(16).toString("hex");

    const absolutePath = path.resolve(req.file.path);

    const originalSize = req.file.size;

    const job = new Job({
      jobId,
      type: "compress",
      status: "pending",
      inputFiles: [absolutePath],
      originalSize,
      compressionLevel,
      stats: {
        originalSize,
        compressedSize: 0,
        reduction: 0,
      },
    });
    await job.save();

    await publishJob("pdf.compress", {
      jobId,
      file: absolutePath,
      compressionLevel,
      originalSize,
    });

    res.status(202).json({ jobId, status: "processing" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const rotatePDF = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const jobId = uuidv4();
    const absolutePath = path.resolve(req.file.path);
    const degrees = req.body.degrees || 90;
    const pages = req.body.pages ? JSON.parse(req.body.pages) : null;

    await Job.create({
      jobId,
      type: "rotate",
      inputFiles: [absolutePath],
      status: "pending",
    });
    await publishJob("pdf.rotate", {
      jobId,
      file: absolutePath,
      degrees,
      pages,
    });
    res.json({ jobId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findOne({ jobId });

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const response = {
      status: job.status,
      downloadUrl: job.downloadUrl || null,
      stats: {
        originalSize: Number(job.stats?.originalSize || job.originalSize || 0),
        compressedSize: Number(job.stats?.compressedSize || 0),
        reduction: Number(job.stats?.reduction || 0),
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error getting job status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const downloadFile = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findOne({ jobId });

    if (!job || job.status !== "done") {
      return res.status(404).json({ error: "File not ready" });
    }

    let filePath = job.outputFile;
    if (!filePath && job.outputFiles && job.outputFiles.length > 0) {
      filePath = job.outputFiles[0];
    }
    if (!filePath) {
      const filename = path.basename(job.downloadUrl);
      filePath = path.resolve(process.cwd(), "uploads", filename);
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const downloadName = `${jobId}${ext}`;
      res.download(filePath, downloadName);
    } else {
      res.status(404).json({ error: "Physical file not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

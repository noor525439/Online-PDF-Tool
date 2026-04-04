import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import Job from '../models/job.model.js';
import { PDFDocument } from 'pdf-lib';

const execPromise = util.promisify(exec);
const uploadDir = path.resolve(process.cwd(), 'uploads');

export const processCompress = async (jobData) => {
    const { jobId, file: filePath, compressionLevel, originalSize } = jobData;
    
    console.log(`=== COMPRESSION WORKER STARTED ===`);
    console.log(`Job ID: ${jobId}`);
    console.log(`Received file path: ${filePath}`);
    
    try {
        await Job.findOneAndUpdate(
            { jobId: jobId },
            { status: 'processing', startedAt: new Date() }
        );

        const fullPath = path.resolve(filePath);
        console.log(`Looking for file at: ${fullPath}`);
        
        if (!fs.existsSync(fullPath)) {
            console.error(`File not found at: ${fullPath}`);
            const files = fs.readdirSync(uploadDir);
            const pdfFiles = files.filter(f => f.endsWith('.pdf'));
            console.log(`Available PDF files:`, pdfFiles);
            const matchingFile = pdfFiles.find(f => f.includes(jobId));
            
            if (matchingFile) {
                const correctedPath = path.join(uploadDir, matchingFile);
                console.log(`Found matching file: ${correctedPath}`);
                await processCompression(jobId, correctedPath, compressionLevel, originalSize);
            } else {
                throw new Error(`No PDF file found for job ${jobId}. Expected at: ${fullPath}`);
            }
        } else {
            await processCompression(jobId, fullPath, compressionLevel, originalSize);
        }
        
    } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        await Job.findOneAndUpdate(
            { jobId: jobId },
            { 
                status: 'failed',
                error: error.message,
                completedAt: new Date()
            }
        );
        throw error;
    }
};

async function processCompression(jobId, filePath, compressionLevel, originalSize) {
    console.log(`Processing compression for: ${filePath}`);
    
    const outputPath = path.join(uploadDir, `${jobId}-compressed.pdf`);

    let gsSetting = '';
    switch(compressionLevel) {
        case 'extreme':
            gsSetting = '/screen';    
            break;
        case 'recommended':
            gsSetting = '/ebook';     
            break;
        case 'less':
            gsSetting = '/printer'; 
            break;
        default:
            gsSetting = '/ebook';
    }

    const gsCommand = `gs -sDEVICE=pdfwrite -dPDFSETTINGS=${gsSetting} -dCompatibilityLevel=1.4 -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${outputPath} ${filePath}`;
    
    let compressedSize;
    let reductionVal;
    
    try {
        console.log(`Running Ghostscript with setting: ${gsSetting}`);
        await execPromise(gsCommand);
        if (!fs.existsSync(outputPath)) {
            throw new Error('Ghostscript did not create output file');
        }
        
        compressedSize = fs.statSync(outputPath).size;
        reductionVal = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));
        
        console.log(`Ghostscript compression complete: ${originalSize} -> ${compressedSize} (${reductionVal}% reduction)`);
        
    } catch (gsError) {
        console.error('Ghostscript failed, falling back to pdf-lib:', gsError.message);
        
        const pdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const compressedPdfBytes = await pdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 50,
            updateFieldObjects: true,
            compress: true,
        });
        fs.writeFileSync(outputPath, compressedPdfBytes);
        
        compressedSize = compressedPdfBytes.length;
        reductionVal = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));
        
        console.log(`pdf-lib compression complete: ${originalSize} -> ${compressedSize} (${reductionVal}% reduction)`);
    }
    
    await Job.findOneAndUpdate(
        { jobId: jobId },
        {
            status: 'done', 
            outputFile: outputPath,
            downloadUrl: `/api/pdf/download/${jobId}`, 
            originalSize: originalSize,
            compressedSize: compressedSize,
            stats: {
                originalSize: originalSize,
                compressedSize: compressedSize,
                reduction: reductionVal
            },
            completedAt: new Date()
        }
    );
    
    return {
        outputPath,
        originalSize,
        compressedSize,
        reduction: reductionVal
    };
}
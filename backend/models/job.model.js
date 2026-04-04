import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  jobId:       { type: String, required: true, unique: true },
  type:        { type: String, enum: ['merge','split','compress','rotate','pdf-to-img'] },
  status:      { type: String, enum: ['pending','processing','done','failed'], default: 'pending' },
  inputFiles:  [String],
  outputFile:  String,
  downloadUrl: String,
  error:       String,

  originalSize: { type: Number },    
  compressedSize: { type: Number },   
  compressionLevel: { type: String }, 
  stats: {
    originalSize: Number,
    compressedSize: Number,
    reduction: Number
  }
  
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

export default Job;
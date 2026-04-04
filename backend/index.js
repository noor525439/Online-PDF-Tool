import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import pdfRoutes from './routes/pdf.routes.js';
import { connectProducer } from './kafka/producer.js';
import { connectConsumer } from './kafka/consumer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/pdf', pdfRoutes);

app.get("/", (req, res) => {
    res.send("PDF Tool Backend is running...");
});

const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        await connectProducer();
        console.log('Kafka Producer Connected');

        await connectConsumer();
        console.log('Kafka Consumer Started');

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Server startup error:', err);
        process.exit(1); 
    }
};

startServer();
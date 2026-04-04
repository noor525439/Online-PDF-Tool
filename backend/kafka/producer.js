import { Kafka, Partitioners } from 'kafkajs';
import path from 'path';
import fs from 'fs';

const kafka = new Kafka({
  clientId: 'pdf-tool-backend',
  brokers: [process.env.KAFKA_BROKERS || 'kafka:29092']  
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner
});

export const connectProducer = async () => await producer.connect();

export const publishJob = async (topic, payload) => {

  if (topic === 'pdf.compress') {
    if (!payload.file) {
      throw new Error(`KAFKA Missing 'file' field in payload for job ${payload.jobId}`);
    }
  }

  if (payload.file) {
    try {
      const absolutePath = path.resolve(payload.file);
      if (!fs.existsSync(absolutePath)) {
      } else {
        payload.file = absolutePath;
      }
    } catch (err) {
      console.error(`KAFKA Error resolving path for ${payload.file}:`, err.message);
    }
  }

  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }]
    });
  } catch (err) {
    console.error(`KAFKA Failed to send message:`, err);
    throw err;
  }
};
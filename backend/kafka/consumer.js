import { Kafka } from 'kafkajs';
import { processMerge } from '../workers/merge.worker.js';
import { processSplit } from '../workers/split.worker.js';
import { processCompress } from '../workers/compress.worker.js';
import { processRotate } from '../workers/rotate.worker.js';
import { processEdit } from '../workers/edit.worker.js';
const kafka = new Kafka({
  clientId: 'pdf-tool-backend',
  brokers: [process.env.KAFKA_BROKERS || 'kafka:29092']   
});

export const connectConsumer = async () => {
  const topicsMap = {
    'pdf.merge': processMerge,
    'pdf.split': processSplit,
    'pdf.compress': processCompress,
    'pdf.rotate': processRotate,
    'pdf.edit': processEdit,
  };

  for (const [topic, handler] of Object.entries(topicsMap)) {
    const consumer = kafka.consumer({ 
       groupId: `group-v5-${topic}`,
      sessionTimeout: 30000, 
      heartbeatInterval: 3000 
    });

    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    consumer.run({
      eachMessage: async ({ message }) => {
        const payloadString = message.value.toString();
        
        try {
          const payload = JSON.parse(payloadString);
          await handler(payload);
        } catch (err) {
          console.error(` [ERROR] in Topic ${topic}:`, err.message);
        }
      },
    }).catch(err => console.error(`Consumer failed for ${topic}:`, err));
  }
};
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.routes';
import campaignRoutes from './routes/campaign.routes';
import { syncQueueWithDatabase } from './services/queue';
import { getMailerTransporter } from './services/mailer';
import { prisma } from './config/db';

import './workers/worker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to MySQL database.');

    await getMailerTransporter();
    console.log('Mailer transporter ready.');

    await syncQueueWithDatabase();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
    });
  } catch (error) {
    console.error('Critical server startup failure:', error);
    process.exit(1);
  }
}

startServer();

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { router } from './routes';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // For development flexibility
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api', router);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start listening
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Tax Exemption Server running on port ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`=============================================`);
});

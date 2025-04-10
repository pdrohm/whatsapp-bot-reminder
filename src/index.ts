import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import WhatsAppService from './services/whatsappService';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

// Set the correct timezone
process.env.TZ = process.env.TIMEZONE || 'America/Sao_Paulo';

async function startApp() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reminder_bot');
    console.log('MongoDB connected successfully!');

    // Initialize Express app
    const app = express();
    const server = createServer(app);
    const wss = new WebSocketServer({ server });

    // Serve static files
    app.use(express.static(path.join(__dirname, '../public')));

    // Initialize WhatsApp service
    const whatsAppService = new WhatsAppService();

    // Handle WebSocket connections
    wss.on('connection', (ws) => {
      console.log('New WebSocket connection');
      whatsAppService.addWebSocketClient(ws);
    });

    // Initialize WhatsApp client
    whatsAppService.initialize();
    
    // Start the server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Open http://localhost:${PORT} in your browser to see the QR code`);
    });
  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
startApp(); 
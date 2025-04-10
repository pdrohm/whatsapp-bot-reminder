import express from 'express';
import { WebSocketServer } from 'ws';
import WhatsAppService from './services/whatsappService';
import { connectDB } from './config/database';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set the correct timezone
process.env.TZ = process.env.TIMEZONE || 'America/Sao_Paulo';

const app = express();
const port = process.env.PORT || 3000;

// Initialize WhatsApp service
const whatsAppService = new WhatsAppService();

// WebSocket server for real-time updates
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    
    // Send initial status
    ws.send(JSON.stringify({
        type: 'status',
        message: whatsAppService.isClientConnected() ? 'Connected to WhatsApp' : 'Waiting for QR code...',
        connected: whatsAppService.isClientConnected()
    }));

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: whatsAppService.isClientConnected() ? 'connected' : 'disconnected'
    });
});

// Start the server
app.listen(port, async () => {
    try {
        await connectDB();
        console.log(`Server is running on port ${port}`);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}); 
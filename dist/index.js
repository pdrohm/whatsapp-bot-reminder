"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = __importDefault(require("./config/database"));
const whatsappService_1 = __importDefault(require("./services/whatsappService"));
// Load environment variables
dotenv_1.default.config();
// Set the correct timezone
process.env.TZ = process.env.TIMEZONE || 'America/Sao_Paulo';
async function startApp() {
    try {
        // Connect to MongoDB
        await (0, database_1.default)();
        // Initialize WhatsApp service
        const whatsAppService = new whatsappService_1.default();
        whatsAppService.initialize();
        console.log('WhatsApp Reminder Bot started successfully!');
        console.log('Waiting for WhatsApp authentication...');
    }
    catch (error) {
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

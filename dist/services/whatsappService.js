"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const nlpService_1 = require("./nlpService");
const reminderService_1 = require("./reminderService");
const schedulerService_1 = require("./schedulerService");
class WhatsAppService {
    constructor() {
        this.isReady = false;
        // Initialize WhatsApp client with local authentication
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth(),
            puppeteer: {
                args: ['--no-sandbox']
            }
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        // Generate QR code for authentication
        this.client.on('qr', (qr) => {
            console.log('QR Code received. Scan it with WhatsApp on your phone:');
            qrcode_terminal_1.default.generate(qr, { small: true });
        });
        // Handle client ready event
        this.client.on('ready', () => {
            console.log('WhatsApp client is ready!');
            this.isReady = true;
            // Initialize scheduler when client is ready
            (0, schedulerService_1.initScheduler)({
                sendMessage: this.sendMessage.bind(this)
            });
        });
        // Handle incoming messages
        this.client.on('message', async (message) => {
            try {
                // Skip messages from groups
                if (message.from.includes('@g.us'))
                    return;
                // Handle all WhatsApp messages
                await this.handleIncomingMessage(message);
            }
            catch (error) {
                console.error('Error processing message:', error);
            }
        });
        // Handle authentication failure
        this.client.on('auth_failure', (msg) => {
            console.error('Authentication failure:', msg);
        });
        // Handle disconnection
        this.client.on('disconnected', (reason) => {
            console.log('Client was disconnected:', reason);
            this.isReady = false;
        });
    }
    // Initialize the WhatsApp client
    initialize() {
        console.log('Initializing WhatsApp client...');
        this.client.initialize();
    }
    // Send message to a WhatsApp number
    async sendMessage(to, text) {
        if (!this.isReady) {
            throw new Error('WhatsApp client is not ready');
        }
        return await this.client.sendMessage(to, text);
    }
    // Process incoming message
    async handleIncomingMessage(message) {
        const from = message.from;
        const messageContent = message.body;
        const userId = from; // Use the phone number as userId
        // Handle commands
        if (messageContent.startsWith('/')) {
            await this.handleCommand(userId, messageContent);
            return;
        }
        // Try to parse as a reminder
        const reminderData = (0, nlpService_1.parseMessage)(messageContent);
        if (reminderData) {
            // Create a new reminder
            const reminder = await (0, reminderService_1.createReminder)({
                userId,
                text: reminderData.text,
                date: reminderData.date || new Date(),
                time: reminderData.time || '12:00',
                frequency: reminderData.frequency
            });
            // Confirmation message
            const frequencyText = {
                'once': 'única vez',
                'daily': 'diariamente',
                'weekly': 'semanalmente',
                'monthly': 'mensalmente'
            }[reminder.frequency];
            const confirmationMessage = `✅ Lembrete criado com sucesso!\n` +
                `📝 *${reminder.text}*\n` +
                `📆 Data: ${reminder.date.toLocaleDateString('pt-BR')}\n` +
                `⏰ Horário: ${reminder.time}\n` +
                `🔄 Frequência: ${frequencyText}\n\n` +
                `Para ver seus lembretes, digite /lembretes\n` +
                `Para marcar como concluído, use /concluir ID`;
            await this.sendMessage(userId, confirmationMessage);
        }
        else {
            // If not recognized as a reminder, send help message
            const helpMessage = `Não entendi como um lembrete. Tente algo como:\n\n` +
                `"Reunião com cliente dia 15 de maio às 14:00"\n` +
                `"Todos os dias preciso tomar remédio às 8:00"\n\n` +
                `Para ajuda, digite /ajuda`;
            await this.sendMessage(userId, helpMessage);
        }
    }
    // Handle commands like /lembretes, /concluir, etc.
    async handleCommand(userId, command) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        switch (cmd) {
            case '/ajuda':
                await this.sendHelpMessage(userId);
                break;
            case '/lembretes':
                await this.sendRemindersList(userId);
                break;
            case '/concluir':
                if (args.length > 0) {
                    await this.completeReminder(userId, args[0]);
                }
                else {
                    await this.sendMessage(userId, '❌ Por favor, forneça o ID do lembrete. Exemplo: /concluir 123456');
                }
                break;
            case '/deletar':
                if (args.length > 0) {
                    await this.removeReminder(userId, args[0]);
                }
                else {
                    await this.sendMessage(userId, '❌ Por favor, forneça o ID do lembrete. Exemplo: /deletar 123456');
                }
                break;
            default:
                await this.sendMessage(userId, `❓ Comando não reconhecido. Digite /ajuda para ver os comandos disponíveis.`);
        }
    }
    // Send help message
    async sendHelpMessage(userId) {
        const helpMessage = `*🤖 Bot de Lembretes - Comandos*\n\n` +
            `Para criar um lembrete, simplesmente envie uma mensagem descrevendo o evento, data e hora. Exemplos:\n\n` +
            `"Reunião amanhã às 14:00"\n` +
            `"Consulta médica dia 15 de maio às 10:30"\n` +
            `"Todos os dias preciso tomar vitamina às 8:00"\n\n` +
            `*Comandos disponíveis:*\n` +
            `/lembretes - Listar todos seus lembretes\n` +
            `/concluir ID - Marcar um lembrete como concluído\n` +
            `/deletar ID - Remover um lembrete\n` +
            `/ajuda - Mostrar esta mensagem de ajuda`;
        await this.sendMessage(userId, helpMessage);
    }
    // Send list of user's reminders
    async sendRemindersList(userId) {
        const reminders = await (0, reminderService_1.getUserReminders)(userId);
        if (reminders.length === 0) {
            await this.sendMessage(userId, '📝 Você não tem lembretes ativos.');
            return;
        }
        const remindersList = reminders.map((reminder, index) => {
            const status = reminder.completed ? '✅' : '⏳';
            const date = reminder.date.toLocaleDateString('pt-BR');
            return `${status} *${index + 1}.* ${reminder.text}\n` +
                `📆 Data: ${date} ⏰ Hora: ${reminder.time}\n` +
                `🔄 Frequência: ${reminder.frequency}\n` +
                `🆔 ID: ${reminder._id.toString()}\n`;
        }).join('\n');
        const message = `*📋 Seus Lembretes:*\n\n${remindersList}\n\n` +
            `Para marcar como concluído, use /concluir ID\n` +
            `Para remover, use /deletar ID`;
        await this.sendMessage(userId, message);
    }
    // Mark a reminder as completed
    async completeReminder(userId, reminderId) {
        try {
            const updatedReminder = await (0, reminderService_1.markReminderAsCompleted)(reminderId);
            if (updatedReminder) {
                await this.sendMessage(userId, `✅ Lembrete "${updatedReminder.text}" marcado como concluído!`);
            }
            else {
                await this.sendMessage(userId, '❌ Lembrete não encontrado. Verifique o ID e tente novamente.');
            }
        }
        catch (error) {
            console.error('Error completing reminder:', error);
            await this.sendMessage(userId, '❌ Erro ao marcar lembrete como concluído. Tente novamente mais tarde.');
        }
    }
    // Delete a reminder
    async removeReminder(userId, reminderId) {
        try {
            const result = await (0, reminderService_1.deleteReminder)(reminderId);
            if (result) {
                await this.sendMessage(userId, `🗑️ Lembrete removido com sucesso!`);
            }
            else {
                await this.sendMessage(userId, '❌ Lembrete não encontrado. Verifique o ID e tente novamente.');
            }
        }
        catch (error) {
            console.error('Error deleting reminder:', error);
            await this.sendMessage(userId, '❌ Erro ao remover lembrete. Tente novamente mais tarde.');
        }
    }
}
exports.default = WhatsAppService;

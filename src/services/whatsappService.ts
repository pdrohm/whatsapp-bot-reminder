import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { ConversationManager } from './openaiService';
import { SchedulerService } from './schedulerService';
import { parseMessage } from './nlpService';
import { createReminder } from './reminderService';

class WhatsAppService {
    private client: Client;
    private isConnected: boolean = false;
    private conversations: Map<string, ConversationManager> = new Map();
    private scheduler: SchedulerService;

    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                args: ['--no-sandbox'],
            }
        });

        this.scheduler = new SchedulerService(this);
        this.initialize();
    }

    private initialize() {
        this.client.on('qr', (qr) => {
            qrcode.generate(qr, { small: true });
            console.log('QR Code gerado. Por favor, escaneie com o WhatsApp.');
        });

        this.client.on('ready', () => {
            console.log('Cliente está pronto!');
            this.isConnected = true;
            this.scheduler.start();
        });

        this.client.on('message', async (message: Message) => {
            try {
                const userId = message.from;
                const messageContent = message.body;

                // Handle commands
                if (messageContent.startsWith('/')) {
                    await this.handleCommand(userId, messageContent);
                    return;
                }

                // Try to parse as a reminder first
                const reminderData = parseMessage(messageContent);
                if (reminderData) {
                    // Create a new reminder
                    const reminder = await createReminder({
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

                    await message.reply(confirmationMessage);
                    return;
                }

                // If not a reminder, process through OpenAI
                if (!this.conversations.has(userId)) {
                    this.conversations.set(userId, new ConversationManager(userId));
                }
                const conversation = this.conversations.get(userId)!;
                const response = await conversation.processMessage(messageContent);
                await message.reply(response);

            } catch (error) {
                console.error('Error handling message:', error);
                await message.reply('Desculpe, ocorreu um erro ao processar sua mensagem.');
            }
        });

        this.client.initialize();
    }

    private async handleCommand(userId: string, command: string) {
        // Handle commands like /lembretes, /concluir, etc.
        // Implementation of command handling
    }

    public async sendMessage(to: string, content: string): Promise<void> {
        try {
            await this.client.sendMessage(to, content);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    public isClientConnected(): boolean {
        return this.isConnected;
    }
}

export default WhatsAppService;
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { ConversationManager } from './openaiService';
import { SchedulerService } from './schedulerService';
import { parseMessage } from './nlpService';
import { createReminder, getUserReminders, markReminderAsCompleted, deleteReminder } from './reminderService';

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

                console.log('Received message:', messageContent);

                // Handle commands
                if (messageContent.startsWith('/')) {
                    await this.handleCommand(userId, messageContent);
                    return;
                }

                // Initialize conversation manager if not exists
                if (!this.conversations.has(userId)) {
                    this.conversations.set(userId, new ConversationManager(userId));
                }
                const conversation = this.conversations.get(userId)!;

                // Process through OpenAI first
                const response = await conversation.processMessage(messageContent);
                
                // If OpenAI didn't handle it (no reminder created or deleted), try parsing as a reminder
                if (!response.includes("criar lembrete") && 
                    !response.includes("deletar") && 
                    !response.includes("remover") && 
                    !response.includes("apagar")) {
                    
                    const reminderData = parseMessage(messageContent);
                    if (reminderData) {
                        console.log('Parsed reminder data:', reminderData);
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
                }

                // Send the response from OpenAI or reminder creation
                await message.reply(response);

            } catch (error) {
                console.error('Error handling message:', error);
                await message.reply('Desculpe, ocorreu um erro ao processar sua mensagem.');
            }
        });

        this.client.initialize();
    }

    private async handleCommand(userId: string, command: string) {
        try {
            const [cmd, ...args] = command.split(' ');
            
            switch (cmd.toLowerCase()) {
                case '/lembretes':
                    const reminders = await getUserReminders(userId);
                    if (reminders.length === 0) {
                        await this.sendMessage(userId, 'Você não tem nenhum lembrete cadastrado.');
                        return;
                    }
                    
                    const remindersList = reminders.map((r, index) => {
                        const status = r.completed ? '✅' : '⏳';
                        return `${index + 1}. ${status} *${r.text}*\n   📆 ${r.date.toLocaleDateString('pt-BR')} às ${r.time}\n   ID: ${r._id}`;
                    }).join('\n\n');
                    
                    await this.sendMessage(userId, `📋 *Seus Lembretes:*\n\n${remindersList}`);
                    break;

                case '/concluir':
                    if (!args[0]) {
                        await this.sendMessage(userId, 'Por favor, forneça o ID do lembrete. Exemplo: /concluir 123');
                        return;
                    }
                    
                    const reminderId = args[0];
                    const updatedReminder = await markReminderAsCompleted(reminderId);
                    
                    if (updatedReminder) {
                        await this.sendMessage(userId, `✅ Lembrete marcado como concluído: *${updatedReminder.text}*`);
                    } else {
                        await this.sendMessage(userId, '❌ Lembrete não encontrado ou já concluído.');
                    }
                    break;

                case '/deletar':
                    if (!args[0]) {
                        await this.sendMessage(userId, 'Por favor, forneça o ID do lembrete. Exemplo: /deletar 123');
                        return;
                    }
                    
                    const deleteId = args[0];
                    const deleted = await deleteReminder(deleteId);
                    
                    if (deleted) {
                        await this.sendMessage(userId, '✅ Lembrete deletado com sucesso!');
                    } else {
                        await this.sendMessage(userId, '❌ Lembrete não encontrado.');
                    }
                    break;

                case '/ajuda':
                    const helpMessage = `🤖 *Comandos disponíveis:*\n\n` +
                        `📋 */lembretes* - Listar todos seus lembretes\n` +
                        `✅ */concluir ID* - Marcar um lembrete como concluído\n` +
                        `❌ */deletar ID* - Remover um lembrete\n` +
                        `❓ */ajuda* - Mostrar esta mensagem de ajuda\n\n` +
                        `Para criar um lembrete, basta enviar uma mensagem descrevendo o evento, data e hora.`;
                    await this.sendMessage(userId, helpMessage);
                    break;

                default:
                    await this.sendMessage(userId, '❌ Comando não reconhecido. Digite /ajuda para ver os comandos disponíveis.');
            }
        } catch (error) {
            console.error('Error handling command:', error);
            await this.sendMessage(userId, '❌ Ocorreu um erro ao processar o comando.');
        }
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
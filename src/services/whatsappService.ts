import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { ConversationManager } from './openaiService';
import { initScheduler } from './schedulerService';

class WhatsAppService {
    private client: Client;
    private isConnected: boolean = false;
    private conversations: Map<string, ConversationManager> = new Map();

    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                args: ['--no-sandbox'],
            }
        });

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
            initScheduler(this);
        });

        this.client.on('message', async (message: Message) => {
            try {
                const userId = message.from;
                
                // Get or create conversation manager for this user
                if (!this.conversations.has(userId)) {
                    this.conversations.set(userId, new ConversationManager(userId));
                }
                const conversation = this.conversations.get(userId)!;

                // Process the message through the conversation manager
                const response = await conversation.processMessage(message.body);
                
                // Send the response
                await message.reply(response);

            } catch (error) {
                console.error('Error handling message:', error);
                await message.reply('Desculpe, ocorreu um erro ao processar sua mensagem.');
            }
        });

        this.client.initialize();
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
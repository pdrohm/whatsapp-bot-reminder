import { Client, LocalAuth } from 'whatsapp-web.js';
import { WebSocket } from 'ws';
import { parseMessage } from './nlpService';
import { createReminder, getUserReminders, markReminderAsCompleted, deleteReminder } from './reminderService';
import { initScheduler } from './schedulerService';

class WhatsAppService {
  private client: Client;
  private isReady: boolean = false;
  private wsClients: Set<WebSocket> = new Set();

  constructor() {
    console.log('Creating WhatsApp client...');
    // Initialize WhatsApp client with local authentication
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
        executablePath: process.platform === 'darwin' 
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          : undefined
      }
    });

    this.setupEventHandlers();
  }

  public addWebSocketClient(ws: WebSocket) {
    console.log('Adding new WebSocket client');
    this.wsClients.add(ws);
    
    // Send initial status to new client
    this.broadcastToClients({
      type: 'status',
      message: this.isReady ? 'Connected to WhatsApp' : 'Waiting for QR code...',
      connected: this.isReady
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      this.wsClients.delete(ws);
    });
  }

  private broadcastToClients(data: any) {
    console.log('Broadcasting to clients:', data.type);
    const message = JSON.stringify(data);
    this.wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private setupEventHandlers(): void {
    // Generate QR code for authentication
    this.client.on('qr', (qr) => {
      console.log('QR Code received, broadcasting to clients');
      this.broadcastToClients({
        type: 'qr',
        qr: qr
      });
    });

    // Handle client ready event
    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.isReady = true;
      const info = this.client.info;
      const phoneNumber = info.wid.user;
      this.broadcastToClients({
        type: 'status',
        message: `Connected to WhatsApp (${phoneNumber})`,
        connected: true,
        phoneNumber: phoneNumber
      });
      
      // Initialize scheduler when client is ready
      initScheduler({
        sendMessage: this.sendMessage.bind(this)
      });
    });

    // Handle incoming messages
    this.client.on('message', async (message) => {
      try {
        console.log('Received message:', message.body);
        console.log('From:', message.from);
        
        // Skip messages from groups
        if (message.from.includes('@g.us')) {
          console.log('Skipping group message');
          return;
        }
        
        // Handle all WhatsApp messages
        await this.handleIncomingMessage(message);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    // Handle authentication failure
    this.client.on('auth_failure', (msg) => {
      console.error('Authentication failure:', msg);
      this.broadcastToClients({
        type: 'status',
        message: 'Authentication failed',
        connected: false
      });
    });

    // Handle disconnection
    this.client.on('disconnected', (reason) => {
      console.log('Client was disconnected:', reason);
      this.isReady = false;
      this.broadcastToClients({
        type: 'status',
        message: 'Disconnected from WhatsApp',
        connected: false
      });
    });
  }

  // Initialize the WhatsApp client
  public initialize(): void {
    console.log('Initializing WhatsApp client...');
    this.client.initialize().catch(error => {
      console.error('Error initializing WhatsApp client:', error);
      this.broadcastToClients({
        type: 'status',
        message: 'Error initializing WhatsApp client',
        connected: false
      });
    });
  }

  // Send message to a WhatsApp number
  public async sendMessage(to: string, text: string): Promise<any> {
    try {
      console.log('Attempting to send message to:', to);
      console.log('Message content:', text);
      
      if (!this.isReady) {
        console.error('WhatsApp client is not ready');
        throw new Error('WhatsApp client is not ready');
      }
      
      const result = await this.client.sendMessage(to, text);
      console.log('Message sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Process incoming message
  private async handleIncomingMessage(message: any): Promise<void> {
    try {
      console.log('Processing incoming message...');
      const from = message.from;
      const messageContent = message.body;
      const userId = from; // Use the phone number as userId
      
      console.log('Message from:', from);
      console.log('Message content:', messageContent);
      
      // Handle commands
      if (messageContent.startsWith('/')) {
        console.log('Handling command:', messageContent);
        await this.handleCommand(userId, messageContent);
        return;
      }
      
      // Try to parse as a reminder
      console.log('Trying to parse as reminder');
      const reminderData = parseMessage(messageContent);
      console.log('Parsed reminder data:', reminderData);
      
      if (reminderData) {
        console.log('Creating reminder with data:', reminderData);
        // Create a new reminder
        const reminder = await createReminder({
          userId,
          text: reminderData.text,
          date: reminderData.date || new Date(),
          time: reminderData.time || '12:00',
          frequency: reminderData.frequency
        });
        
        console.log('Reminder created:', reminder);
        
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
        
        console.log('Sending confirmation message:', confirmationMessage);
        await this.sendMessage(userId, confirmationMessage);
      } else {
        console.log('Message not recognized as reminder, sending help message');
        // If not recognized as a reminder, send help message
        const helpMessage = `Não entendi como um lembrete. Tente algo como:\n\n` +
          `"Reunião com cliente dia 15 de maio às 14:00"\n` +
          `"Todos os dias preciso tomar remédio às 8:00"\n\n` +
          `Para ajuda, digite /ajuda`;
        
        await this.sendMessage(userId, helpMessage);
      }
    } catch (error) {
      console.error('Error in handleIncomingMessage:', error);
    }
  }

  // Handle commands like /lembretes, /concluir, etc.
  private async handleCommand(userId: string, command: string): Promise<void> {
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
        } else {
          await this.sendMessage(userId, '❌ Por favor, forneça o ID do lembrete. Exemplo: /concluir 123456');
        }
        break;
        
      case '/deletar':
        if (args.length > 0) {
          await this.removeReminder(userId, args[0]);
        } else {
          await this.sendMessage(userId, '❌ Por favor, forneça o ID do lembrete. Exemplo: /deletar 123456');
        }
        break;
        
      default:
        await this.sendMessage(userId, `❓ Comando não reconhecido. Digite /ajuda para ver os comandos disponíveis.`);
    }
  }

  // Send help message
  private async sendHelpMessage(userId: string): Promise<void> {
    const helpMessage = 
      `*🤖 Bot de Lembretes - Comandos*\n\n` +
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
  private async sendRemindersList(userId: string): Promise<void> {
    const reminders = await getUserReminders(userId);
    
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
  private async completeReminder(userId: string, reminderId: string): Promise<void> {
    try {
      const updatedReminder = await markReminderAsCompleted(reminderId);
      
      if (updatedReminder) {
        await this.sendMessage(userId, `✅ Lembrete "${updatedReminder.text}" marcado como concluído!`);
      } else {
        await this.sendMessage(userId, '❌ Lembrete não encontrado. Verifique o ID e tente novamente.');
      }
    } catch (error) {
      console.error('Error completing reminder:', error);
      await this.sendMessage(userId, '❌ Erro ao marcar lembrete como concluído. Tente novamente mais tarde.');
    }
  }

  // Delete a reminder
  private async removeReminder(userId: string, reminderId: string): Promise<void> {
    try {
      const result = await deleteReminder(reminderId);
      
      if (result) {
        await this.sendMessage(userId, `🗑️ Lembrete removido com sucesso!`);
      } else {
        await this.sendMessage(userId, '❌ Lembrete não encontrado. Verifique o ID e tente novamente.');
      }
    } catch (error) {
      console.error('Error deleting reminder:', error);
      await this.sendMessage(userId, '❌ Erro ao remover lembrete. Tente novamente mais tarde.');
    }
  }
}

export default WhatsAppService; 
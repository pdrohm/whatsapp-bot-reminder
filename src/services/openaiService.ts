import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createReminder, getUserReminders, markReminderAsCompleted, deleteReminder } from './reminderService';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `Você é um assistente especializado em criar e gerenciar lembretes. 
Sua função é ajudar os usuários a criar e gerenciar lembretes através de conversas naturais.

Você deve:
1. Entender o contexto da conversa e as necessidades do usuário
2. Extrair informações relevantes para criar ou gerenciar lembretes
3. Manter um histórico da conversa para contexto
4. Usar emojis para tornar a conversa mais amigável
5. Ser conciso e direto nas respostas
6. Identificar quando o usuário quer deletar um lembrete e extrair qual lembrete deve ser deletado

Formato de resposta:
- Sempre confirme os detalhes do lembrete
- Use emojis para tornar a conversa mais amigável
- Mantenha um tom profissional mas acolhedor
- Seja conciso e direto`;

type Message = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

export class ConversationManager {
    private conversationHistory: Message[] = [];

    constructor(private userId: string) {
        this.conversationHistory.push({ role: "system", content: SYSTEM_PROMPT });
    }

    async processMessage(message: string): Promise<string> {
        try {
            // Add user message to history
            this.conversationHistory.push({ role: "user", content: message });

            // Get user's existing reminders for context
            const userReminders = await getUserReminders(this.userId);
            const remindersContext = userReminders.length > 0 
                ? `\n\nLembretes atuais do usuário:\n${userReminders.map(r => 
                    `- ID: ${r._id} | ${r.text} (${r.date.toLocaleDateString('pt-BR')} às ${r.time})`
                ).join('\n')}`
                : '';

            // Add reminders context to the conversation
            this.conversationHistory.push({
                role: "system",
                content: `Contexto atual do usuário:${remindersContext}`
            });

            const completion = await openai.chat.completions.create({
                messages: this.conversationHistory,
                model: "gpt-3.5-turbo",
                temperature: 0.3,
                max_tokens: 150
            });

            const response = completion.choices[0].message.content || "Desculpe, não consegui processar sua mensagem.";
            
            // Add AI response to history
            this.conversationHistory.push({ role: "assistant", content: response });

            // Check if the response indicates a reminder should be created
            if (response.toLowerCase().includes("criar lembrete") || 
                response.toLowerCase().includes("vou criar") || 
                response.toLowerCase().includes("lembrete criado") ||
                message.toLowerCase().includes("me lembre") ||
                message.toLowerCase().includes("me avise") ||
                message.toLowerCase().includes("criar lembrete")) {
                
                console.log('Message indicates a reminder should be created');
                
                // Extract reminder details from the conversation
                const reminderData = await this.extractReminderDetails(message);
                console.log('Extracted reminder data:', reminderData);
                
                if (reminderData) {
                    console.log('Creating reminder with data:', {
                        userId: this.userId,
                        text: reminderData.text,
                        date: reminderData.date,
                        time: reminderData.time,
                        frequency: reminderData.frequency
                    });
                    
                    const createdReminder = await createReminder({
                        userId: this.userId,
                        text: reminderData.text,
                        date: reminderData.date,
                        time: reminderData.time,
                        frequency: reminderData.frequency
                    });
                    
                    console.log('Reminder created:', createdReminder);
                    
                    if (createdReminder) {
                        return `✅ Lembrete criado com sucesso!\n📝 ${reminderData.text}\n⏰ ${reminderData.time}\n📅 ${reminderData.date.toLocaleDateString('pt-BR')}\n🔄 ${reminderData.frequency}`;
                    } else {
                        return "❌ Não foi possível criar o lembrete. Por favor, tente novamente.";
                    }
                } else {
                    return "❌ Não consegui extrair os detalhes do lembrete. Por favor, tente ser mais específico.";
                }
            }

            // Check if the response indicates a reminder should be deleted
            if (response.toLowerCase().includes("deletar") || 
                response.toLowerCase().includes("remover") || 
                response.toLowerCase().includes("apagar") ||
                message.toLowerCase().includes("deletar") || 
                message.toLowerCase().includes("remover") || 
                message.toLowerCase().includes("apagar") ||
                message.toLowerCase().includes("delete") ||
                message.toLowerCase().includes("remove") ||
                message.toLowerCase().includes("excluir") ||
                message.toLowerCase().includes("cancelar")) {
                
                console.log('Message indicates a reminder should be deleted');
                
                // Check for "delete all" variations first
                const cleanMessage = message.toLowerCase()
                    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                const deleteAllKeywords = [
                    'todos', 'tudo', 'all', 'todos os', 'todos os lembretes',
                    'todos lembretes', 'todos os reminders', 'todos reminders',
                    'apagar tudo', 'deletar tudo', 'remover tudo',
                    'limpar tudo', 'limpar todos', 'limpar lembretes'
                ];
                
                if (deleteAllKeywords.some(keyword => cleanMessage.includes(keyword))) {
                    console.log('User wants to delete all reminders');
                    
                    if (userReminders.length === 0) {
                        return "ℹ️ Não há lembretes para deletar.";
                    }
                    
                    let deletedCount = 0;
                    let failedCount = 0;
                    
                    for (const reminder of userReminders) {
                        try {
                            const deleted = await deleteReminder(reminder._id.toString());
                            if (deleted) {
                                deletedCount++;
                            } else {
                                failedCount++;
                            }
                        } catch (error) {
                            console.error(`Error deleting reminder ${reminder._id}:`, error);
                            failedCount++;
                        }
                    }
                    
                    if (deletedCount > 0) {
                        return `✅ ${deletedCount} lembretes deletados com sucesso!${failedCount > 0 ? `\n❌ ${failedCount} lembretes não puderam ser deletados.` : ''}`;
                    } else {
                        return "❌ Não foi possível deletar nenhum lembrete. Por favor, tente novamente.";
                    }
                }
                
                // If not deleting all, proceed with single reminder deletion
                const reminderToDelete = await this.extractReminderToDelete(message, userReminders);
                
                if (reminderToDelete) {
                    console.log('Found reminder to delete:', reminderToDelete);
                    console.log('Reminder ID:', reminderToDelete._id);
                    
                    try {
                        const deleted = await deleteReminder(reminderToDelete._id.toString());
                        console.log('Delete operation result:', deleted);
                        
                        if (deleted) {
                            return `✅ Lembrete deletado com sucesso:\n📝 ${reminderToDelete.text}\n⏰ ${reminderToDelete.time}\n📅 ${new Date(reminderToDelete.date).toLocaleDateString('pt-BR')}`;
                        } else {
                            return "❌ Não foi possível deletar o lembrete. Por favor, tente novamente.";
                        }
                    } catch (deleteError) {
                        console.error('Error deleting reminder:', deleteError);
                        return "❌ Erro ao deletar o lembrete. Por favor, tente novamente.";
                    }
                } else {
                    return "❌ Não consegui identificar qual lembrete você quer deletar. Por favor, seja mais específico ou forneça mais detalhes sobre o lembrete que deseja deletar.";
                }
            }

            return response;
        } catch (error) {
            console.error('Error processing message:', error);
            return "Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.";
        }
    }

    private async extractReminderDetails(message: string): Promise<any> {
        try {
            console.log('Extracting reminder details from message:', message);
            
            const completion = await openai.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: `Extraia detalhes do lembrete do texto e retorne em formato JSON com os seguintes campos:
                        {
                            "text": "descrição do lembrete",
                            "date": "YYYY-MM-DD",
                            "time": "HH:mm",
                            "frequency": "once|daily|weekly|monthly"
                        }
                        
                        Se não houver horário específico, use "08:00" como padrão.
                        Se não houver data específica, use a data de hoje.
                        Se não houver frequência específica, use "once" como padrão.
                        
                        Exemplos:
                        "me lembre de tomar remédio às 10h" ->
                        {
                            "text": "tomar remédio",
                            "date": "2024-04-10",
                            "time": "10:00",
                            "frequency": "once"
                        }
                        
                        "me lembre de tomar água todos os dias" ->
                        {
                            "text": "tomar água",
                            "date": "2024-04-10",
                            "time": "08:00",
                            "frequency": "daily"
                        }`
                    },
                    { role: "user", content: message }
                ],
                model: "gpt-3.5-turbo",
                temperature: 0.1,
                max_tokens: 150
            });

            const response = completion.choices[0].message.content;
            console.log('OpenAI response for reminder details:', response);

            if (response) {
                try {
                    const reminderData = JSON.parse(response);
                    console.log('Parsed reminder data:', reminderData);
                    
                    // Validate required fields
                    if (!reminderData.text || !reminderData.date || !reminderData.time || !reminderData.frequency) {
                        console.error('Missing required fields in reminder data');
                        return null;
                    }
                    
                    // Convert date string to Date object
                    reminderData.date = new Date(reminderData.date);
                    
                    return reminderData;
                } catch (parseError) {
                    console.error('Error parsing reminder data:', parseError);
                    return null;
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting reminder details:', error);
            return null;
        }
    }

    private async extractReminderToDelete(message: string, reminders: any[]): Promise<any> {
        try {
            console.log('Extracting reminder to delete from message:', message);
            console.log('Available reminders:', reminders);

            if (reminders.length === 0) {
                console.log('No reminders available to delete');
                return null;
            }

            // Clean up the message for better matching
            const cleanMessage = message.toLowerCase()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
                .replace(/\s+/g, ' ') // Normalize spaces
                .trim();

            console.log('Cleaned message:', cleanMessage);

            // Check for "delete all" or similar commands
            if (cleanMessage.includes('todos') || cleanMessage.includes('tudo') || cleanMessage.includes('all')) {
                console.log('User wants to delete all reminders');
                return reminders[0]; // Return first reminder as a trigger to delete all
            }

            // First try to find by direct text match with fuzzy matching
            const directMatch = reminders.find(r => {
                const cleanReminderText = r.text.toLowerCase()
                    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // Check if either text contains the other (allowing for typos)
                return cleanMessage.includes(cleanReminderText) || 
                       cleanReminderText.includes(cleanMessage) ||
                       // Check for similar words (handling typos)
                       cleanMessage.split(' ').some(word => 
                           cleanReminderText.split(' ').some((reminderWord: string) => 
                               reminderWord.includes(word) || word.includes(reminderWord)
                           )
                       );
            });

            if (directMatch) {
                console.log('Found direct text match:', directMatch);
                return directMatch;
            }

            // If no direct match, use OpenAI to help identify the reminder
            const completion = await openai.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: `Você é um assistente especializado em identificar lembretes.
                        Analise a mensagem do usuário e os lembretes disponíveis.
                        Retorne o ID do lembrete que mais se aproxima do que o usuário quer deletar.
                        Se não encontrar nenhum lembrete relacionado, retorne "none".
                        
                        Lembretes disponíveis:
                        ${reminders.map(r => `ID: ${r._id} | Texto: ${r.text} | Data: ${new Date(r.date).toLocaleDateString('pt-BR')} ${r.time}`).join('\n')}` 
                    },
                    { role: "user", content: message }
                ],
                model: "gpt-3.5-turbo",
                temperature: 0.1,
                max_tokens: 50
            });

            const response = completion.choices[0].message.content;
            console.log('OpenAI response for deletion:', response);

            if (response && response.toLowerCase() !== 'none') {
                const reminderId = response.trim();
                console.log('Extracted reminder ID:', reminderId);
                
                // Try to find the reminder by ID
                const reminder = reminders.find(r => r._id.toString() === reminderId);
                console.log('Found reminder by ID:', reminder);
                
                return reminder || null;
            }

            return null;
        } catch (error) {
            console.error('Error extracting reminder to delete:', error);
            return null;
        }
    }

    clearHistory() {
        this.conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];
    }
}

export async function analyzeReminderData(reminderData: any): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analise estes dados de lembrete e sugira melhorias: ${JSON.stringify(reminderData)}` }
      ],
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      max_tokens: 50,
      presence_penalty: 0,
      frequency_penalty: 0
    });

    return completion.choices[0].message.content || "Não tenho sugestões para este lembrete.";
  } catch (error) {
    console.error('Error analyzing reminder data:', error);
    return "Não consegui analisar os dados do lembrete.";
  }
}

export async function analyzeMessage(message: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that analyzes messages and provides insights."
        },
        {
          role: "user",
          content: message
        }
      ],
      model: "gpt-3.5-turbo",
    });

    return completion.choices[0]?.message?.content || "No response generated";
  } catch (error) {
    console.error('Error in OpenAI service:', error);
    throw error;
  }
}

export async function generateResponse(message: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ],
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      max_tokens: 100,
      presence_penalty: 0,
      frequency_penalty: 0
    });

    return completion.choices[0].message.content || "Desculpe, não consegui gerar uma resposta.";
  } catch (error) {
    console.error('Error generating response:', error);
    return "Desculpe, tive um problema ao gerar uma resposta. Por favor, tente novamente.";
  }
} 
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
                    `- ${r.text} (${r.date.toLocaleDateString('pt-BR')} às ${r.time})`
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
            if (response.includes("criar lembrete") || response.includes("vou criar") || response.includes("lembrete criado")) {
                // Extract reminder details from the conversation
                const reminderData = await this.extractReminderDetails(message);
                if (reminderData) {
                    await createReminder({
                        userId: this.userId,
                        text: reminderData.text,
                        date: reminderData.date,
                        time: reminderData.time,
                        frequency: reminderData.frequency
                    });
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
            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: "Extraia detalhes de data, hora e descrição do lembrete do texto. Retorne em formato JSON." },
                    { role: "user", content: message }
                ],
                model: "gpt-3.5-turbo",
                temperature: 0.1,
                max_tokens: 100
            });

            const response = completion.choices[0].message.content;
            if (response) {
                return JSON.parse(response);
            }
            return null;
        } catch (error) {
            console.error('Error extracting reminder details:', error);
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
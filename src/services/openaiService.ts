import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `Você é um assistente especializado em criar e gerenciar lembretes. 
Sua função é ajudar os usuários a criar lembretes de forma natural e amigável.
Você deve:
1. Extrair informações de data, hora e descrição do lembrete
2. Confirmar os detalhes do lembrete de forma amigável
3. Sugerir melhorias se necessário
4. Manter o foco em lembretes, redirecionando conversas fora do tema

Formato de resposta:
- Sempre confirme os detalhes do lembrete
- Use emojis para tornar a conversa mais amigável
- Mantenha um tom profissional mas acolhedor
- Seja conciso e direto`;

export async function processMessage(message: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ],
      model: "gpt-3.5-turbo",
      temperature: 0.7,
      max_tokens: 150
    });

    return completion.choices[0].message.content || "Desculpe, não consegui processar sua mensagem.";
  } catch (error) {
    console.error('Error processing message with OpenAI:', error);
    return "Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.";
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
      temperature: 0.5,
      max_tokens: 100
    });

    return completion.choices[0].message.content || "Não tenho sugestões para este lembrete.";
  } catch (error) {
    console.error('Error analyzing reminder data:', error);
    return "Não consegui analisar os dados do lembrete.";
  }
} 
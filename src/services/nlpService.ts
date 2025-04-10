interface ReminderData {
  text: string;
  date: Date | null;
  time: string | null;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
}

export const parseMessage = (message: string): ReminderData | null => {
  try {
    message = message.toLowerCase();
    
    // Default values
    let result: ReminderData = {
      text: '',
      date: null,
      time: null,
      frequency: 'once'
    };
    
    // Extract frequency
    if (message.includes('todos os dias') || message.includes('diariamente') || message.includes('todo dia')) {
      result.frequency = 'daily';
    } else if (message.includes('toda semana') || message.includes('semanalmente')) {
      result.frequency = 'weekly';
    } else if (message.includes('todo mês') || message.includes('mensalmente')) {
      result.frequency = 'monthly';
    }
    
    // Extract date - look for patterns like "dia X", "X de Y", etc.
    const datePatterns = [
      /dia (\d{1,2}) de ([a-z]+)/i,
      /(\d{1,2}) de ([a-z]+)/i,
      /hoje/i,
      /amanhã/i,
      /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i
    ];
    
    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        const date = parseExtractedDate(match);
        if (date) {
          result.date = date;
          break;
        }
      }
    }
    
    // Extract time
    const timePattern = /(\d{1,2})[:\.]?(\d{2})?\s*(am|pm|da manhã|da tarde|da noite|horas?)?/i;
    const timeMatch = message.match(timePattern);
    
    if (timeMatch) {
      result.time = extractTime(timeMatch);
    }
    
    // Extract the actual reminder text (everything else)
    result.text = cleanupReminderText(message, result);
    
    // Only return if we have at least some information
    if (result.text && (result.date || result.frequency === 'daily')) {
      // For daily reminders, set date to today if not specified
      if (!result.date && result.frequency === 'daily') {
        result.date = new Date();
      }
      
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing message:', error);
    return null;
  }
};

function parseExtractedDate(match: RegExpMatchArray): Date | null {
  try {
    const today = new Date();
    
    // Handle the case for "hoje"
    if (match[0].toLowerCase() === 'hoje') {
      return today;
    }
    
    // Handle the case for "amanhã"
    if (match[0].toLowerCase() === 'amanhã') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow;
    }
    
    // Handle cases like "12/05" or "12/05/2023"
    if (match[0].includes('/')) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // JavaScript months are 0-indexed
      
      let year = today.getFullYear();
      if (match[3]) {
        year = parseInt(match[3]);
        // Handle two-digit years
        if (year < 100) {
          year += 2000;
        }
      }
      
      const date = new Date(year, month, day);
      return date;
    }
    
    // Handle cases like "dia 12 de maio"
    const day = parseInt(match[1]);
    const monthText = match[2].toLowerCase();
    const monthMap: {[key: string]: number} = {
      'janeiro': 0, 'jan': 0,
      'fevereiro': 1, 'fev': 1,
      'março': 2, 'mar': 2,
      'abril': 3, 'abr': 3,
      'maio': 4, 'mai': 4,
      'junho': 5, 'jun': 5,
      'julho': 6, 'jul': 6,
      'agosto': 7, 'ago': 7,
      'setembro': 8, 'set': 8,
      'outubro': 9, 'out': 9,
      'novembro': 10, 'nov': 10,
      'dezembro': 11, 'dez': 11
    };
    
    if (monthMap[monthText] !== undefined) {
      const month = monthMap[monthText];
      const year = today.getFullYear();
      return new Date(year, month, day);
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

function extractTime(match: RegExpMatchArray): string {
  let hour = parseInt(match[1]);
  const minutes = match[2] ? match[2] : '00';
  const period = match[3] ? match[3].toLowerCase() : null;
  
  // Handle AM/PM and Portuguese time references
  if (period) {
    if (period === 'pm' || period.includes('tarde') || period.includes('noite')) {
      if (hour < 12) hour += 12;
    } else if (period === 'am' || period.includes('manhã')) {
      if (hour === 12) hour = 0;
    }
  }
  
  // Format the time as HH:MM
  return `${hour.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

function cleanupReminderText(message: string, reminderData: ReminderData): string {
  // Remove date and time information from the message
  let text = message;
  
  // List of phrases to remove
  const phrasesToRemove = [
    'me lembre',
    'me avise',
    'não esqueça',
    'lembrar de',
    'todos os dias',
    'diariamente',
    'todo dia',
    'toda semana',
    'semanalmente',
    'todo mês',
    'mensalmente'
  ];
  
  // Remove phrases
  for (const phrase of phrasesToRemove) {
    text = text.replace(new RegExp(phrase, 'gi'), '');
  }
  
  // Remove date references
  if (reminderData.date) {
    text = text.replace(/dia \d{1,2} de [a-z]+/gi, '');
    text = text.replace(/\d{1,2} de [a-z]+/gi, '');
    text = text.replace(/hoje/gi, '');
    text = text.replace(/amanhã/gi, '');
    text = text.replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/gi, '');
  }
  
  // Remove time references
  if (reminderData.time) {
    text = text.replace(/às \d{1,2}[:.]\d{2}/gi, '');
    text = text.replace(/as \d{1,2}[:.]\d{2}/gi, '');
    text = text.replace(/\d{1,2}[:.]\d{2}/gi, '');
    text = text.replace(/\d{1,2} horas/gi, '');
    text = text.replace(/às \d{1,2}/gi, '');
    text = text.replace(/as \d{1,2}/gi, '');
  }
  
  // Clean up extra spaces and punctuation
  text = text.replace(/\s{2,}/g, ' ').trim();
  
  return text;
} 
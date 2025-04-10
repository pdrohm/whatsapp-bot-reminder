import WhatsAppService from './whatsappService';
import { getUserReminders, markReminderAsCompleted } from './reminderService';
import { format, addDays, subHours, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export class SchedulerService {
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL = 60000; // Check every minute

    constructor(private whatsAppService: WhatsAppService) {}

    public start() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(async () => {
            await this.checkReminders();
        }, this.CHECK_INTERVAL);

        console.log('Scheduler started');
    }

    public stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        console.log('Scheduler stopped');
    }

    private async checkReminders() {
        try {
            const now = new Date();
            
            // Get all active reminders
            const reminders = await getUserReminders('all'); // 'all' will get reminders for all users
            
            for (const reminder of reminders) {
                if (reminder.completed) continue;

                const reminderDate = new Date(reminder.date);
                const [hours, minutes] = reminder.time.split(':').map(Number);
                reminderDate.setHours(hours, minutes, 0, 0);

                // For daily reminders, check if it's time to notify
                if (reminder.frequency === 'daily') {
                    const currentTime = new Date();
                    currentTime.setHours(currentTime.getHours(), currentTime.getMinutes(), 0, 0);
                    
                    if (currentTime.getHours() === hours && currentTime.getMinutes() === minutes) {
                        await this.sendReminder(reminder);
                    }
                }
                // For one-time reminders
                else if (reminder.frequency === 'once') {
                    // Check if it's time to send the reminder
                    if (isBefore(now, reminderDate) && isAfter(now, subHours(reminderDate, 1))) {
                        await this.sendReminder(reminder);
                    }
                    
                    // Check if it's one day before
                    const oneDayBefore = subHours(reminderDate, 24);
                    if (isBefore(now, oneDayBefore) && isAfter(now, subHours(oneDayBefore, 1))) {
                        await this.sendReminder(reminder, true);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking reminders:', error);
        }
    }

    private async sendReminder(reminder: any, isAdvanceNotice: boolean = false) {
        try {
            const reminderDate = new Date(reminder.date);
            const [hours, minutes] = reminder.time.split(':').map(Number);
            reminderDate.setHours(hours, minutes, 0, 0);

            const formattedDate = format(reminderDate, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR });
            
            let message = '';
            if (isAdvanceNotice) {
                message = `🔔 *Lembrete para amanhã!*\n\n` +
                    `📝 *${reminder.text}*\n` +
                    `📆 ${formattedDate}\n\n` +
                    `Não se esqueça deste compromisso!`;
            } else {
                message = `🔔 *Lembrete!*\n\n` +
                    `📝 *${reminder.text}*\n` +
                    `📆 ${formattedDate}\n\n` +
                    `É hora de realizar esta tarefa!`;
            }

            await this.whatsAppService.sendMessage(reminder.userId, message);
            
            // If it's a one-time reminder and we're sending the final notification, mark it as completed
            if (!isAdvanceNotice && reminder.frequency === 'once') {
                await markReminderAsCompleted(reminder._id.toString());
            }
        } catch (error) {
            console.error('Error sending reminder:', error);
        }
    }
} 
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const reminderService_1 = require("./reminderService");
// Function to format reminder message
const formatReminderMessage = (reminder) => {
    const frequencyText = {
        'once': 'única vez',
        'daily': 'diariamente',
        'weekly': 'semanalmente',
        'monthly': 'mensalmente'
    }[reminder.frequency];
    return `🔔 *LEMBRETE*: ${reminder.text}\n` +
        `⏰ Horário: ${reminder.time}\n` +
        `🔄 Frequência: ${frequencyText}\n` +
        `�� ID: ${reminder._id.toString()}`;
};
// Function to format reminder notification message (day before)
const formatNotificationMessage = (reminder) => {
    return `⚠️ *LEMBRETE PARA AMANHÃ*: ${reminder.text}\n` +
        `⏰ Horário: ${reminder.time}\n` +
        `📆 Data: ${reminder.date.toLocaleDateString('pt-BR')}\n` +
        `🆔 ID: ${reminder._id.toString()}`;
};
// Check if a reminder should be sent now
const shouldSendReminder = (reminder) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    // Parse the reminder time
    const [reminderHour, reminderMinute] = reminder.time.split(':').map(Number);
    // For daily reminders, check only the time
    if (reminder.frequency === 'daily') {
        return currentHour === reminderHour &&
            currentMinute >= reminderMinute &&
            currentMinute < reminderMinute + 5;
    }
    // For other frequencies, check date and time
    const reminderDate = new Date(reminder.date);
    return reminderDate.getDate() === now.getDate() &&
        reminderDate.getMonth() === now.getMonth() &&
        reminderDate.getFullYear() === now.getFullYear() &&
        currentHour === reminderHour &&
        currentMinute >= reminderMinute &&
        currentMinute < reminderMinute + 5;
};
// Check if a reminder should be notified the day before
const shouldNotifyDayBefore = (reminder) => {
    // Only for non-daily reminders
    if (reminder.frequency === 'daily') {
        return false;
    }
    const now = new Date();
    const reminderDate = new Date(reminder.date);
    // Calculate the day before the reminder
    const dayBefore = new Date(reminderDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    // Check if today is the day before the reminder
    return dayBefore.getDate() === now.getDate() &&
        dayBefore.getMonth() === now.getMonth() &&
        dayBefore.getFullYear() === now.getFullYear();
};
// Initialize the scheduler
const initScheduler = (whatsAppClient) => {
    // Check for reminders every 5 minutes
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        try {
            const upcomingReminders = await (0, reminderService_1.getUpcomingReminders)();
            for (const reminder of upcomingReminders) {
                // Send reminders that should be sent now
                if (shouldSendReminder(reminder) && !reminder.notified) {
                    await whatsAppClient.sendMessage(reminder.userId, formatReminderMessage(reminder));
                    // For non-daily reminders, mark as notified after sending
                    if (reminder.frequency !== 'daily') {
                        await (0, reminderService_1.markReminderAsNotified)(reminder._id.toString());
                    }
                }
                // Send day-before notifications for important events
                if (shouldNotifyDayBefore(reminder) && !reminder.notified) {
                    await whatsAppClient.sendMessage(reminder.userId, formatNotificationMessage(reminder));
                }
            }
            console.log(`Scheduler ran at ${new Date().toLocaleString()}`);
        }
        catch (error) {
            console.error('Error in scheduler:', error);
        }
    });
    console.log('Scheduler initialized');
};
exports.initScheduler = initScheduler;

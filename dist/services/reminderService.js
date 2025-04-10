"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReminder = exports.getUpcomingReminders = exports.markReminderAsNotified = exports.markReminderAsCompleted = exports.getUserReminders = exports.createReminder = void 0;
const Reminder_1 = __importDefault(require("../models/Reminder"));
const createReminder = async (reminderData) => {
    try {
        const reminder = new Reminder_1.default(reminderData);
        await reminder.save();
        return reminder;
    }
    catch (error) {
        throw new Error(`Error creating reminder: ${error}`);
    }
};
exports.createReminder = createReminder;
const getUserReminders = async (userId) => {
    try {
        return await Reminder_1.default.find({ userId });
    }
    catch (error) {
        throw new Error(`Error fetching reminders: ${error}`);
    }
};
exports.getUserReminders = getUserReminders;
const markReminderAsCompleted = async (reminderId) => {
    try {
        return await Reminder_1.default.findByIdAndUpdate(reminderId, { completed: true }, { new: true });
    }
    catch (error) {
        throw new Error(`Error updating reminder: ${error}`);
    }
};
exports.markReminderAsCompleted = markReminderAsCompleted;
const markReminderAsNotified = async (reminderId) => {
    try {
        return await Reminder_1.default.findByIdAndUpdate(reminderId, { notified: true }, { new: true });
    }
    catch (error) {
        throw new Error(`Error updating reminder notification status: ${error}`);
    }
};
exports.markReminderAsNotified = markReminderAsNotified;
const getUpcomingReminders = async () => {
    try {
        const currentDate = new Date();
        // Get reminders for today or upcoming ones that haven't been notified
        return await Reminder_1.default.find({
            $or: [
                // Daily reminders
                { frequency: 'daily', notified: false },
                // One-time or other frequency reminders that are due soon
                {
                    frequency: { $in: ['once', 'weekly', 'monthly'] },
                    date: { $gte: currentDate, $lte: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000) },
                    notified: false,
                    completed: false
                }
            ]
        });
    }
    catch (error) {
        throw new Error(`Error fetching upcoming reminders: ${error}`);
    }
};
exports.getUpcomingReminders = getUpcomingReminders;
const deleteReminder = async (reminderId) => {
    try {
        const result = await Reminder_1.default.findByIdAndDelete(reminderId);
        return !!result;
    }
    catch (error) {
        throw new Error(`Error deleting reminder: ${error}`);
    }
};
exports.deleteReminder = deleteReminder;

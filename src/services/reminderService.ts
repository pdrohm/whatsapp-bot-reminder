import Reminder, { IReminder } from '../models/Reminder';
import mongoose from 'mongoose';

interface ReminderInput {
  userId: string;
  text: string;
  date: Date;
  time: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
}

export const createReminder = async (reminderData: ReminderInput): Promise<IReminder> => {
  try {
    const reminder = new Reminder(reminderData);
    await reminder.save();
    return reminder;
  } catch (error) {
    throw new Error(`Error creating reminder: ${error}`);
  }
};

export const getUserReminders = async (userId: string): Promise<IReminder[]> => {
  try {
    return await Reminder.find({ userId });
  } catch (error) {
    throw new Error(`Error fetching reminders: ${error}`);
  }
};

export const markReminderAsCompleted = async (reminderId: string): Promise<IReminder | null> => {
  try {
    return await Reminder.findByIdAndUpdate(
      reminderId,
      { completed: true },
      { new: true }
    );
  } catch (error) {
    throw new Error(`Error updating reminder: ${error}`);
  }
};

export const markReminderAsNotified = async (reminderId: string): Promise<IReminder | null> => {
  try {
    return await Reminder.findByIdAndUpdate(
      reminderId,
      { notified: true },
      { new: true }
    );
  } catch (error) {
    throw new Error(`Error updating reminder notification status: ${error}`);
  }
};

export const getUpcomingReminders = async (): Promise<IReminder[]> => {
  try {
    const currentDate = new Date();
    // Get reminders for today or upcoming ones that haven't been notified
    return await Reminder.find({
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
  } catch (error) {
    throw new Error(`Error fetching upcoming reminders: ${error}`);
  }
};

export const deleteReminder = async (reminderId: string): Promise<boolean> => {
  try {
    console.log('Attempting to delete reminder with ID:', reminderId);
    
    // Convert string ID to MongoDB ObjectId
    const objectId = new mongoose.Types.ObjectId(reminderId);
    console.log('Converted to ObjectId:', objectId);
    
    const result = await Reminder.deleteOne({ _id: objectId });
    console.log('Delete result:', result);
    
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error in deleteReminder:', error);
    throw new Error(`Error deleting reminder: ${error}`);
  }
}; 
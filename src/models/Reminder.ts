import mongoose, { Document, Schema } from 'mongoose';

export interface IReminder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  text: string;
  date: Date;
  time: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  notified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    userId: { type: String, required: true, index: true },
    text: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    frequency: { 
      type: String, 
      enum: ['once', 'daily', 'weekly', 'monthly'],
      default: 'once' 
    },
    completed: { type: Boolean, default: false },
    notified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IReminder>('Reminder', ReminderSchema); 
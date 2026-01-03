import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async saveMessage(senderId: string, content: string, receiverId?: string, groupId?: string, type: string = 'text'): Promise<Message> {
    const newMessage = new this.messageModel({
      senderId,
      receiverId,
      groupId,
      content,
      type,
    });
    return newMessage.save();
  }

  async getMessagesBetween(user1: string, user2: string, limit: number = 50): Promise<Message[]> {
    return this.messageModel
      .find({
        $or: [
          { senderId: user1, receiverId: user2 },
          { senderId: user2, receiverId: user1 },
        ],
      })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }

  async getGroupMessages(groupId: string, limit: number = 50): Promise<Message[]> {
    return this.messageModel
      .find({ groupId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .exec();
  }

  async markAsRead(senderId: string, receiverId: string): Promise<any> {
    return this.messageModel.updateMany(
      { senderId, receiverId, isRead: false },
      { $set: { isRead: true } },
    ).exec();
  }
}


import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { GroupService } from '../groups/group.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');
  private onlineUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(
    private readonly chatService: ChatService,
    private readonly groupService: GroupService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // 移除在线状态
    for (const [userId, socketId] of this.onlineUsers.entries()) {
      if (socketId === client.id) {
        this.onlineUsers.delete(userId);
        this.broadcastOnlineUsers();
        break;
      }
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    client.join(userId);
    this.onlineUsers.set(userId, client.id);
    this.logger.log(`User ${userId} joined room ${userId}`);
    this.broadcastOnlineUsers();
  }

  private broadcastOnlineUsers() {
    this.server.emit('onlineUsers', Array.from(this.onlineUsers.keys()));
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: { senderId: string; content: string; receiverId?: string; groupId?: string; type?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Message from ${data.senderId}: ${data.content}`);
    
    // 检查禁言
    if (data.groupId) {
      const group = await this.groupService.getGroupById(data.groupId);
      if (group && group.mutedMembers.map(id => id.toString()).includes(data.senderId)) {
        client.emit('error', { message: '你已被该群组禁言' });
        return;
      }
    }
    
    // 1. 持久化到数据库
    const savedMessage = await this.chatService.saveMessage(
      data.senderId,
      data.content,
      data.receiverId,
      data.groupId,
      data.type,
    );

    const messagePayload = {
      id: (savedMessage as any)._id,
      senderId: data.senderId,
      receiverId: data.receiverId,
      groupId: data.groupId,
      content: data.content,
      type: data.type || 'text',
      timestamp: (savedMessage as any).createdAt,
    };

    if (data.groupId) {
      // 2a. 群聊：广播给房间内所有人
      this.server.to(data.groupId).emit('receiveMessage', messagePayload);
    } else if (data.receiverId) {
      // 2b. 单聊：定向发送给接收者和发送者
      this.server.to(data.receiverId).emit('receiveMessage', messagePayload);
      this.server.to(data.senderId).emit('receiveMessage', messagePayload);
    }
  }

  @SubscribeMessage('getHistory')
  async handleGetHistory(
    @MessageBody() data: { user1?: string; user2?: string; groupId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data.groupId) {
      const history = await this.chatService.getGroupMessages(data.groupId);
      client.emit('history', history);
    } else if (data.user1 && data.user2) {
      const history = await this.chatService.getMessagesBetween(data.user1, data.user2);
      client.emit('history', history);
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { senderId: string; receiverId: string },
    @ConnectedSocket() client: Socket,
  ) {
    await this.chatService.markAsRead(data.senderId, data.receiverId);
    // 通知原发送者，消息已被读
    this.server.to(data.senderId).emit('messagesRead', {
      readBy: data.receiverId,
    });
  }
}

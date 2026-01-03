import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './useAuthStore';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: Date;
  senderId?: string;
  type?: string;
  isRead?: boolean;
}

interface ChatState {
  messages: Message[];
  socket: Socket | null;
  onlineUsers: string[];
  connect: () => void;
  disconnect: () => void;
  sendMessage: (text: string, targetId: string, type?: string, isGroup?: boolean) => void;
  loadHistory: (targetId: string, isGroup?: boolean) => void;
  markAsRead: (senderId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  socket: null,
  onlineUsers: [],

  connect: () => {
    const { token, user } = useAuthStore.getState();
    if (!token || !user) return;

    const socket = io('http://localhost:3000', {
      auth: { token },
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      // 加入自己的房间以接收消息
      socket.emit('joinRoom', user.id);
    });

    socket.on('onlineUsers', (users: string[]) => {
      set({ onlineUsers: users });
    });

    socket.on('receiveMessage', (data: any) => {
      const currentUser = useAuthStore.getState().user;
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: data.id,
            text: data.content,
            sender: data.senderId === currentUser?.id ? 'me' : 'other',
            timestamp: new Date(data.timestamp),
            senderId: data.senderId,
            type: data.type,
            isRead: data.isRead || false,
          }
        ]
      }));
    });

    socket.on('messagesRead', () => {
      set((state) => ({
        messages: state.messages.map(msg => 
          msg.sender === 'me' ? { ...msg, isRead: true } : msg
        )
      }));
    });

    socket.on('error', (data: { message: string }) => {
      alert(data.message);
    });

    socket.on('history', (history: any[]) => {
      const currentUser = useAuthStore.getState().user;
      const formattedHistory: Message[] = history.map((msg) => ({
        id: msg._id,
        text: msg.content,
        sender: msg.senderId === currentUser?.id ? 'me' : 'other',
        timestamp: new Date(msg.createdAt),
        senderId: msg.senderId,
        type: msg.type,
        isRead: msg.isRead || false,
      }));
      set({ messages: formattedHistory });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  sendMessage: (content, targetId, type = 'text', isGroup = false) => {
    const { socket } = get();
    const { user } = useAuthStore.getState();
    if (socket && user) {
      socket.emit('sendMessage', {
        senderId: user.id,
        content,
        type,
        isRead: false,
        ...(isGroup ? { groupId: targetId } : { receiverId: targetId }),
      });
    }
  },

  loadHistory: (targetId, isGroup = false) => {
    const { socket } = get();
    const { user } = useAuthStore.getState();
    if (socket && user) {
      socket.emit('getHistory', isGroup ? { groupId: targetId } : { user1: user.id, user2: targetId });
    }
  },

  markAsRead: (senderId) => {
    const { socket } = get();
    const { user } = useAuthStore.getState();
    if (socket && user) {
      socket.emit('markAsRead', {
        senderId,
        receiverId: user.id,
      });
    }
  }
}));

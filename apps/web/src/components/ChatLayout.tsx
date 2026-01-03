import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User as UserIcon, Search, MoreVertical, Smile, Paperclip, LogOut, ChevronLeft, CheckCheck, Plus, X } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import axios from 'axios';
import { Dialog, Transition } from '@headlessui/react';

interface ChatItem {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  avatar?: string;
  isGroup?: boolean;
}

interface GroupDetails {
  _id: string;
  name: string;
  admin: string;
  members: { _id: string; username: string; email: string; avatar?: string }[];
  mutedMembers: string[];
}

export const ChatLayout: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [contacts, setContacts] = useState<ChatItem[]>([]);
  const [groups, setGroups] = useState<ChatItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ChatItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  
  const { messages, sendMessage, connect, disconnect, loadHistory, onlineUsers, markAsRead } = useChatStore();
  const { user: currentUser, token, logout } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isOnline = (userId: string) => onlineUsers.includes(userId);

  const fetchContacts = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:3000/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // 过滤掉自己
      setContacts(response.data.filter((u: ChatItem) => u.id !== currentUser?.id));
    } catch (err) {
      console.error('Failed to fetch contacts', err);
    }
  }, [token, currentUser?.id]);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:3000/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(response.data.map((g: { _id: string; name: string, admin: string, mutedMembers: string[] }) => ({ ...g, id: g._id, isGroup: true })));
    } catch (err) {
      console.error('Failed to fetch groups', err);
    }
  }, [token]);

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const response = await axios.get(`http://localhost:3000/groups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroupDetails(response.data);
    } catch (err) {
      console.error('Failed to fetch group details', err);
    }
  };

  const handleMute = async (memberId: string, mute: boolean) => {
    if (!selectedItem) return;
    try {
      await axios.post(`http://localhost:3000/groups/${selectedItem.id}/${mute ? 'mute' : 'unmute'}`, {
        memberId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroupDetails(selectedItem.id);
    } catch {
      alert('操作失败');
    }
  };

  const handleDissolve = async () => {
    if (!selectedItem || !window.confirm('确定要解散该群组吗？')) return;
    try {
      await axios.post(`http://localhost:3000/groups/${selectedItem.id}/dissolve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedItem(null);
      setIsGroupInfoOpen(false);
      fetchGroups();
    } catch {
      alert('操作失败');
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    connect();
    fetchContacts();
    fetchGroups();
    return () => disconnect();
  }, [token, connect, disconnect, navigate, fetchContacts, fetchGroups]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // 如果当前选中的是单聊，且有新消息进来，标记为已读
    if (selectedItem && !selectedItem.isGroup && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'other') {
        markAsRead(selectedItem.id);
      }
    }
  }, [messages, selectedItem, markAsRead]);

  const handleSelectItem = (item: ChatItem) => {
    setSelectedItem(item);
    loadHistory(item.id, item.isGroup);
    if (!item.isGroup) {
      markAsRead(item.id);
    }
    if (item.isGroup && token) {
      // 加入 Socket 房间以接收群聊消息
      useChatStore.getState().socket?.emit('joinRoom', item.id);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && selectedItem) {
      sendMessage(inputText, selectedItem.id, 'text', selectedItem.isGroup);
      setInputText('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0) return;
    try {
      await axios.post('http://localhost:3000/groups', {
        name: newGroupName,
        members: selectedMembers,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsGroupModalOpen(false);
      setNewGroupName('');
      setSelectedMembers([]);
      fetchGroups();
    } catch (err) {
      console.error('Failed to create group', err);
      alert('创建群组失败');
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId) 
        : [...prev, memberId]
    );
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedItem && token) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post('http://localhost:3000/upload/file', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        });
        sendMessage(response.data.url, selectedItem.id, 'image');
      } catch (err) {
        console.error('Failed to upload file', err);
        alert('文件上传失败');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex h-screen bg-whatsapp-header overflow-hidden">
      {/* Create Group Modal */}
      <Transition show={isGroupModalOpen} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsGroupModalOpen(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center">
                    创建新群组
                    <button onClick={() => setIsGroupModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </Dialog.Title>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">群组名称</label>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-whatsapp-teal outline-none"
                        placeholder="输入群组名称..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">选择成员</label>
                      <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                        {contacts.map(contact => (
                          <div 
                            key={contact.id}
                            onClick={() => toggleMember(contact.id)}
                            className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 transition ${selectedMembers.includes(contact.id) ? 'bg-blue-50' : ''}`}
                          >
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <UserIcon className="text-blue-500 w-4 h-4" />
                            </div>
                            <span className="flex-1 text-sm text-gray-700">{contact.username}</span>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedMembers.includes(contact.id) ? 'bg-whatsapp-teal border-whatsapp-teal' : 'border-gray-300'}`}>
                              {selectedMembers.includes(contact.id) && <CheckCheck className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                      onClick={() => setIsGroupModalOpen(false)}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={!newGroupName.trim() || selectedMembers.length === 0}
                      className="px-4 py-2 bg-whatsapp-teal text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
                      onClick={handleCreateGroup}
                    >
                      立即创建
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Group Info Modal */}
      <Transition show={isGroupInfoOpen} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsGroupInfoOpen(false)}>
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/25" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center mb-4">
                    群组信息
                    <button onClick={() => setIsGroupInfoOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </Dialog.Title>
                  
                  {groupDetails && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">群名</p>
                        <p className="font-medium">{groupDetails.name}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-500 mb-2">成员 ({groupDetails.members.length})</p>
                        <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                          {groupDetails.members.map((member) => (
                            <div key={member._id} className="flex items-center p-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                <UserIcon className="text-blue-500 w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{member.username}</p>
                                {groupDetails.admin === member._id && <span className="text-[10px] bg-teal-100 text-teal-600 px-1.5 rounded">群主</span>}
                                {groupDetails.mutedMembers.includes(member._id) && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded ml-1">已禁言</span>}
                              </div>
                              
                              {/* Admin Actions */}
                              {currentUser?.id === groupDetails.admin && member._id !== currentUser?.id && (
                                <button 
                                  onClick={() => handleMute(member._id, !groupDetails.mutedMembers.includes(member._id))}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  {groupDetails.mutedMembers.includes(member._id) ? '解禁' : '禁言'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {currentUser?.id === groupDetails.admin && (
                        <button 
                          onClick={handleDissolve}
                          className="w-full py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition"
                        >
                          解散群组
                        </button>
                      )}
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Sidebar */}
      <div className={`w-full md:w-[400px] bg-whatsapp-sidebar border-r flex flex-col ${selectedItem !== null ? 'hidden md:flex' : 'flex'}`}>
        <div className="h-[60px] p-3 bg-whatsapp-header flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <UserIcon className="text-gray-500" />
            </div>
            <span className="font-medium text-gray-700">{currentUser?.username}</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-500">
            <button 
              onClick={() => setIsGroupModalOpen(true)}
              title="创建群组" 
              className="p-2 hover:bg-gray-200 rounded-full transition"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} title="退出" className="p-2 hover:bg-gray-200 rounded-full transition">
              <LogOut className="w-5 h-5" />
            </button>
            <MoreVertical className="w-5 h-5 cursor-pointer" />
          </div>
        </div>
        
        <div className="p-2 bg-white text-sm">
          <div className="relative flex items-center bg-whatsapp-header rounded-lg px-3 py-1.5 text-gray-500">
            <Search className="w-4 h-4 mr-4" />
            <input type="text" placeholder="查找或开始新对话" className="w-full bg-transparent focus:outline-none" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          <div className="p-3 text-xs font-semibold text-whatsapp-teal uppercase tracking-wider bg-gray-50">联系人</div>
          {contacts.map((contact) => (
            <div 
              key={contact.id} 
              onClick={() => handleSelectItem(contact)}
              className={`flex items-center h-[72px] px-3 cursor-pointer border-b border-gray-100 hover:bg-whatsapp-active transition-colors ${selectedItem?.id === contact.id ? 'bg-whatsapp-active' : ''}`}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full shrink-0 flex items-center justify-center mr-3 relative">
                <UserIcon className="text-blue-500" />
                {isOnline(contact.id) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium text-[16px] text-gray-900 truncate">{contact.username}</span>
                  <span className="text-[12px] text-gray-500">12:30</span>
                </div>
                <p className="text-[13px] text-gray-500 truncate">{contact.email}</p>
              </div>
            </div>
          ))}

          <div className="p-3 text-xs font-semibold text-whatsapp-teal uppercase tracking-wider bg-gray-50 mt-2">群聊</div>
          {groups.map((group) => (
            <div 
              key={group.id} 
              onClick={() => handleSelectItem(group)}
              className={`flex items-center h-[72px] px-3 cursor-pointer border-b border-gray-100 hover:bg-whatsapp-active transition-colors ${selectedItem?.id === group.id ? 'bg-whatsapp-active' : ''}`}
            >
              <div className="w-12 h-12 bg-green-100 rounded-full shrink-0 flex items-center justify-center mr-3 relative text-green-600 font-bold">
                {group.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium text-[16px] text-gray-900 truncate">{group.name}</span>
                  <span className="text-[12px] text-gray-500">12:30</span>
                </div>
                <p className="text-[13px] text-gray-500 truncate">点击进入群聊</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col relative ${selectedItem === null ? 'hidden md:flex' : 'flex'} bg-whatsapp-background`}>
        {selectedItem ? (
          <>
            <div className="h-[60px] p-3 bg-whatsapp-header border-l flex justify-between items-center z-10">
              <div className="flex items-center">
                <button onClick={() => setSelectedItem(null)} className="md:hidden mr-2 p-1 hover:bg-gray-200 rounded-full">
                  <ChevronLeft className="w-6 h-6 text-gray-600" />
                </button>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <UserIcon className="text-blue-500 w-6 h-6" />
                </div>
                <div className="cursor-pointer" onClick={() => {
                  if (selectedItem.isGroup) {
                    fetchGroupDetails(selectedItem.id);
                    setIsGroupInfoOpen(true);
                  }
                }}>
                  <h2 className="font-medium text-gray-900 leading-tight text-[16px]">{selectedItem.username || selectedItem.name}</h2>
                  {!selectedItem.isGroup && (
                    <span className={`text-[12px] font-medium ${isOnline(selectedItem.id) ? 'text-green-500' : 'text-gray-400'}`}>
                      {isOnline(selectedItem.id) ? '在线' : '离线'}
                    </span>
                  )}
                  {selectedItem.isGroup && (
                    <span className="text-[12px] text-gray-500">点击查看群组信息</span>
                  )}
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:px-[6%] space-y-2 relative" style={{backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundBlendMode: 'overlay', backgroundColor: '#efeae2'}}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`relative px-3 py-1.5 rounded-lg shadow-sm text-[14.2px] max-w-[85%] md:max-w-[65%] ${msg.sender === 'me' ? 'bg-whatsapp-outgoing' : 'bg-whatsapp-incoming'}`}>
                    {msg.type === 'image' ? (
                      <img src={msg.text} alt="Shared" className="rounded-lg max-w-full h-auto mb-1 cursor-pointer hover:opacity-90" onClick={() => window.open(msg.text, '_blank')} />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                    <div className="flex items-center justify-end space-x-1 mt-1 -mr-1">
                      <span className="text-[10px] text-gray-500 uppercase">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {msg.sender === 'me' && (
                        <CheckCheck className={`w-4 h-4 ${msg.isRead ? 'text-blue-400' : 'text-gray-400'}`} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="min-h-[62px] px-3 py-2 bg-whatsapp-header flex items-end space-x-2">
              <div className="flex items-center h-[42px] space-x-1">
                <button className="p-2 text-gray-500 hover:text-gray-600 transition"><Smile className="w-6 h-6" /></button>
                <button 
                  onClick={handleImageClick}
                  disabled={isUploading}
                  className="p-2 text-gray-500 hover:text-gray-600 transition disabled:opacity-50"
                >
                  <Paperclip className="w-6 h-6" />
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*" 
                  />
                </button>
              </div>
              <div className="flex-1 min-h-[42px] bg-white rounded-lg flex items-center px-3">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend(e)}
                  placeholder="输入消息" 
                  className="w-full bg-transparent border-none focus:outline-none text-[15px] py-2"
                />
              </div>
              <div className="flex items-center h-[42px]">
                <button onClick={handleSend} disabled={!inputText.trim()} className="p-2 text-whatsapp-teal hover:scale-110 transition disabled:text-gray-400">
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#f8f9fa] border-b-[6px] border-whatsapp-teal text-center p-8">
            <h1 className="text-3xl font-light text-gray-600 mb-4">WhatsApp Web</h1>
            <p className="text-sm text-gray-500 leading-relaxed max-w-md">选择一个联系人开始聊天。</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ... existing code ...

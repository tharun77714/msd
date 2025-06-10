"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Send, Loader2, XCircle, UserCircle, Briefcase, Image as ImageIcon, Link as LinkIcon, Maximize2, Minimize2 } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import supabase from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

export function ChatSidebar() {
  const {
    isChatOpen,
    toggleChat,
    closeChat,
    toggleMaximizeChat,
    isChatMaximized,
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    isLoadingConversations,
    isLoadingMessages,
    activeConversationTargetProfile,
    fetchConversations,
  } = useChat();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    await sendMessage(newMessage.trim(), 'text'); // ✅ Explicitly send as text
    setNewMessage('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('chat-images').upload(fileName, file);
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      const publicUrl = publicUrlData?.publicUrl;
      if (publicUrl) {
        await sendMessage(publicUrl, 'image'); // ✅ Send as image
      }
    } catch (err) {
      toast({ 
        title: "Upload Error", 
        description: "Failed to upload image. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageUploadDirect = async (file: File) => {
    setImageUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('chat-images').upload(fileName, file);
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      const publicUrl = publicUrlData?.publicUrl;
      if (publicUrl) {
        await sendMessage(publicUrl, 'image');
      }
    } catch (err) {
      toast({
        title: "Upload Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setImageUploading(false);
    }
  };

  const getParticipantName = (participant: any) => {
    if (!participant) return 'Unknown User';
    return participant.role === 'business' ? participant.business_name : participant.full_name;
  };

  const getInitials = (name?: string) => {
    return name?.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() || 'U';
  };

  if (!isChatOpen) return null;

  return (
    <Card className={`fixed right-0 top-16 bottom-0 h-[calc(100vh-4rem)] border-l shadow-xl bg-card z-40 flex flex-col ${isChatMaximized ? 'w-full md:w-full' : 'w-80 md:w-96'}`}>
      <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center">
          <MessageSquare className="mr-2 h-5 w-5 text-primary" />
          Sparkle Chats
        </CardTitle>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={toggleMaximizeChat} className="h-7 w-7">
            {isChatMaximized ? <Minimize2 className="h-5 w-5"/> : <Maximize2 className="h-5 w-5"/>}
            <span className="sr-only">{isChatMaximized ? 'Minimize chat' : 'Maximize chat'}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={closeChat} className="h-7 w-7">
            <XCircle className="h-5 w-5"/>
            <span className="sr-only">Close chat</span>
          </Button>
        </div>
      </CardHeader>

      {!activeConversationId ? (
        <CardContent className="p-0 flex-1">
          <div className="p-2 border-b">
            <Button variant="outline" size="sm" className="w-full" onClick={fetchConversations} disabled={isLoadingConversations}>
              {isLoadingConversations && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Refresh Conversations
            </Button>
          </div>
          {isLoadingConversations ? (
            <div className="p-4 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No active conversations. <br/> Start chatting with a business from their store page.
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {conversations.map((convo) => (
                  <Button
                    key={convo.id}
                    variant="ghost"
                    className={cn("w-full justify-start h-auto py-2 px-3 text-left relative", activeConversationId === convo.id && "bg-accent")}
                    onClick={() => setActiveConversationId(convo.id)}
                  >
                    <Avatar className="mr-3 h-9 w-9">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {getInitials(getParticipantName(convo.otherParticipant))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium truncate">{getParticipantName(convo.otherParticipant)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {convo.last_message_content || "No messages yet."}
                      </p>
                    </div>
                    <div className="flex flex-col items-end ml-2 self-start pt-1">
                      {convo.last_message_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNowStrict(new Date(convo.last_message_at), { addSuffix: true })}
                        </span>
                      )}
                      {convo.unread_count > 0 && (
                        <Badge variant="destructive" className="mt-1 px-1.5 py-0.5 text-xs h-auto leading-tight">
                          {convo.unread_count > 9 ? '9+' : convo.unread_count}
                        </Badge>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      ) : (
        <>
          <CardHeader className="p-3 border-b bg-secondary/30">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => setActiveConversationId(null)} className="mr-1 p-1 h-auto">
                &larr; <span className="ml-1">Back</span>
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {getInitials(getParticipantName(activeConversationTargetProfile))}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{getParticipantName(activeConversationTargetProfile)}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {activeConversationTargetProfile?.role === 'business' ? <Briefcase className="inline mr-1 h-3 w-3"/> : <UserCircle className="inline mr-1 h-3 w-3"/>}
                  {activeConversationTargetProfile?.role || 'User'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4">
              {isLoadingMessages ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-10">
                  No messages yet. Say hello!
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex items-end space-x-2 max-w-[85%]",
                        msg.sender_id === user?.id ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"
                      )}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-muted-foreground/20 text-muted-foreground">
                          {getInitials(msg.sender_id === user?.id ? undefined : getParticipantName(activeConversationTargetProfile))}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "p-2.5 rounded-lg text-sm shadow-sm",
                          msg.sender_id === user?.id
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-secondary text-secondary-foreground rounded-bl-none"
                        )}
                      >
                        {msg.image_url ? (
                          <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                            <img src={msg.image_url} alt="sent image" className="max-w-[200px] max-h-[200px] rounded-md" />
                          </a>
                        ) : msg.content?.match(/^https?:\/\//) ? (
                          <a href={msg.content} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline flex items-center">
                            <LinkIcon className="h-4 w-4 mr-1" />{msg.content}
                          </a>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <p className="text-xs opacity-70 mt-1 text-right">
                          {formatDistanceToNowStrict(new Date(msg.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-3 border-t">
            <form onSubmit={handleSendMessage}>
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    handleImageUploadDirect(file);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                className="flex items-center space-x-2 w-full bg-[#FFFFF5] p-2 rounded"
                style={{ border: '1px solid #eee' }}
              >
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  ref={imageInputRef}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUploadDirect(file);
                  }}
                />
                <Input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                  autoComplete="off"
                  style={{ background: 'transparent' }}
                />
                <Button type="submit" size="icon" className="btn-primary-sparkle">
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </form>
            {imageUploading && (
              <p className="text-xs text-muted-foreground mt-2 ml-2">Uploading image...</p>
            )}
          </CardFooter>
        </>
      )}
    </Card>
  );
}

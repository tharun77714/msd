"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import type { ConversationView, Message } from '@/types/chat';
import { useAuth, type Profile } from './AuthContext';
import { 
    getOrCreateConversationAction, 
    sendMessageAction, 
    listUserConversationsAction, 
    getMessagesForConversationAction,
    markMessagesAsReadAction
} from '@/lib/actions/chat-actions';
import { useToast } from '@/hooks/use-toast';
import supabase from '@/lib/supabaseClient'; // For realtime subscriptions

interface ChatContextType {
  isChatOpen: boolean;
  isChatMaximized: boolean;
  toggleChat: () => void;
  closeChat: () => void;
  toggleMaximizeChat: () => void;
  openChatWithUser: (targetUserId: string) => Promise<void>;
  activeConversationId: string | null;
  setActiveConversationId: (conversationId: string | null) => void;
  conversations: ConversationView[];
  messages: Message[];
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  sendMessage: (content: string, type?: 'text' | 'image') => Promise<void>;
  fetchConversations: () => Promise<void>;
  activeConversationTargetProfile: Pick<Profile, 'id' | 'full_name' | 'business_name' | 'role' | 'email'> | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user, profile: currentUserProfile } = useAuth();
  const { toast } = useToast();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatMaximized, setIsChatMaximized] = useState(false);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [activeConversationTargetProfile, setActiveConversationTargetProfile] = 
    useState<Pick<Profile, 'id' | 'full_name' | 'business_name' | 'role' | 'email'> | null>(null);

  const toggleChat = useCallback(() => {
    setIsChatOpen(prev => !prev);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setIsChatMaximized(false);
  }, []);

  const toggleMaximizeChat = useCallback(() => {
    setIsChatMaximized(prev => !prev);
  }, []);

  const fetchConversations = useCallback(async (selectConversationId?: string | null) => {
    if (!user) return;
    setIsLoadingConversations(true);
    try {
      const fetchedConversations = await listUserConversationsAction(user.id);
      setConversations(fetchedConversations || []);
      if (selectConversationId && fetchedConversations.find(c => c.id === selectConversationId)) {
        setActiveConversationIdState(selectConversationId);
      }
    } catch (error: any) {
      console.error("ChatContext: Error fetching conversations:", error);
      toast({ title: "Chat Error", description: `Could not load conversations: ${error.message}`, variant: "destructive" });
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user, toast]);

  const setActiveConversationId = useCallback(async (conversationId: string | null) => {
    setActiveConversationIdState(conversationId);
    setMessages([]); 
    if (conversationId && user) {
      const currentConvo = conversations.find(c => c.id === conversationId);
      if (currentConvo) {
        setActiveConversationTargetProfile(currentConvo.otherParticipant);
        // Mark messages as read when conversation is opened
        await markMessagesAsReadAction(conversationId, user.id);
        // Refresh conversation list to update unread counts visually
        const updatedConversations = conversations.map(c => 
            c.id === conversationId ? { ...c, unread_count: 0 } : c
        );
        setConversations(updatedConversations);

      } else {
        // This might happen if opening a chat for the first time via openChatWithUser before fetchConversations completes
        // activeConversationTargetProfile will be set by openChatWithUser in that case
        console.warn("ChatContext: Active conversation not found in current list. Target profile might be set by initiator.");
      }
    } else {
      setActiveConversationTargetProfile(null);
    }
  }, [conversations, user]);

  useEffect(() => {
    if (user && isChatOpen && conversations.length === 0) { // Fetch initially or if list is empty
      fetchConversations();
    }
  }, [user, isChatOpen, fetchConversations, conversations.length]);

  // Effect for fetching messages when activeConversationId changes
  useEffect(() => {
    if (activeConversationId && user) {
      setIsLoadingMessages(true);
      getMessagesForConversationAction(activeConversationId, user.id)
        .then(fetchedMessages => {
          setMessages(fetchedMessages || []);
        })
        .catch(error => {
          console.error("ChatContext: Error fetching messages:", error);
          toast({ title: "Chat Error", description: "Could not load messages.", variant: "destructive" });
          setMessages([]);
        })
        .finally(() => setIsLoadingMessages(false));
    } else {
      setMessages([]);
    }
  }, [activeConversationId, user, toast]);

  // Effect for Realtime Supabase subscriptions
  useEffect(() => {
    if (!user) return;

    // Listen to new messages in ANY conversation the user is part of
    const messageSubscription = supabase
      .channel('public:chat_messages')
      .on<Message>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${user.id}` }, // Only listen for messages where current user is receiver
        async (payload) => {
          const newMessage = payload.new as Message;
          // If the new message belongs to the currently active conversation, add it
          if (newMessage.conversation_id === activeConversationId) {
            setMessages(prevMessages => [...prevMessages, newMessage]);
            await markMessagesAsReadAction(newMessage.conversation_id, user.id);
          }
          // Refresh conversations list to update last message and potentially unread count
          // if a new message arrives for any conversation.
          // The `listUserConversationsAction` should ideally handle unread counts.
          await fetchConversations(activeConversationId); 
          toast({ title: "New Message", description: `From: ${newMessage.sender_id === activeConversationTargetProfile?.id ? activeConversationTargetProfile.business_name || activeConversationTargetProfile.full_name : 'Someone'}` });
        }
      )
      .subscribe();
      
    // Listen to conversation updates (e.g., last_message_at)
    // This helps keep the conversation list fresh.
    const conversationSubscription = supabase
        .channel('public:chat_conversations')
        .on<ConversationView>(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'chat_conversations', filter: `or(participant1_id.eq.${user.id},participant2_id.eq.${user.id})`},
            async (payload) => {
                // An update to a conversation means last_message_at or similar changed.
                // Re-fetch conversations to get the latest state.
                await fetchConversations(activeConversationId);
            }
        )
        .subscribe();


    return () => {
      supabase.removeChannel(messageSubscription);
      supabase.removeChannel(conversationSubscription);
    };
  }, [user, activeConversationId, fetchConversations, toast, activeConversationTargetProfile]);


  const openChatWithUser = useCallback(async (targetUserId: string) => {
    if (!user || !currentUserProfile) {
      toast({ title: "Login Required", description: "You must be logged in to start a chat.", variant: "destructive" });
      return;
    }
    if (user.id === targetUserId) {
      toast({ title: "Chat Error", description: "You cannot open a chat with yourself.", variant: "default" });
      return;
    }

    setIsLoadingConversations(true); // Indicate loading while we get/create
    try {
      const { conversationId, isNew, targetProfileData } = await getOrCreateConversationAction(user.id, targetUserId);
      setActiveConversationTargetProfile(targetProfileData); // Set target profile first
      
      if (isNew || !conversations.find(c => c.id === conversationId)) {
        // If new or not in current list, fetch all conversations and then set active.
        // Pass conversationId to fetchConversations so it can be selected after fetch.
        await fetchConversations(conversationId);
      } else {
        // If exists and in list, just set it active.
        setActiveConversationIdState(conversationId); // Use state setter directly
      }
      setIsChatOpen(true);
    } catch (error: any) {
      console.error("ChatContext: Error opening chat with user:", error);
      toast({ title: "Chat Error", description: `Could not open chat: ${error.message}`, variant: "destructive" });
    } finally {
        setIsLoadingConversations(false);
    }
  }, [user, currentUserProfile, toast, fetchConversations, conversations]);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'image' = 'text') => {
    if (!user || !activeConversationId || !activeConversationTargetProfile) {
      toast({ title: "Chat Error", description: "Cannot send message. No active chat.", variant: "destructive" });
      return;
    }
    try {
      const newMessage = await sendMessageAction(
        activeConversationId,
        user.id,
        activeConversationTargetProfile.id,
        content,
        type
      );
      setMessages(prev => [...prev, newMessage]);
    } catch (error: any) {
      console.error("ChatContext: Error sending message:", error);
      toast({ title: "Message Error", description: `Could not send message: ${error.message}`, variant: "destructive" });
    }
  }, [user, activeConversationId, activeConversationTargetProfile, toast]);

  const value = {
    isChatOpen,
    isChatMaximized,
    toggleChat,
    closeChat,
    toggleMaximizeChat,
    openChatWithUser,
    activeConversationId,
    setActiveConversationId,
    conversations,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    sendMessage,
    fetchConversations,
    activeConversationTargetProfile,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

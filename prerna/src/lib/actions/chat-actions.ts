"use server";

import { createSupabaseServerActionClient } from '@/lib/supabase/server';
import type { Profile } from '@/contexts/AuthContext';
import type { Conversation, Message, ConversationView } from '@/types/chat';

interface GetOrCreateConversationResult {
  conversationId: string;
  isNew: boolean;
  targetProfileData: Pick<Profile, 'id' | 'full_name' | 'business_name' | 'role' | 'email'>;
}

export async function getOrCreateConversationAction(
  currentUserId: string,
  targetUserId: string
): Promise<GetOrCreateConversationResult> {
  const supabase = createSupabaseServerActionClient();

  if (currentUserId === targetUserId) {
    throw new Error("Cannot create a conversation with oneself.");
  }

  const participant1_id = currentUserId < targetUserId ? currentUserId : targetUserId;
  const participant2_id = currentUserId < targetUserId ? targetUserId : currentUserId;

  // 1. Check if conversation exists
  let { data: existingConversation, error: fetchError } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('participant1_id', participant1_id)
    .eq('participant2_id', participant2_id)
    .single();

  // 2. Fetch target user's profile
  const { data: targetProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, business_name, role, email')
    .eq('id', targetUserId)
    .single();

  if (profileError || !targetProfile) {
    console.error("[ChatAction] Error fetching target profile:", profileError?.message);
    throw new Error(`Could not fetch target user profile for chat. ${profileError?.message || ''}`);
  }
  
  const targetProfileData = {
      id: targetProfile.id,
      full_name: targetProfile.full_name,
      business_name: targetProfile.business_name,
      role: targetProfile.role as 'individual' | 'business' | null,
      email: targetProfile.email,
  };

  if (fetchError && fetchError.code !== 'PGRST116') { 
    console.error("[ChatAction] Error checking for existing conversation:", fetchError.message);
    throw new Error(`Error checking for conversation: ${fetchError.message}`);
  }

  if (existingConversation) {
    return {
      conversationId: existingConversation.id,
      isNew: false,
      targetProfileData,
    };
  }

  // 3. If not, create it
  const { data: newConversation, error: createError } = await supabase
    .from('chat_conversations')
    .insert({ participant1_id, participant2_id, last_message_at: new Date().toISOString() })
    .select('id')
    .single();

  if (createError || !newConversation) {
    console.error("[ChatAction] Error creating new conversation:", createError?.message);
    throw new Error(`Could not create conversation: ${createError?.message}`);
  }

  return {
    conversationId: newConversation.id,
    isNew: true,
    targetProfileData,
  };
}

export async function listUserConversationsAction(userId: string): Promise<ConversationView[]> {
  const supabase = createSupabaseServerActionClient();
  
  const { data: conversations, error } = await supabase
    .from('chat_conversations')
    .select('id, participant1_id, participant2_id, last_message_at, created_at')
    .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error("[ChatAction] Error listing user conversations:", error.message);
    throw new Error(`Error listing conversations: ${error.message}`);
  }
  if (!conversations) return [];

  const conversationViews: ConversationView[] = await Promise.all(
    conversations.map(async (convo) => {
      const otherParticipantId = convo.participant1_id === userId ? convo.participant2_id : convo.participant1_id;
      
      const { data: otherProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, business_name, role, email')
        .eq('id', otherParticipantId)
        .single();

      if (profileError || !otherProfile) {
        console.error(`[ChatAction] Error fetching profile for participant ${otherParticipantId}:`, profileError?.message);
        return {
          ...convo,
          otherParticipant: { id: otherParticipantId, full_name: 'Unknown User', business_name: 'Unknown Business', role: null, email: 'unknown@example.com' },
          last_message_content: 'Error loading message',
          last_message_at: convo.last_message_at,
          unread_count: 0, 
        } as ConversationView; 
      }
      
      const { data: lastMessageData, error: lastMessageError } = await supabase
        .from('chat_messages')
        .select('content, created_at')
        .eq('conversation_id', convo.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { count: unreadCount, error: unreadError } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', convo.id)
        .eq('receiver_id', userId)
        .eq('is_read', false);

      if (unreadError) {
        console.error(`[ChatAction] Error fetching unread count for convo ${convo.id}:`, unreadError.message);
      }

      return {
        ...convo,
        otherParticipant: {
          id: otherProfile.id,
          full_name: otherProfile.full_name,
          business_name: otherProfile.business_name,
          role: otherProfile.role as 'individual' | 'business' | null,
          email: otherProfile.email,
        },
        last_message_content: lastMessageError ? 'Error loading message' : (lastMessageData?.content || 'No messages yet.'),
        last_message_at: lastMessageError ? convo.last_message_at : (lastMessageData?.created_at || convo.last_message_at),
        unread_count: unreadCount || 0,
      };
    })
  );
  return conversationViews.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
}

export async function getMessagesForConversationAction(
  conversationId: string,
  currentUserId: string
): Promise<Message[]> {
  const supabase = createSupabaseServerActionClient();
  
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`[ChatAction] Error fetching messages for conversation ${conversationId}:`, error.message);
    throw new Error(`Error fetching messages: ${error.message}`);
  }

  if (!messages) return [];

  const messageIdsToMarkRead = messages
    .filter(msg => msg.receiver_id === currentUserId && !msg.is_read)
    .map(msg => msg.id);

  if (messageIdsToMarkRead.length > 0) {
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .in('id', messageIdsToMarkRead);
    if (updateError) {
      console.error(`[ChatAction] Error marking messages as read for conversation ${conversationId}:`, updateError.message);
    }
  }
  return messages as Message[];
}

export async function sendMessageAction(
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string,
  type: 'text' | 'image' = 'text'
): Promise<Message> {
  const supabase = createSupabaseServerActionClient();

  const payload: any = {
    conversation_id: conversationId,
    sender_id: senderId,
    receiver_id: receiverId,
    message_type: type,
    is_read: false
  };

  if (type === 'text') {
    payload.content = content;
  } else if (type === 'image') {
    payload.image_url = content;
    payload.content = ''; // Empty content for image messages
  }

  // 1. Insert message into chat_messages
  const { data: newMessage, error: insertError } = await supabase
    .from('chat_messages')
    .insert(payload)
    .select()
    .single();

  if (insertError || !newMessage) {
    console.error("[ChatAction] Error sending message:", insertError?.message);
    throw new Error(`Could not send message: ${insertError?.message || 'Unknown error during message insert.'}`);
  }

  // 2. Update last_message_at in chat_conversations
  const { error: updateConvoError } = await supabase
    .from('chat_conversations')
    .update({ last_message_at: newMessage.created_at })
    .eq('id', conversationId);

  if (updateConvoError) {
    console.error("[ChatAction] Error updating conversation last_message_at:", updateConvoError.message);
  }

  return newMessage as Message;
}

export async function markMessagesAsReadAction(conversationId: string, userId: string): Promise<void> {
    const supabase = createSupabaseServerActionClient();
    const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('receiver_id', userId)
        .eq('is_read', false);

    if (error) {
        console.error(`[ChatAction] Error marking messages as read in convo ${conversationId} for user ${userId}:`, error.message);
    }
}

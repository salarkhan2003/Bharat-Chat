import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

export interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: any;
  iv?: string;
  senderPublicKey?: string;
  status?: 'sent' | 'delivered' | 'read';
}

export function useChatMessages(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !auth.currentUser) return;

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return unsubscribe;
  }, [chatId]);

  return { messages, loading };
}

export function usePresence(otherUserId: string | null) {
  const [presence, setPresence] = useState<{ isOnline: boolean, isTyping: boolean, lastActive?: any, currentChatId?: string } | null>(null);

  useEffect(() => {
    if (!otherUserId) return;

    const unsubscribe = onSnapshot(doc(db, 'presence', otherUserId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPresence({
          isOnline: data.isOnline || false,
          isTyping: data.isTyping || false,
          currentChatId: data.currentChatId,
          lastActive: data.lastActive
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `presence/${otherUserId}`);
    });

    return unsubscribe;
  }, [otherUserId]);

  return presence;
}

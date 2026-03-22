'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ChatMessage, ChatResponse } from '@/types';

export function useChat(onTradeExecuted?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/chat/history')
      .then((r) => r.json())
      .then((data: ChatMessage[]) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {});
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        actions: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content }),
        });

        if (res.ok) {
          const data: ChatResponse = await res.json();
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.message,
            actions: {
              trades_executed: data.trades_executed,
              trades_failed: data.trades_failed,
              watchlist_changes: data.watchlist_changes,
            },
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);

          // Notify parent if trades were executed so portfolio refreshes
          if (data.trades_executed?.length > 0 && onTradeExecuted) {
            onTradeExecuted();
          }
        } else {
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request.',
            actions: null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Network error. Please try again.',
          actions: null,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setLoading(false);
      }
    },
    [onTradeExecuted]
  );

  return { messages, loading, sendMessage };
}

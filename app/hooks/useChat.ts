import { useState, useCallback, useEffect } from 'react';
import { ChatStorage } from '../utils/ChatStorage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  urls?: Array<{ url: string; content: string }>;
}
interface UseChatReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  isProcessing: boolean;
  isProcessingUrls: boolean;
  error: string | null;
  currentPersona: string;
  setCurrentPersona: React.Dispatch<React.SetStateAction<string>>;
}

interface UseChatProps {
  selectedCompany?: string;
}

export function useChat(props?: UseChatProps): UseChatReturn {
  const { selectedCompany = 'connect-america' } = props || {};
  const [messages, setMessages] = useState<Message[]>(() => ChatStorage.getCurrentSession());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingUrls, setIsProcessingUrls] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPersona, setCurrentPersona] = useState('default');

  // Get the appropriate API endpoint based on selected company
  const getApiEndpoint = useCallback(() => {
    switch (selectedCompany) {
      case 'lifeline':
        return '/api/lifeline';
      case 'amac':
        return '/api/amac';
      case 'contracts':
        return '/api/contracts';
      case 'connect-america':
      default:
        return '/api/chat';
    }
  }, [selectedCompany]);

  // Save messages to local storage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      ChatStorage.saveCurrentSession(messages);
    }
  }, [messages]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const append = (newMessage: Message) => {
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };
  const sendMessage = useCallback(async (message: string) => {
    setIsLoading(true);
    setIsProcessing(true);
    setError(null);
    const userMessage: Message = { role: 'user', content: message };
    try {
      setMessages(prev => [...prev, userMessage]);
      const apiEndpoint = getApiEndpoint();
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          chat_history: messages,
          persona: currentPersona
        }),
      });
      if (!response.body) {
        throw new Error('No response body');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantMessage = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        if (assistantMessage === '') {
          setIsProcessing(false);
        }
        const textContent = chunkValue.match(/0:"([^"]+)"/g)?.map(match => match.slice(3, -1)).join('') || '';
        assistantMessage += textContent;
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: assistantMessage }
        ]);
        await delay(100);
      }

      // After streaming is complete, get URLs
      if (assistantMessage) {
        setIsProcessingUrls(true);
        try {
          const linksResponse = await fetch('/api/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              message,
              answer: assistantMessage 
            }),
          });

          const urlsData = await linksResponse.json();
          
          // Update message with URLs
          setMessages(prev => [
            ...prev.slice(0, -1),
            { 
              role: 'assistant', 
              content: assistantMessage,
              urls: urlsData.urls // This will be displayed by the References component
            }
          ]);
        } catch (error) {
          console.error('Failed to process URLs:', error);
        } finally {
          setIsProcessingUrls(false);
        }
      }
    } catch (err) {
      setError('Failed to send message');
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
    }
  }, [messages, currentPersona, getApiEndpoint]);
  return {
    messages,
    setMessages,
    sendMessage,
    isLoading,
    isProcessing,
    isProcessingUrls,
    error,
    currentPersona,
    setCurrentPersona,
  };
}
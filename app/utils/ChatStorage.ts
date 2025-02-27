export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  timestamp: number;
  messages: Message[];
  preview: string;
}

const CHAT_SESSIONS_KEY = '_america_chat_sessions';
const MAX_SESSIONS = 10;

export const ChatStorage = {
  saveCurrentSession: (messages: Message[]) => {
    if (typeof window === 'undefined' || messages.length === 0) return;
    
    const currentSessionId = sessionStorage.getItem('current_session_id') || 
      new Date().getTime().toString();
    
    if (!sessionStorage.getItem('current_session_id')) {
      sessionStorage.setItem('current_session_id', currentSessionId);
    }

    // Get first user message for preview
    const firstUserMessage = messages.find(m => m.role === 'user');
    const preview = firstUserMessage ? firstUserMessage.content : 'New conversation';

    const sessions = ChatStorage.getAllSessions();
    const currentSession: ChatSession = {
      id: currentSessionId,
      timestamp: new Date().getTime(),
      messages: messages,
      preview: preview.length > 50 ? preview.substring(0, 50) + '...' : preview
    };

    const updatedSessions = [currentSession, ...sessions.filter(s => s.id !== currentSessionId)]
      .slice(0, MAX_SESSIONS);

    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(updatedSessions));
    return currentSession;
  },

  getAllSessions: (): ChatSession[] => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(CHAT_SESSIONS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },

  getCurrentSession: (): Message[] => {
    if (typeof window === 'undefined') return [];
    const currentSessionId = sessionStorage.getItem('current_session_id');
    if (!currentSessionId) return [];

    const sessions = ChatStorage.getAllSessions();
    return sessions.find(s => s.id === currentSessionId)?.messages || [];
  },

  clearCurrentSession: () => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('current_session_id');
  },

  deleteSession: (sessionId: string) => {
    if (typeof window === 'undefined') return;
    const sessions = ChatStorage.getAllSessions();
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(updatedSessions));
  }
}; 
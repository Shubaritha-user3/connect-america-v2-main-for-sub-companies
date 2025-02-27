'use client';
import { useState, useEffect, useRef } from 'react';
import { FileText, Plus, ChevronDown, Menu, RefreshCw, MessageSquare, ArrowRight, UserCircle } from 'lucide-react';
import React from 'react';
import { toast } from 'react-hot-toast';
import { useChat } from '../hooks/useChat'; // Adjust the path as necessary
import { useAmplitude } from '../hooks/useAmplitude';
import { format } from 'date-fns';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { marked } from 'marked';

// Define the structure for chat messages
interface Message {
  role: 'user' | 'assistant';
  content: string;
  urls?: Array<{ url: string; content: string }>;
}

// Define the structure for FAQ questions
interface Question {
  question_text: string;
  answer?: string;
}

// Define the structure for input options in the dropdown
interface InputOption {
  id: string;
  label: string;
  description: string;
}

// Add these constants at the top with other interfaces
const CHAT_SESSIONS_KEY = '_america_chat_sessions';
const MAX_SESSIONS = 10;

interface ChatSession {
  id: string;
  timestamp: number;
  messages: Message[];
  preview: string;
}

// Add these interfaces at the top with other interfaces
interface FAQQuestion {
  question_text: string;
  category?: string;
}

// Add this interface at the top with other interfaces
interface Persona {
  id: string;
  label: string;
  description: string;
}

// Add these constants
const PERSONAS: Persona[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Standard chat input'
  },
  {
    id: 'advice',
    label: 'Advice',
    description: 'Get advice on specific topics'
  }
];

// Add this interface at the top with other interfaces
interface CompanyOption {
  id: string;
  label: string;
  route: string;
}

// Add this constant with the company options
const COMPANY_OPTIONS: CompanyOption[] = [
  {
    id: 'connect-america',
    label: 'Connect America',
    route: '/api/chat'
  },
  {
    id: 'lifeline',
    label: 'Lifeline',
    route: '/api/lifeline'
  },
  {
    id: 'amac',
    label: 'AMAC',
    route: '/api/amac'
  },
  {
    id: 'contracts',
    label: 'Contracts',
    route: '/api/contracts'
  }
];

// Update the ChatStorage utility
const ChatStorage = {
  saveCurrentSession: (messages: Message[]) => {
    if (typeof window === 'undefined' || messages.length === 0) return;
    
    const currentSessionId = sessionStorage.getItem('current_session_id') || 
      new Date().getTime().toString();
    
    // Save current session ID if not exists
    if (!sessionStorage.getItem('current_session_id')) {
      sessionStorage.setItem('current_session_id', currentSessionId);
    }

    // Get existing sessions
    const sessions = ChatStorage.getAllSessions();
    
    // Update or add current session
    const currentSession: ChatSession = {
      id: currentSessionId,
      timestamp: new Date().getTime(),
      messages: messages,
      preview: messages[0]?.content || 'Empty chat'
    };

    const updatedSessions = [currentSession, ...sessions.filter(s => s.id !== currentSessionId)]
      .slice(0, MAX_SESSIONS);

    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(updatedSessions));
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

  clearAllSessions: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CHAT_SESSIONS_KEY);
    sessionStorage.removeItem('current_session_id');
  },

  deleteSession: (sessionId: string) => {
    if (typeof window === 'undefined') return;
    const sessions = ChatStorage.getAllSessions();
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(updatedSessions));
  }
};

// Loading Spinner component
const LoadingSpinner = () => (
  <svg 
    className="animate-spin h-4 w-4" 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24"
  >
    <circle 
      className="opacity-25" 
      cx="12" 
      cy="12" 
      r="10" 
      stroke="currentColor" 
      strokeWidth="4"
    />
    <path 
      className="opacity-75" 
      fill="currentColor" 
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// Font family constant
const systemFontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Update formatMessage function to properly handle \n\n
const formatMessage = (text: string): string => {
  // Replace \n\n with double line breaks for better spacing
  const formattedText = text.replace(/\n\n/g, '<br><br>')
    // Add handling for ### headers - convert to bold
    .replace(/###\s*(.*?)(\n|$)/g, '<div class="mb-3"><strong>$1</strong></div>');
  
  // Then split by remaining newlines to handle paragraphs
  return formattedText
    .split('\n')
    .map(paragraph => {
      // Skip empty paragraphs but preserve spacing
      if (!paragraph.trim()) {
        return '<br>';
      }

      // For each paragraph, handle numbered lists, bullet points and bold text
      const numberedListMatch = paragraph.match(/^(\d+)\./);
      
      // Handle bullet points (replace - with •)
      if (paragraph.trim().startsWith('-')) {
        // Apply bold formatting to text between ** markers before adding bullet point
        const bulletText = paragraph.trim().substring(1)
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return '<div class="mb-3">• ' + bulletText + '</div>';
      } else if (numberedListMatch) {
        const number = numberedListMatch[1];
        const restOfLine = paragraph.slice(number.length + 1)
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Bold both the number and the period
        return '<div class="mb-3"><strong>' + number + '.</strong>' + restOfLine + '</div>';
      }

      // Handle bold text between asterisks for non-list paragraphs
      return '<div class="mb-3">' + 
        paragraph
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          // Bold standalone numbers (but not within words)
          .replace(/(\s|^)(\d+)(\s|$|\.)/g, '$1<strong>$2</strong>$3') +
        '</div>';
    })
    .join('\n') // Add newline between paragraphs
    .replace(/<br><br><br>/g, '<br><br>') // Clean up excessive breaks
    .replace(/(<div class="mb-3">)\s*<br>/g, '$1') // Clean up breaks inside divs
    .trim(); // Remove any leading/trailing whitespace
};

// Update ChatMessage component to use formatting
const ChatMessage = ({ 
  message, 
  index, 
  loading,
  isLastMessage,
  getDocumentTitle,
  handleDownload 
}: { 
  message: Message;
  index: number;
  loading: boolean;
  isLastMessage: boolean;
  getDocumentTitle: (url: string) => string;
  handleDownload: (url: string) => Promise<void>;
}) => {
  const formattedContent = message.content
    .replace(/\\n\\n/g, '\n\n')
    .replace(/\\n/g, '\n');

  return (
    <div className={`p-6 ${message.role === 'user' ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-900'}`}>
      {/* Text Response Card */}
      <div className="bg-white dark:bg-slate-900 rounded-lg 
        border border-slate-200 dark:border-slate-700 
        hover:border-blue-500 dark:hover:border-blue-400 
        transition-colors shadow-sm hover:shadow-md p-8 mb-6"
        style={{ fontFamily: systemFontFamily }}>
        <div className="w-full">
          <div 
            className="text-base leading-relaxed space-y-4 text-slate-800 dark:text-slate-100"
            dangerouslySetInnerHTML={{ __html: formatMessage(formattedContent) }}
          />
        </div>
      </div>

      {/* Documents Card - Only shown if there are URLs */}
      {message.urls && message.urls.length > 0 && (
        <div className="w-full mt-6">
          <References 
            urls={message.urls} 
            getDocumentTitle={getDocumentTitle} 
            handleDownload={handleDownload} 
          />
        </div>
      )}
    </div>
  );
};

// References component with theme support
const References = ({ 
  urls, 
  getDocumentTitle,
  handleDownload 
}: { 
  urls: Array<{ url: string; content: string }>;
  getDocumentTitle: (url: string) => string;
  handleDownload: (url: string) => Promise<void>;
}) => {
  if (!urls || urls.length === 0) return null;

  const handleView = async (url: string) => {
    try {
      // For direct viewing of PDFs and other documents
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('View error:', error);
      toast.error('Failed to view document');
    }
  };

  const handleDownloadClick = async (url: string) => {
    try {
      await handleDownload(url);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 
        bg-white dark:bg-slate-900 px-6 py-4 
        rounded-lg shadow-sm flex items-center gap-3 mb-4">
        <FileText className="w-5 h-5" />
        Referenced Documents
      </h2>
      
      <div className="space-y-4">
        {urls.map(({ url }, index) => (
          <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center 
            gap-4 p-6 rounded-lg 
            border border-slate-200 dark:border-slate-700 
            hover:border-blue-500 dark:hover:border-blue-400 
            transition-colors 
            bg-white dark:bg-slate-900 
            shadow-sm hover:shadow-md">
            
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-blue-700 dark:text-blue-400 font-semibold">#{index + 1}</span>
                <h3 className="text-slate-900 dark:text-slate-100 text-lg font-medium capitalize">
                  {getDocumentTitle(url)}
                </h3>
              </div>
              
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                {url.includes('.pdf') ? 'PDF Document' : 
                 url.includes('.doc') ? 'Word Document' : 
                 'Document'}
              </p>
            </div>
            
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                onClick={() => handleView(url)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-md 
                  bg-blue-600 dark:bg-blue-500 
                  text-white 
                  hover:bg-blue-700 dark:hover:bg-blue-600 
                  transition-colors 
                  flex-1 sm:flex-initial justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View
              </button>
              
              <button   
                onClick={() => handleDownloadClick(url)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-md 
                  bg-green-600 dark:bg-green-500 
                  text-white 
                  hover:bg-green-700 dark:hover:bg-green-600 
                  transition-colors 
                  flex-1 sm:flex-initial justify-center"
              > 
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Update WelcomeSection with better spacing
const WelcomeSection = ({ 
  questions, 
  isLoading, 
  error, 
  onQuestionClick 
}: { 
  questions: FAQQuestion[];
  isLoading: boolean;
  error: string | null;
  onQuestionClick: (question: string) => void;
}) => {
  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="text-center mb-6">
        <p className="text-2xl font-semibold text-gray-800 dark:text-white mb-3">
          👋 Welcome to Connect America Support
        </p>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          How can I help you today?
        </p>
      </div>
      
      <div className="w-full max-w-4xl mx-auto px-6">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
          Frequently Asked Questions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading ? (
            Array(3).fill(null).map((_, index) => (
              <div
                key={index}
                className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 animate-pulse h-24"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))
          ) : error ? (
            <div className="col-span-3 text-center text-red-600 py-4">
              {error}
            </div>
          ) : questions.length === 0 ? (
            <div className="col-span-3 text-center text-gray-500 py-4">
              No suggested questions available
            </div>
          ) : (
            questions.map((q, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!isLoading) {
                    onQuestionClick(q.question_text);
                  }
                }}
                disabled={isLoading}
                className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm 
                  hover:shadow-md transition-shadow border border-gray-200 
                  dark:border-slate-700 text-left group"
              >
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 shrink-0 mt-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                  </span>
                  <span className="text-gray-700 dark:text-gray-200 group-hover:text-gray-900 
                    dark:group-hover:text-white font-medium text-sm">
                    {q.question_text}
                  </span>
                </div>
                {isLoading && (
                  <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
                    <div className="animate-spin text-blue-600 text-xl">⟳</div>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const PersonaDropdown = ({ 
  selectedPersona, 
  setSelectedPersona 
}: { 
  selectedPersona: string;
  setSelectedPersona: (persona: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Find the selected persona
  const selectedPersonaOption = PERSONAS.find(p => p.id === selectedPersona) || PERSONAS[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 rounded-md text-sm lg:text-base
        bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm"
      >
        <span>{selectedPersonaOption.label}</span>
        <ChevronDown className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg 
          border border-gray-200 py-1 z-50">
          {PERSONAS.map((persona) => (
            <button
              key={persona.id}
              onClick={() => {
                setSelectedPersona(persona.id);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left flex flex-col
              ${selectedPersona === persona.id 
                ? 'bg-blue-50 border-l-4 border-blue-500' 
                : 'hover:bg-gray-50'
              }`}
            >
              <span className={`font-medium ${selectedPersona === persona.id ? 'text-blue-700' : 'text-gray-900'}`}>
                {persona.label}
              </span>
              <span className={`text-sm ${selectedPersona === persona.id ? 'text-blue-600' : 'text-gray-500'}`}>
                {persona.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Modify the CompanyDropdown component to use state instead of navigation
const CompanyDropdown = ({ 
  selectedCompany, 
  setSelectedCompany 
}: { 
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCompanySelect = (companyId: string) => {
    setIsOpen(false);
    setSelectedCompany(companyId);
  };

  // Find the currently selected company label
  const selectedCompanyLabel = COMPANY_OPTIONS.find(
    option => option.id === selectedCompany
  )?.label || 'Connect America';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 rounded-md text-sm lg:text-base
          bg-[#1E2875] text-white hover:bg-[#161B7F] transition-colors"
      >
        <span>{selectedCompanyLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg 
          border border-gray-200 py-1 z-50">
          {COMPANY_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleCompanySelect(option.id)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${
                selectedCompany === option.id ? 'bg-gray-100 font-medium' : 'text-gray-800'
              } transition-colors`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Update the ChatInput component to properly integrate PersonaDropdown
const ChatInput = ({ 
  onSubmit, 
  loading,
  selectedPersona,
  setSelectedPersona
}: { 
  onSubmit: (message: string) => void;
  loading: boolean;
  selectedPersona: string;
  setSelectedPersona: (persona: string) => void;
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;
    onSubmit(message);
    setMessage('');
  };

  return (
    <div className="bg-[#F0F2FF] flex-none">
      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className="flex items-center gap-4 p-4"
      >
        <PersonaDropdown 
          selectedPersona={selectedPersona} 
          setSelectedPersona={setSelectedPersona} 
        />
        
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              // Auto-adjust height
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; // Max height of 150px
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            placeholder="Type your message here..."
            className="flex-1 rounded-lg 
              border border-[#4F7FFF] dark:border-blue-500
              px-6 py-3
              focus:outline-none focus:ring-2 
              focus:ring-blue-500 dark:focus:ring-blue-400
              text-gray-800 dark:text-gray-100 
              placeholder-gray-500 dark:placeholder-gray-400 
              w-full bg-white dark:bg-slate-700
              resize-none overflow-y-auto
              min-h-[48px] max-h-[150px]"
            rows={1}
          />
          {/* Character count indicator (optional) */}
          <div className="absolute bottom-2 right-3 text-xs text-gray-400 dark:text-gray-500">
            {message.length}/2000
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading || !message.trim()}
          className="flex-none bg-[#0A0F5C] text-white 
            p-2.5
            rounded-lg hover:bg-blue-900 
            transition-colors 
            disabled:opacity-50 
            disabled:cursor-not-allowed
            flex items-center justify-center
            h-12 w-12"
        >
          {loading ? (
            <span className="animate-spin text-xl">⟳</span>
          ) : (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              className="w-5 h-5"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13.5 19l7-7-7-7M20.5 12H4" 
              />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default function ChatPage() {
  const amplitude = useAmplitude();
  const [selectedPersona, setSelectedPersona] = useState<string>('default');
  const [selectedCompany, setSelectedCompany] = useState<string>('connect-america');
  
  const {
    messages,
    setMessages,
    sendMessage,
    isLoading,
    isProcessing,
    isProcessingUrls,
    error: chatError,
    currentPersona,
    setCurrentPersona,
  } = useChat({ selectedCompany });
  
  const [inputValue, setInputValue] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Update the FAQ loading state
  const [faqQuestions, setFaqQuestions] = useState<FAQQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [faqError, setFaqError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Add these states
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);

  // Add state for delete confirmation
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Add a computed state for overall loading status
  const isResponseInProgress = isLoading || isProcessing || isProcessingUrls;

  useEffect(() => {
    setSessions(ChatStorage.getAllSessions());
  }, [messages]); // Update sessions when messages change

  // Track page view
  useEffect(() => {
    amplitude.trackEvent('chat_page_viewed', {
      timestamp: new Date().toISOString()
    });
  }, []);

  // Add this useEffect for loading FAQ questions
  useEffect(() => {
    const loadFaqQuestions = async () => {
      try {
        setIsLoadingQuestions(true);
        setFaqError(null);
        
        const response = await fetch('/api/questions');
        if (!response.ok) {
          throw new Error('Failed to load FAQ questions');
        }
        
        const data = await response.json();
        if (!Array.isArray(data.questions)) {
          throw new Error('Invalid response format');
        }
        
        setFaqQuestions(data.questions);
      } catch (error) {
        console.error('Error loading FAQ questions:', error);
        setFaqError('Failed to load suggested questions');
        // Set default questions as fallback
        setFaqQuestions([
          {
            question_text: "What happens if a customer cancels within the hospice protocol?"
          },
          {
            question_text: "How do you handle callers with OTG+ devices?"
          },
          {
            question_text: "How should a customer handle a return using a FedEx-specific label?"
          }
        ]);
      } finally {
        setIsLoadingQuestions(false);
      }
    };

    loadFaqQuestions();
  }, []); // Empty dependency array means this runs once on mount

  // Track message sending
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    amplitude.trackEvent('message_sent', {
      messageLength: inputValue.length
    });

    try {
      const messageToSend = inputValue; // Store the input value
      setInputValue(''); // Clear input immediately
      await sendMessage(messageToSend); // Use stored message
    } catch (error) {
      amplitude.trackEvent('message_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      toast.error('Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const getDocumentTitle = (url: string) => {
    const filename = url.split('/').pop() || '';
    // Remove special characters, numbers at start, and file extensions
    return filename
      .replace(/[-_#+%]/g, ' ') // Added + and % to the characters to remove
      .replace(/^\d+\s*/, '') // Remove numbers at the start
      .replace(/\.(pdf|doc|docx)$/i, '') // Remove file extensions
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  };

  // Track document downloads
  const handleDownload = async (url: string) => {
    amplitude.trackEvent('document_downloaded', {
      documentUrl: url,
      documentTitle: getDocumentTitle(url)
    });
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const filename = url.split('/').pop() || 'document.pdf';
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = downloadUrl;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(link);
      
      toast.success('Download completed successfully');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download document');
    }
  };

  // Track FAQ interactions
  const handleQuestionClick = async (question: string) => {
    if (isLoading) return;

    amplitude.trackEvent('faq_clicked', {
      questionText: question
    });

    try {
      await sendMessage(question);
    } catch (error) {
      console.error('FAQ Error:', error);
      toast.error('Failed to get response');
    }
  };

  // Update the new chat function to use the combined loading state
  const handleNewChat = () => {
    if (isResponseInProgress) {
      toast.error("Please wait for the current response to complete");
      return;
    }
    
    ChatStorage.clearCurrentSession();
    setMessages([]);
    setInputValue('');
  };

  // Update the persona change handler
  const handlePersonaChange = (persona: string) => {
    setSelectedPersona(persona);
    setCurrentPersona(persona);
  };

  const handleLoadSession = (sessionId: string) => {
    sessionStorage.setItem('current_session_id', sessionId);
    const sessionMessages = ChatStorage.getCurrentSession();
    setMessages(sessionMessages);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  // Update the handleDeleteSession function
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
  };

  // Add confirmation handler
  const confirmDelete = () => {
    if (sessionToDelete) {
      ChatStorage.deleteSession(sessionToDelete);
      setSessions(ChatStorage.getAllSessions());
      setSessionToDelete(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'M/d/yyyy');
  };

  // Add this function to handle scroll events
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isScrolledToBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    setAutoScroll(isScrolledToBottom);
  };

  // Update the scroll to bottom function
  const scrollToBottom = () => {
    if (!autoScroll || !messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ 
      behavior: "smooth",
      block: "end"
    });
  };

  // Add scroll event listener
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
      return () => chatContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Update the messages scroll effect
  useEffect(() => {
    scrollToBottom();
  }, [messages]); // Scroll when messages update

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPersonaDropdown(false);
      }
    };

    if (showPersonaDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPersonaDropdown]);

  return (
    <div className="flex fixed inset-0 overflow-hidden bg-white dark:bg-slate-900">
      {/* Left Sidebar */}
      <div className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        fixed lg:relative
        w-64 h-full flex-none
        bg-[#0A0F5C] text-white
        transition-transform duration-300 ease-in-out
        z-40 top-0 left-0
        overflow-y-auto
      `}>
        <div className="p-4 flex flex-col h-full">
          <div className="mb-8">
            <h1 className="text-xl font-bold">Connect America</h1>
            <p className="text-sm text-gray-300 mt-2">AI Support Assistant</p>
          </div>
          
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-blue-300">Conversation History</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sessions.map((session) => (
              <div key={session.id} className="relative group">
                <div className="text-sm text-gray-400 px-3 py-1">
                  {formatDate(session.timestamp)}
                </div>
                <div className="relative flex items-center mb-2">
                  <button
                    onClick={() => handleLoadSession(session.id)}
                    className="w-full text-left p-3 rounded-lg
                      hover:bg-white/10 transition-colors
                      flex items-center gap-2"
                  >
                    <MessageSquare size={16} className="shrink-0" />
                    <span className="text-sm truncate">{session.preview}</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="absolute right-2 
                      opacity-0 group-hover:opacity-100 transition-opacity
                      p-1 hover:bg-red-500/20 rounded-full
                      flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col w-full overflow-hidden bg-white dark:bg-slate-900">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 p-4">
          {/* Responsive header layout */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden flex items-center justify-center w-8 h-8 text-gray-600 dark:text-gray-300"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div className="lg:ml-6">
                <Link href="/" className="hover:opacity-80 transition-opacity">
                  <h1 className="text-lg lg:text-2xl font-semibold text-[#0A0F5C] dark:text-white">
                    CA AI SuperBot
                  </h1>
                  <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-300">
                    Ask me anything to support our customers
                  </p>
                </Link>
              </div>
            </div>

            {/* Buttons - will be in same row on desktop */}
            <div className="flex gap-2 px-2">
              <Link
                href="/chat"
                onClick={(e) => {
                  e.preventDefault();
                  handleNewChat();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 rounded-md text-sm lg:text-base
                  ${isResponseInProgress
                    ? 'bg-gray-400 cursor-not-allowed pointer-events-none' 
                    : 'bg-[#22C55E] hover:bg-green-600'} 
                  text-white transition-colors`}
              >
                <Plus className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                <span>New Chat</span>
              </Link>
              <CompanyDropdown
                selectedCompany={selectedCompany}
                setSelectedCompany={setSelectedCompany}
              />
              <Link
                href="/documents"
                className="flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 rounded-md text-sm lg:text-base
                  bg-[#1E2875] text-white hover:bg-[#161B7F] transition-colors"
              >
                <FileText className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                <span>Documents</span>
              </Link>
            </div>
          </div>
        </div>
        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <WelcomeSection
              questions={faqQuestions}
              isLoading={isLoadingQuestions}
              error={faqError}
              onQuestionClick={handleQuestionClick}
            />
          ) : (
            messages.map((message, index) => (
              <ChatMessage
                key={index}
                message={message}
                index={index}
                loading={isLoading}
                isLastMessage={index === messages.length - 1}
                getDocumentTitle={getDocumentTitle}
                handleDownload={handleDownload}
              />
            ))
          )}

          {/* Loading Indicator - Only shows during initial processing */}
          {isProcessing && (
            <div className="p-4">
              <div className="bg-gray-50 dark:bg-slate-800 shadow-sm py-4 sm:py-5 px-4 sm:px-6 
                rounded-lg mx-2 sm:mx-4 w-full border border-gray-200 dark:border-slate-700">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                  Processing your request...
                </div>
              </div>
            </div>
          )}

          {isProcessingUrls && (
            <div className="p-4">
              <div className="bg-gray-50 dark:bg-slate-800 shadow-sm py-4 sm:py-5 px-4 sm:px-6 
                rounded-lg mx-2 sm:mx-4 w-full border border-gray-200 dark:border-slate-700">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                  Finding related documents...
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-[#F8F9FF] dark:bg-slate-800 p-4">
          <div className="flex gap-4 mx-4 relative" ref={dropdownRef}>
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
                className="flex-none flex items-center justify-center h-12 w-12 
                  bg-white dark:bg-slate-700 rounded-lg
                  hover:bg-gray-50 dark:hover:bg-slate-600 
                  transition-colors border border-gray-200 dark:border-slate-600
                  text-gray-600 dark:text-gray-300"
              >
                <Plus className="w-5 h-5" />
              </button>

              <textarea
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as any);
                  }
                }}
                placeholder="Type your message here..."
                className="flex-1 rounded-lg 
                  border border-[#4F7FFF] dark:border-blue-500
                  px-6 py-3 resize-none overflow-y-auto
                  focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                  text-gray-800 dark:text-gray-100 
                  placeholder-gray-500 dark:placeholder-gray-400 
                  w-full bg-white dark:bg-slate-700
                  min-h-[48px] max-h-[150px]"
              />
              
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="flex-none flex items-center justify-center h-12 w-12 rounded-lg
                  bg-[#8B95F2] dark:bg-blue-600 
                  text-white 
                  hover:bg-[#7A84E1] dark:hover:bg-blue-700 
                  transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            {showPersonaDropdown && (
              <div className="absolute left-0 bottom-full mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {PERSONAS.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => handlePersonaChange(persona.id)}
                    className={`w-full px-4 py-2 text-left flex flex-col
                      ${selectedPersona === persona.id 
                        ? 'bg-blue-50 border-l-4 border-blue-500' 
                        : 'hover:bg-gray-50'
                      }`}
                  >
                    <span className={`font-medium ${selectedPersona === persona.id ? 'text-blue-700' : 'text-gray-900'}`}>
                      {persona.label}
                    </span>
                    <span className={`text-sm ${selectedPersona === persona.id ? 'text-blue-600' : 'text-gray-500'}`}>
                      {persona.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Add confirmation modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Confirmation
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this chat session? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Menu, 
  Moon, 
  Sun, 
  Mic, 
  Image as ImageIcon, 
  X,
  Loader2,
  Paperclip,
  Wand2
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { ChatMessage } from './components/ChatMessage';
import { Sidebar } from './components/Sidebar';
import { Message, ChatSession } from './types';
import { streamTextChat, generateOrEditImage } from './services/gemini';
import { useVoice } from './hooks/useVoice';

export default function App() {
  // --- State ---
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Image handling
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice
  const { isListening, transcript, startListening, stopListening, setTranscript } = useVoice();

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Initialize theme
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem('nanoGeniusSessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        } else {
          createNewSession();
        }
      } catch (e) {
        createNewSession();
      }
    } else {
      createNewSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save history
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('nanoGeniusSessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Sync voice transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, isLoading]);

  // --- Helpers ---

  const getCurrentMessages = () => {
    const session = sessions.find(s => s.id === currentSessionId);
    return session ? session.messages : [];
  };

  const updateCurrentSession = (newMessages: Message[], title?: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          messages: newMessages,
          updatedAt: Date.now(),
          title: title || s.title || newMessages[0]?.text?.slice(0, 30) || 'New Chat'
        };
      }
      return s;
    }));
  };

  const createNewSession = () => {
    const newId = uuidv4();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setSidebarOpen(false);
    setInput('');
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    localStorage.setItem('nanoGeniusSessions', JSON.stringify(newSessions));
    
    if (currentSessionId === id) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const clearAttachment = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Core Logic ---

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading || !currentSessionId) return;

    const userText = input.trim();
    const currentMessages = getCurrentMessages();

    // 1. Create User Message
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      text: userText,
      imageUrl: previewUrl || undefined,
      timestamp: Date.now()
    };

    const newMessages = [...currentMessages, userMsg];
    updateCurrentSession(newMessages); // Optimistic update
    setInput('');
    setTranscript('');
    clearAttachment(); // Clear preview, but keep file ref for a moment if needed (logic handled by not clearing until sent) -> actually clears state, but we have dataUrl in msg

    setIsLoading(true);

    try {
      // 2. Determine Action: Text Chat OR Image Gen/Edit
      const isImageRequest = selectedFile !== null || 
        userText.toLowerCase().match(/^(generate|draw|create|paint|render|add|remove|change|make)\b/i);

      if (isImageRequest) {
        // --- Image Generation / Editing (Nano Banana) ---
        let base64Image: string | undefined = undefined;
        
        if (selectedFile) {
            // Convert file to base64
            const reader = new FileReader();
            base64Image = await new Promise((resolve) => {
                reader.onload = (e) => {
                    const res = e.target?.result as string;
                    resolve(res.split(',')[1]);
                };
                reader.readAsDataURL(selectedFile);
            });
        }

        const result = await generateOrEditImage(userText || "Describe this image", base64Image);
        
        const botMsg: Message = {
          id: uuidv4(),
          role: 'model',
          text: result.text,
          imageUrl: result.imageUrl,
          timestamp: Date.now()
        };
        updateCurrentSession([...newMessages, botMsg]);

      } else {
        // --- Text Chat (Streaming) ---
        // Placeholder for bot message
        const botMsgId = uuidv4();
        const initialBotMsg: Message = {
          id: botMsgId,
          role: 'model',
          text: '',
          timestamp: Date.now()
        };
        
        let updatedWithBot = [...newMessages, initialBotMsg];
        updateCurrentSession(updatedWithBot);

        // Stream response
        const stream = await streamTextChat(newMessages, userText);
        let accumulatedText = '';

        for await (const chunk of stream) {
          accumulatedText += chunk;
          updatedWithBot = updatedWithBot.map(m => 
            m.id === botMsgId ? { ...m, text: accumulatedText } : m
          );
          updateCurrentSession(updatedWithBot);
        }
      }

    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: uuidv4(),
        role: 'model',
        text: "Sorry, I encountered an error processing your request. Please try again.",
        isError: true,
        timestamp: Date.now()
      };
      updateCurrentSession([...newMessages, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Render ---

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 font-sans">
      
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={createNewSession}
        onDeleteSession={deleteSession}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        
        {/* Header */}
        <header className="flex-shrink-0 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg md:hidden text-gray-600 dark:text-gray-300 transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
                <span className="text-xl">🍌</span>
                <h1 className="font-bold text-xl text-gray-800 dark:text-white hidden sm:block">
                NanoGenius
                </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
          <div className="max-w-3xl mx-auto flex flex-col min-h-full">
            {getCurrentMessages().length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-80 mt-10 md:mt-0">
                <div className="bg-brand-100 dark:bg-brand-900/30 p-6 rounded-3xl mb-6">
                    <Wand2 size={48} className="text-brand-500 dark:text-brand-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">
                  How can I help you today?
                </h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
                  I can answer questions, generate images, or edit photos you upload. Just ask!
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  <button 
                    onClick={() => { setInput("Generate a cyberpunk city with neon lights"); }}
                    className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-400 dark:hover:border-brand-500 transition-colors text-sm text-left text-gray-600 dark:text-gray-300"
                  >
                    🎨 Generate a cyberpunk city
                  </button>
                  <button 
                     onClick={() => { setInput("Explain quantum physics in simple terms"); }}
                    className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-400 dark:hover:border-brand-500 transition-colors text-sm text-left text-gray-600 dark:text-gray-300"
                  >
                    🧠 Explain quantum physics
                  </button>
                  <button 
                     onClick={() => { setInput("Add a vintage filter to this image"); }}
                    className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-400 dark:hover:border-brand-500 transition-colors text-sm text-left text-gray-600 dark:text-gray-300"
                  >
                    📸 Add vintage filter (upload image)
                  </button>
                   <button 
                     onClick={() => { setInput("What is the history of Rome?"); }}
                    className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-400 dark:hover:border-brand-500 transition-colors text-sm text-left text-gray-600 dark:text-gray-300"
                  >
                    🏛️ History of Rome
                  </button>
                </div>
              </div>
            ) : (
              getCurrentMessages().map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))
            )}
            {isLoading && (
              <div className="flex justify-start mb-6 w-full">
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm">
                   <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-3xl mx-auto">
            {previewUrl && (
              <div className="mb-3 relative inline-block">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="h-20 w-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                />
                <button
                  onClick={clearAttachment}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            
            <div className="flex items-end gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-2xl border border-transparent focus-within:border-brand-400 dark:focus-within:border-brand-600 transition-colors">
              {/* Image Upload Button */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                title="Upload image"
              >
                <Paperclip size={20} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />

              {/* Text Area */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening..." : "Type a message, or describe an image edit..."}
                className="flex-1 bg-transparent border-0 focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 resize-none py-3 max-h-32 scrollbar-none"
                rows={1}
                style={{ minHeight: '48px' }}
              />

              {/* Voice Button */}
              <button
                onClick={isListening ? stopListening : startListening}
                className={`p-3 rounded-xl transition-all duration-300 ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse-fast' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-brand-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title="Voice input"
              >
                <Mic size={20} />
              </button>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !selectedFile)}
                className="p-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center"
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
             <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-2">
               Gemini can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

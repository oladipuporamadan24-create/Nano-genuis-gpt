import React from 'react';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession
}) => {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`fixed md:relative top-0 left-0 h-full w-72 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out z-30 ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🍌</span> NanoGenius
            </h2>
            <button onClick={onClose} className="md:hidden p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 rounded">
              <X size={20} />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <button
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onClose();
              }}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white py-3 px-4 rounded-xl font-medium transition-colors shadow-sm"
            >
              <Plus size={20} />
              New Chat
            </button>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            {sessions.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-gray-500 mt-10 text-sm">
                No history yet.
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      onSelectSession(session.id);
                      if (window.innerWidth < 768) onClose();
                    }}
                    className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      currentSessionId === session.id
                        ? 'bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <MessageSquare size={18} className="flex-shrink-0 opacity-70" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {session.title || 'New Conversation'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => onDeleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded transition-opacity"
                      aria-label="Delete chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

           {/* Footer */}
           <div className="p-4 border-t border-gray-200 dark:border-gray-800">
             <div className="text-xs text-center text-gray-400 dark:text-gray-600">
               Powered by Gemini 2.5
             </div>
           </div>
        </div>
      </aside>
    </>
  );
};

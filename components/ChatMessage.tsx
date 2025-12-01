import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { Bot, User, AlertCircle } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${
          isUser ? 'bg-brand-500 text-white' : isError ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {isUser ? <User size={20} /> : isError ? <AlertCircle size={20} /> : <Bot size={20} />}
        </div>

        {/* Content Bubble */}
        <div className={`flex flex-col gap-2 p-3 md:p-4 rounded-2xl shadow-sm ${
          isUser 
            ? 'bg-brand-500 text-white rounded-tr-none' 
            : isError 
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-tl-none'
              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-none'
        }`}>
          
          {/* Text Content */}
          {message.text && (
            <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
              <ReactMarkdown>{message.text}</ReactMarkdown>
            </div>
          )}

          {/* Image Content */}
          {message.imageUrl && (
            <div className="mt-2">
              <img 
                src={message.imageUrl} 
                alt="Generated or uploaded content" 
                className="rounded-lg max-h-80 md:max-h-96 w-auto object-cover border border-gray-200 dark:border-gray-600"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

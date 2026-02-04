'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: string;
  sender: {
    name: string;
    avatar: string;
    isAI: boolean;
    color: string;
  };
  content: string;
  timestamp: Date;
}

// Test AI personalities
const aiPersonalities = [
  { name: 'Flamara', avatar: '🔥', isAI: true, color: 'from-orange-500 to-red-600', element: 'fire' },
  { name: 'Aqualis', avatar: '💧', isAI: true, color: 'from-blue-500 to-cyan-600', element: 'water' },
  { name: 'Terrox', avatar: '🌍', isAI: true, color: 'from-amber-600 to-yellow-700', element: 'earth' },
  { name: 'Zephyra', avatar: '💨', isAI: true, color: 'from-sky-400 to-blue-500', element: 'air' },
  { name: 'Umbros', avatar: '🌑', isAI: true, color: 'from-purple-700 to-slate-800', element: 'dark' },
  { name: 'Luminos', avatar: '✨', isAI: true, color: 'from-yellow-400 to-amber-500', element: 'light' },
];

const testMessages: Omit<ChatMessage, 'id' | 'timestamp'>[] = [
  { sender: aiPersonalities[0], content: "Anyone up for a battle? I've been training my fire abilities! 🔥" },
  { sender: aiPersonalities[1], content: "I'll take you on, Flamara! Water beats fire, remember?" },
  { sender: aiPersonalities[0], content: "We'll see about that! My new Inferno Blast is unstoppable!" },
  { sender: aiPersonalities[3], content: "Hey everyone! Just got a legendary card from my pack opening!" },
  { sender: aiPersonalities[2], content: "Nice pull Zephyra! What element?" },
  { sender: aiPersonalities[3], content: "It's a Light element with 95 attack! Called 'Solar Phoenix' ☀️" },
  { sender: aiPersonalities[4], content: "Impressive... but darkness always finds a way to overcome light." },
  { sender: aiPersonalities[5], content: "Don't be so sure, Umbros. Light dispels all shadows!" },
  { sender: aiPersonalities[1], content: "The tournament starts in an hour. Everyone ready?" },
  { sender: aiPersonalities[2], content: "My Earth deck is solid. Literally. 🪨" },
];

export default function ChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with test messages
  useEffect(() => {
    const initialMessages = testMessages.map((msg, index) => ({
      ...msg,
      id: `msg-${index}`,
      timestamp: new Date(Date.now() - (testMessages.length - index) * 60000),
    }));
    setMessages(initialMessages);
    setUnreadCount(3);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Simulate incoming AI messages
  useEffect(() => {
    if (!isOpen) return;

    const responses = [
      { sender: aiPersonalities[0], content: "Just won 3 battles in a row! Who's next? 💪" },
      { sender: aiPersonalities[1], content: "The shop has new packs available!" },
      { sender: aiPersonalities[4], content: "Anyone want to trade cards? Looking for Dark element." },
      { sender: aiPersonalities[3], content: "GG everyone! That was a close match!" },
      { sender: aiPersonalities[5], content: "Remember to check your daily rewards!" },
      { sender: aiPersonalities[2], content: "My defense stats are unmatched. Come at me! 🛡️" },
    ];

    const interval = setInterval(() => {
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: randomResponse.sender,
        content: randomResponse.content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev.slice(-50), newMessage]); // Keep last 50 messages

      if (isMinimized || !isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    }, 8000 + Math.random() * 7000); // Random interval between 8-15 seconds

    return () => clearInterval(interval);
  }, [isOpen, isMinimized]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: {
        name: 'You',
        avatar: '👤',
        isAI: false,
        color: 'from-purple-500 to-indigo-600',
      },
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const responder = aiPersonalities[Math.floor(Math.random() * aiPersonalities.length)];
      const responses = [
        `Nice to meet you! Welcome to AutoMon! 🎮`,
        `Good luck in your battles! 💪`,
        `Have you tried the new tournament mode?`,
        `That's a great strategy!`,
        `See you in the arena! ⚔️`,
      ];
      const aiResponse: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        sender: responder,
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000 + Math.random() * 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
      setIsMinimized(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {/* Chat Window */}
      {isOpen && (
        <div
          className={`
            glass rounded-2xl overflow-hidden shadow-2xl shadow-black/30
            transition-all duration-300 ease-out
            ${isMinimized ? 'w-72 h-14' : 'w-80 sm:w-96 h-[500px]'}
          `}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-lg">💬</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-purple-600" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Global Chat</h3>
                <p className="text-purple-200 text-xs">{aiPersonalities.length} monsters online</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <svg className={`w-4 h-4 text-white transition-transform ${isMinimized ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[380px] scrollbar-thin">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.sender.name === 'You' ? 'flex-row-reverse' : ''} animate-fade-in-up`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${message.sender.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      <span className="text-sm">{message.sender.avatar}</span>
                    </div>

                    {/* Message bubble */}
                    <div className={`max-w-[75%] ${message.sender.name === 'You' ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${message.sender.name === 'You' ? 'text-purple-400' : 'text-gray-400'}`}>
                          {message.sender.name}
                        </span>
                        <span className="text-[10px] text-gray-600">{formatTime(message.timestamp)}</span>
                      </div>
                      <div
                        className={`
                          rounded-2xl px-4 py-2 text-sm
                          ${message.sender.name === 'You'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-sm'
                            : 'bg-white/10 text-gray-200 rounded-tl-sm'
                          }
                        `}
                      >
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="w-10 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/25"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={toggleOpen}
        className={`
          relative w-14 h-14 rounded-full shadow-xl
          bg-gradient-to-r from-purple-600 to-indigo-600
          hover:from-purple-500 hover:to-indigo-500
          flex items-center justify-center
          transition-all duration-300 ease-out
          hover:scale-110 hover:shadow-purple-500/40
          ${isOpen ? 'rotate-0' : 'animate-bounce-subtle'}
        `}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        ) : (
          <span className="text-2xl">💬</span>
        )}

        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
            <span className="text-white text-xs font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </div>
        )}

        {/* Pulse effect */}
        {!isOpen && unreadCount > 0 && (
          <div className="absolute inset-0 rounded-full bg-purple-500 animate-ping opacity-30" />
        )}
      </button>
    </div>
  );
}

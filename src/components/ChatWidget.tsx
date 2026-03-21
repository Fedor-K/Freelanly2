'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

function renderMessageContent(content: string) {
  // Split by URLs and render them as clickable links
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const parts = content.split(urlRegex);

  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex
      urlRegex.lastIndex = 0;
      const displayUrl = part.replace('https://freelanly.com', 'freelanly.com').replace('https://', '');
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium hover:opacity-80"
        >
          {displayUrl}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Stable chat session ID per browser tab
const chatSessionId = typeof window !== 'undefined'
  ? `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  : '';

// Notification sound (short beep via Web Audio API)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gain.gain.value = 0.15;
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch {}
}

export function ChatWidget() {
  const [userStatus, setUserStatus] = useState<'anonymous' | 'FREE' | 'PRO'>('anonymous');
  const [isOpen, setIsOpen] = useState(false);

  // Fetch user status without useSession (avoids SSG issues)
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data?.user) {
          setUserStatus((data.user as { plan?: string }).plan === 'PRO' ? 'PRO' : 'FREE');
        }
      })
      .catch(() => {});
  }, []);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hey! 👋 How can I help you today? Ask me anything about Freelanly or finding remote jobs.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-show bubble after 12 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen && !bubbleDismissed) {
        setShowBubble(true);
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [isOpen, bubbleDismissed]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-8),
          sessionId: chatSessionId,
          userStatus,
        }),
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      playNotificationSound();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again or email info@freelanly.com.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed top-0 left-0 right-0 bottom-0 h-[100dvh] sm:inset-auto sm:bottom-20 sm:right-6 sm:w-96 sm:h-auto sm:max-h-[70vh] sm:rounded-2xl bg-white shadow-2xl border flex flex-col z-[9999] overflow-hidden">
          {/* Header */}
          <div className="bg-black text-white px-4 py-3 flex items-center justify-between shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="font-semibold text-sm">Freelanly Support</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-black text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-md">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3 shrink-0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={loading}
                className="flex-1 min-w-0 px-3 py-2 text-sm border rounded-full focus:outline-none focus:border-black disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-9 h-9 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-30 transition-colors shrink-0 flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-1">
              Powered by AI · <a href="mailto:info@freelanly.com" className="underline">Email us</a> for complex questions
            </p>
          </div>
        </div>
      )}

      {/* Auto-popup bubble */}
      {showBubble && !isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-[9999] animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className="relative bg-white rounded-2xl shadow-lg border px-4 py-3 max-w-[260px]">
            <button
              onClick={(e) => { e.stopPropagation(); setShowBubble(false); setBubbleDismissed(true); }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-300 text-xs"
            >
              x
            </button>
            <button
              onClick={() => { setShowBubble(false); setBubbleDismissed(true); setIsOpen(true); }}
              className="text-left"
            >
              <p className="text-sm font-medium text-gray-800">Looking for a remote project or job? 👋</p>
              <p className="text-xs text-gray-500 mt-1">I can help you find the right one. Ask me anything!</p>
            </button>
            {/* Arrow pointing to button */}
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-b border-r transform rotate-45" />
          </div>
        </div>
      )}

      {/* Toggle Button — hidden on mobile when chat is open (fullscreen) */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowBubble(false);
          setBubbleDismissed(true);
        }}
        className={`fixed bottom-4 right-4 sm:right-6 w-14 h-14 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-all hover:scale-105 flex items-center justify-center z-[9999] ${isOpen ? 'hidden sm:flex' : ''}`}
        aria-label="Chat with us"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </>
  );
}

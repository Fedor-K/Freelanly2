'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

function renderMessageContent(content: string) {
  // Split by markdown links [text](url), raw URLs, and **bold**
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\)|https?:\/\/[^\s)]+|\*\*(.+?)\*\*)/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  let match;
  while ((match = tokenRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push(<span key={`t${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
    }

    if (match[2] !== undefined && match[3] !== undefined) {
      // Markdown link: [text](url)
      result.push(
        <a
          key={`l${match.index}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium hover:opacity-80"
        >
          {match[2]}
        </a>
      );
    } else if (match[4] !== undefined) {
      // Bold markdown: **text**
      result.push(<strong key={`b${match.index}`}>{match[4]}</strong>);
    } else {
      // Raw URL
      const displayUrl = match[0].replace('https://freelanly.com', 'freelanly.com').replace('https://', '');
      result.push(
        <a
          key={`u${match.index}`}
          href={match[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium hover:opacity-80"
        >
          {displayUrl}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    result.push(<span key={`t${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }

  return result.length > 0 ? result : [<span key="empty">{content}</span>];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  buttons?: Array<{ label: string; value: string }>;
}

// Stable chat session ID per browser tab — also stored in localStorage for registration linking
const chatSessionId = typeof window !== 'undefined'
  ? `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  : '';

// Store chat session for registration linking
if (typeof window !== 'undefined' && chatSessionId) {
  window.localStorage.setItem('_chatSessionId', chatSessionId);
}

// Persistent AudioContext — must be created on user gesture (click)
let audioCtx: AudioContext | null = null;

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playNotificationSound() {
  try {
    const ctx = audioCtx;
    if (!ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  } catch {}
}

// Category buttons for initial greeting and "Different category" flow
const CATEGORY_BUTTONS: Array<{ label: string; value: string }> = [
  { label: 'Development', value: 'Development' },
  { label: 'Design', value: 'Design' },
  { label: 'Translation', value: 'Translation' },
  { label: 'Marketing', value: 'Marketing' },
  { label: 'Writing', value: 'Writing' },
  { label: 'Data & Analytics', value: 'Data & Analytics' },
  { label: 'Other', value: 'Other' },
];

export function ChatWidget() {
  const [userStatus, setUserStatus] = useState<'anonymous' | 'FREE' | 'PRO'>('anonymous');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch user status without useSession (avoids SSG issues)
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data?.user) {
          const u = data.user as { plan?: string; email?: string; id?: string };
          setUserStatus(u.plan === 'PRO' ? 'PRO' : 'FREE');
          setUserEmail(u.email || null);
          setUserId(u.id || null);
        }
      })
      .catch(() => {});
  }, []);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hey! \u{1F44B} What kind of remote work are you looking for?',
      buttons: CATEGORY_BUTTONS,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input from external JS (e.g. browser extensions, automation)
  // React ignores programmatic input.value = 'x'. External code should use:
  //   const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  //   nativeSet.call(input, 'text');
  //   input.dispatchEvent(new Event('input', { bubbles: true }));
  // This listener catches that dispatched event.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = () => setInput(el.value);
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, []);

  // Bubble is only shown via explicit user action (click on chat button), not auto-popup

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Payment-abandon win-back: the top-up wall dispatches 'freelanly:payment-abandoned' when it is
  // closed without a completed payment. Pop the chat ONCE with reason chips — recover the sale (or at
  // least learn why they bailed). api/chat answers these chips deterministically.
  const abandonHandled = useRef(false);
  useEffect(() => {
    function onAbandon(e: Event) {
      if (abandonHandled.current) return;
      abandonHandled.current = true;
      const detail = ((e as CustomEvent).detail || {}) as { reason?: string };
      const cardErr = detail.reason === 'card_error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: cardErr
            ? "Looks like your card didn't go through — that happens a lot with cards from certain countries, it's not you. What happened?"
            : "Noticed you didn't finish topping up — mind telling me what stopped you? I might be able to help. \u{1F642}",
          buttons: [
            { label: 'My card was declined', value: 'My card was declined' },
            { label: "It's too expensive", value: "It's too expensive" },
            { label: 'Just browsing', value: 'Just browsing' },
            { label: 'Something else', value: 'Something else' },
          ],
        },
      ]);
      setIsOpen(true);
      setShowBubble(false);
    }
    window.addEventListener('freelanly:payment-abandoned', onAbandon);
    return () => window.removeEventListener('freelanly:payment-abandoned', onAbandon);
  }, []);

  const sendMessage = async (text?: string, isQuickReply?: boolean) => {
    const rawText = text || input.trim();
    if (!rawText || loading) return;
    // Truncate to prevent crashes with extremely long messages
    const messageText = rawText.substring(0, 1000);

    // Init audio on user gesture (required for iOS)
    ensureAudioContext();

    // Mark that user interacted with chatbot — for conversion tracking
    if (!localStorage.getItem('_chatbot_interacted')) {
      localStorage.setItem('_chatbot_interacted', '1');
      // If no utm_source set yet, attribute to chatbot
      if (!localStorage.getItem('_utm_source')) {
        const expiry = Date.now() + 90 * 24 * 60 * 60 * 1000;
        localStorage.setItem('_utm_source', JSON.stringify({ value: 'chatbot', expires: expiry }));
      }
    }

    const userMsg: Message = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, userMsg]);
    if (!text) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          sessionId: chatSessionId,
          userStatus,
          userEmail: userEmail || undefined,
          userId: userId || undefined,
          quickReply: isQuickReply || false,
        }),
      });

      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply,
      };
      if (data.buttons && Array.isArray(data.buttons) && data.buttons.length > 0) {
        assistantMsg.buttons = data.buttons;
      }
      setMessages((prev) => [...prev, assistantMsg]);
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

  const handleButtonClick = (value: string) => {
    if (loading) return;
    sendMessage(value, true);
  };

  // Find last assistant message with buttons — only that one should be active
  const lastButtonMsgIndex = messages.reduce((acc, msg, idx) =>
    msg.role === 'assistant' && msg.buttons && msg.buttons.length > 0 ? idx : acc, -1);

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
              <div key={i}>
                <div
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words overflow-hidden ${
                      msg.role === 'user'
                        ? 'bg-black text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}
                  >
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
                {/* Quick reply buttons — only active on the last assistant message */}
                {msg.buttons && msg.buttons.length > 0 && msg.role === 'assistant' && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                    {msg.buttons.map((btn, j) => {
                      const isActive = i === lastButtonMsgIndex;
                      return (
                        <button
                          key={j}
                          onClick={() => isActive ? handleButtonClick(btn.value) : undefined}
                          disabled={loading || !isActive}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            isActive
                              ? 'bg-white border border-gray-300 hover:bg-gray-50 hover:border-black'
                              : 'bg-gray-50 border border-gray-200 text-gray-400'
                          }`}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                maxLength={1000}
                disabled={loading}
                className="flex-1 min-w-0 px-3 py-2 text-sm border rounded-full focus:outline-none focus:border-black disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
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
              <p className="text-sm font-medium text-gray-800">{'\u{1F44B}'} Hey! Looking for remote work?</p>
              <p className="text-xs text-gray-500 mt-1">I can find matching projects for you in 30 seconds</p>
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
        className={`fixed bottom-4 right-4 sm:right-6 w-14 h-14 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-all hover:scale-105 flex items-center justify-center z-[10000] ${isOpen ? 'sm:flex' : ''}`}
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

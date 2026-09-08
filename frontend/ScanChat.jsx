import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from './api';

/* ── Markdown-like renderer for AI responses ───────────────── */
function formatMessage(text) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'code';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-3 rounded-xl overflow-hidden border border-white/10">
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/10">
            <span className="text-[10px] font-mono text-[#8B98A9] uppercase">{lang}</span>
            <CopyCodeButton code={codeLines.join('\n')} />
          </div>
          <pre className="p-3 bg-black/50 text-[12px] font-mono text-emerald-300/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {codeLines.join('\n')}
          </pre>
        </div>
      );
      i++;
      continue;
    }

    // Heading
    if (line.startsWith('### ')) {
      elements.push(<p key={i} className="font-bold text-white text-[14px] mt-3 mb-1">{line.slice(4)}</p>);
    } else if (line.startsWith('## ')) {
      elements.push(<p key={i} className="font-bold text-white text-[15px] mt-3 mb-1">{line.slice(3)}</p>);
    }
    // Bullet
    else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-[#7C6FFF] mt-1 shrink-0 text-[10px]">▸</span>
          <span className="text-[13.5px] leading-relaxed">{inlineFormat(line.slice(2))}</span>
        </div>
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)[1];
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-[#7C6FFF] shrink-0 font-mono text-[11px] mt-0.5 w-4">{num}.</span>
          <span className="text-[13.5px] leading-relaxed">{inlineFormat(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      );
    }
    // Bold line (e.g. **Label:**)
    else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(
        <p key={i} className="text-[13.5px] leading-relaxed">
          {inlineFormat(line)}
        </p>
      );
    }
    i++;
  }

  return <div className="flex flex-col gap-0.5">{elements}</div>;
}

function inlineFormat(text) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[11.5px] text-[#A78BFA] border border-white/10">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function CopyCodeButton({ code }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[#8B98A9] hover:text-white transition-all cursor-pointer"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

/* ── Typing indicator ─────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 px-1">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C6FFF] to-[#C084FC] flex items-center justify-center shrink-0 shadow-lg shadow-[#7C6FFF]/30">
        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-[#1B2430] border border-white/10 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#7C6FFF] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Quick prompt chips ──────────────────────────────────── */
const QUICK_PROMPTS = [
  'What are the most critical vulnerabilities?',
  'How do I fix the highest severity issues?',
  'Give me a prioritized remediation plan',
  'Explain my security score',
  'What is my biggest risk right now?',
  'How do I improve my SSL/TLS config?',
];

/* ── Main ScanChat Component ─────────────────────────────── */
export default function ScanChat({ scanId, targetUrl, score, initialMessages, onMessagesChange }) {
  const hasHistory = initialMessages && initialMessages.length > 0;

  const [messages, setMessages]   = useState(() => hasHistory ? initialMessages : []);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');
  const [showQuick, setShowQuick] = useState(!hasHistory);

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const messagesRef = useRef([]);

  // Sync ref for use in callbacks
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Notify parent whenever messages change (for cross-scan history persistence)
  useEffect(() => {
    if (onMessagesChange && messages.length > 0) onMessagesChange(messages);
  }, [messages]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Show welcome message only on first visit (no saved history)
  useEffect(() => {
    if (!scanId || hasHistory) return;
    setMessages([{
      id: 'welcome',
      role: 'ai',
      text: `👋 Hi! I'm **Vulnora AI** — I've analyzed the security scan for **${targetUrl || 'your target'}**.\n\nYour security score is **${score ?? 'N/A'}/100**. Ask me anything about the findings, how to fix vulnerabilities, or how to improve your overall security posture.`,
      timestamp: new Date(),
    }]);
  }, [scanId]);

  const sendMessage = useCallback(async (messageText) => {
    const text = (messageText || input).trim();
    if (!text || isLoading || !scanId) return;

    setInput('');
    setError('');
    setShowQuick(false);

    const userMsg = { id: `u-${Date.now()}`, role: 'user', text, timestamp: new Date() };
    const currentHistory = messagesRef.current.filter(m => m.id !== 'welcome');

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const historyPayload = currentHistory.map(m => ({ role: m.role, text: m.text }));
      const result = await sendChatMessage(scanId, text, historyPayload);

      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        text: result.reply,
        model: result.model,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setError(err.message || 'Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isLoading, scanId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'ai',
      text: `Chat cleared. Ask me anything about the scan for **${targetUrl || 'your target'}**!`,
      timestamp: new Date(),
    }]);
    setShowQuick(true);
    setError('');
  };

  if (!scanId) return null;

  return (
    <div className="w-full rounded-3xl overflow-hidden shadow-2xl animate-fadeIn" style={{
      background: 'rgba(18,24,38,0.85)',
      border: '1px solid rgba(124,111,255,0.25)',
      boxShadow: '0 0 60px rgba(124,111,255,0.12), 0 30px 80px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(24px)',
      animation: 'fadeSlideIn 0.35s ease-out both',
    }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10"
        style={{ background: 'linear-gradient(135deg, rgba(124,111,255,0.15) 0%, rgba(192,132,252,0.08) 100%)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* AI Avatar */}
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C6FFF] to-[#C084FC] flex items-center justify-center shadow-lg shadow-[#7C6FFF]/40">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] border-2 border-[#121826]" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[15px] text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Vulnora AI
            </p>
            {/* Active scan URL — key visual indicator of which report is loaded */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FFF] shrink-0" />
              <p className="text-[11px] text-[#A78BFA] font-mono truncate max-w-[260px]" title={targetUrl}>
                {targetUrl || 'No scan loaded'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Score pill */}
          {score !== null && score !== undefined && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border"
              style={{
                background: score >= 80 ? 'rgba(16,185,129,0.15)' : score >= 50 ? 'rgba(245,166,35,0.15)' : 'rgba(255,92,92,0.15)',
                borderColor: score >= 80 ? 'rgba(16,185,129,0.4)' : score >= 50 ? 'rgba(245,166,35,0.4)' : 'rgba(255,92,92,0.4)',
                color: score >= 80 ? '#10B981' : score >= 50 ? '#F5A623' : '#FF5C5C',
              }}>
              Score {score}/100
            </span>
          )}
          {/* Clear button */}
          <button
            onClick={clearChat}
            title="Clear chat"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[#8B98A9] hover:text-white transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.56" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="h-[420px] overflow-y-auto px-5 py-4 flex flex-col gap-4 scroll-smooth"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(124,111,255,0.3) transparent' }}>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            {msg.role === 'ai' ? (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C6FFF] to-[#C084FC] flex items-center justify-center shrink-0 shadow-md shadow-[#7C6FFF]/30 mb-0.5">
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mb-0.5">
                <svg className="w-3.5 h-3.5 text-white/70" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}

            {/* Bubble */}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
              msg.role === 'user'
                ? 'rounded-br-sm text-white'
                : 'rounded-bl-sm text-[#C5CDD9]'
              }`}
              style={msg.role === 'user' ? {
                background: 'linear-gradient(135deg, #7C6FFF, #A855F7)',
                boxShadow: '0 4px 20px rgba(124,111,255,0.35)',
              } : {
                background: 'rgba(27,36,48,0.9)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {msg.role === 'ai' ? formatMessage(msg.text) : (
                <p className="text-[13.5px] leading-relaxed">{msg.text}</p>
              )}

              <div className={`flex items-center gap-2 mt-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <span className="text-[10px] opacity-50 font-mono">
                  {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'ai' && msg.model && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[#8B98A9]">
                    {msg.model}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && <TypingIndicator />}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-[#FF5C5C] text-[12.5px]">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto text-[10px] underline cursor-pointer hover:no-underline">dismiss</button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick prompts ── */}
      {showQuick && messages.length <= 1 && (
        <div className="px-5 pb-3">
          <p className="text-[10.5px] font-mono text-[#57657A] uppercase tracking-wider mb-2">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                disabled={isLoading}
                className="text-[12px] px-3 py-1.5 rounded-full border border-[#7C6FFF]/30 bg-[#7C6FFF]/10 text-[#A78BFA] hover:bg-[#7C6FFF]/25 hover:border-[#7C6FFF]/60 hover:text-white transition-all cursor-pointer disabled:opacity-40 font-medium"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="px-5 pb-5">
        <div className="flex items-end gap-3 p-2 rounded-2xl transition-all"
          style={{
            background: 'rgba(10,14,20,0.8)',
            border: '1px solid rgba(124,111,255,0.3)',
            boxShadow: '0 0 20px rgba(124,111,255,0.08)',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask about your vulnerabilities, fixes, or security posture…"
            rows={1}
            className="flex-1 bg-transparent resize-none px-3 py-2.5 text-white placeholder-white/30 focus:outline-none text-[13.5px] leading-relaxed min-h-[42px] max-h-[120px] overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
          />

          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: input.trim() && !isLoading
                ? 'linear-gradient(135deg, #7C6FFF, #A855F7)'
                : 'rgba(255,255,255,0.08)',
              boxShadow: input.trim() && !isLoading ? '0 4px 15px rgba(124,111,255,0.4)' : 'none',
            }}
          >
            {isLoading ? (
              <svg className="w-4 h-4 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-center text-white/20 mt-2 font-mono">
          Enter to send · Shift+Enter for new line · Powered by Gemini AI
        </p>
      </div>
    </div>
  );
}

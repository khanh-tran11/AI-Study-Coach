import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendChat } from '../api';
import { PantherMark } from '../HartnellLogo';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ context = {}, defaultOpen = false }) {
  const [open,     setOpen]     = useState(defaultOpen);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm **Panther**, your Hartnell College Canvas guide 🐾\n\nI'm here to help with **${context.moduleTitle || 'this module'}**. What are you working on or stuck on?`,
    },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);

  // Re-greet when context step changes
  useEffect(() => {
    if (context.step_id) {
      setMessages([{
        role: 'assistant',
        content: `Now on **${context.moduleTitle || 'this step'}** — step \`${context.step_id}\`. Ask me anything about it!`,
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.step_id]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const { data } = await sendChat(newMessages, {
          tool_id:      context.tool_id      || 'canvas-lms',
          step_id:      context.step_id      || 'unknown',
          moduleTitle:  context.moduleTitle  || 'Canvas Training',
          s3LessonText: context.s3LessonText || '',
        });
      setMessages(m => [...m, data.reply]);
    } catch {
      setMessages(m => [...m, {
        role: 'assistant',
        content: "I couldn't reach the server. Check that the API is running and your `.env` has `OPENAI_API_KEY` set.",
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function renderContent(text) {
    // Minimal markdown: **bold**, `code`, newlines
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        className={styles.fab}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close Panther AI chat' : 'Open Panther AI chat'}
        title="Ask Panther"
      >
        <PantherMark size={36} />
        {!open && <span className={styles.fabLabel}>Ask Panther</span>}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, x: 80, scale: 0.96 }}
            animate={{ opacity: 1, x: 0,  scale: 1 }}
            exit={{   opacity: 0, x: 80,  scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            role="dialog"
            aria-label="Panther AI Assistant"
          >
            {/* Header */}
            <div className={styles.header}>
              <PantherMark size={28} />
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>Panther AI</span>
                <span className={styles.headerSub}>{context.moduleTitle || 'Canvas Guide'}</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            {/* Context chip */}
            {context.step_id && (
              <div className={styles.contextChip}>
                📍 Step: <code>{context.step_id}</code> · Tool: <code>{context.tool_id || 'canvas-lms'}</code>
              </div>
            )}

            {/* Messages */}
            <div className={styles.messages}>
              {messages.map((msg, i) => (
                <div key={i} className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.aiBubble}`}>
                  {msg.role === 'assistant' && <PantherMark size={20} />}
                  <div
                    className={styles.bubbleText}
                    dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                  />
                </div>
              ))}
              {loading && (
                <div className={`${styles.bubble} ${styles.aiBubble}`}>
                  <PantherMark size={20} />
                  <div className={styles.typing}>
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className={styles.inputRow}>
              <textarea
                ref={inputRef}
                className={styles.textarea}
                placeholder="Ask Panther anything about this step…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={2}
                disabled={loading}
              />
              <button
                className={styles.sendBtn}
                onClick={send}
                disabled={!input.trim() || loading}
                aria-label="Send message"
              >
                ➤
              </button>
            </div>
            <p className={styles.disclaimer}>Panther guides you — double-check critical steps in Canvas.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

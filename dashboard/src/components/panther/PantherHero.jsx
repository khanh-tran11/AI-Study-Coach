import { useState, useRef, useEffect, useCallback } from 'react';
import PantherAvatar from './PantherAvatar';
import styles from './PantherHero.module.css';

const CANNED_RESPONSES = [
  "Great question! Let me pull up that information for you.",
  "Based on your progress, I'd recommend focusing on Module 3 next.",
  "You're doing well! Here's a quick quiz question: What is the main difference between `let` and `const` in JavaScript?",
  "Your last session covered Introduction to React. Want to continue from where you left off?",
];

const SUGGESTED_PROMPTS = [
  "What should I study next?",
  "Explain my progress",
  "Quiz me on this module",
  "Summarize last session",
];

let responseIndex = 0;
function getNextResponse() {
  const response = CANNED_RESPONSES[responseIndex % CANNED_RESPONSES.length];
  responseIndex += 1;
  return response;
}

export default function PantherHero() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'panther',
      text: "Hello! I'm Panther, your learning assistant. How can I help you today?",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const logRef = useRef(null);

  // Scroll log to bottom whenever messages change
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');

    // Mock Panther reply after 500ms
    setTimeout(() => {
      const pantherMsg = {
        id: `panther-${Date.now()}`,
        sender: 'panther',
        text: getNextResponse(),
      };
      setMessages((prev) => [...prev, pantherMsg]);
    }, 500);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleChipClick = (prompt) => {
    sendMessage(prompt);
  };

  return (
    <section className={styles.hero} aria-label="Panther AI assistant">
      {/* Decorative scene background elements — all aria-hidden */}
      <div className={styles.sceneBackdrop} aria-hidden="true">
        {/* Radial glow behind avatar */}
        <div className={styles.glowOrb} />
        {/* Abstract decorative curves */}
        <svg className={styles.sceneCurves} viewBox="0 0 800 400" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0 300 Q200 250 400 280 T800 240"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="2"
          />
          <path
            d="M0 340 Q250 290 500 320 T800 280"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1.5"
          />
          <path
            d="M0 200 Q300 180 600 220 T800 180"
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          />
          {/* Floating abstract shapes */}
          <circle cx="120" cy="80" r="40" fill="rgba(255,255,255,0.02)" />
          <circle cx="680" cy="100" r="55" fill="rgba(255,255,255,0.015)" />
          <circle cx="600" cy="320" r="30" fill="rgba(255,255,255,0.02)" />
          <ellipse cx="200" cy="350" rx="60" ry="25" fill="rgba(255,255,255,0.015)" />
        </svg>
        {/* Vignette overlay */}
        <div className={styles.vignette} />
      </div>

      {/* Character identity block — centered above chat */}
      <div className={styles.characterBlock}>
        <PantherAvatar size={150} className={styles.avatarSize} />
        <span className={styles.name}>Panther</span>
        <span className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Online</span>
        </span>
      </div>

      {/* Message history */}
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Panther conversation"
        className={styles.messageLog}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.bubble} ${msg.sender === 'user' ? styles.bubbleUser : styles.bubblePanther}`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {/* Suggested prompt chips */}
      <div className={styles.chips} aria-label="Suggested prompts">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className={styles.chip}
            onClick={() => handleChipClick(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input area */}
      <form className={styles.inputRow} onSubmit={handleSubmit} noValidate>
        <label htmlFor="panther-input" className={styles.srOnly}>
          Message Panther
        </label>
        <input
          id="panther-input"
          type="text"
          className={styles.textInput}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask Panther anything..."
          autoComplete="off"
        />
        <button
          type="submit"
          className={styles.sendBtn}
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </section>
  );
}

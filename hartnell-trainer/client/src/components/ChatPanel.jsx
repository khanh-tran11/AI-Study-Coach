import { useState, useRef, useEffect } from 'react';
import { sendChat } from '../api';
import { PantherMark } from '../HartnellLogo';
import styles from './ChatPanel.module.css';

/** Parses quiz response into interactive multiple choice questions */
function QuizDisplay({ content }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  // Parse questions from the AI response
  const questions = [];
  const qBlocks = content.split(/\n*\d+[\.\)]\s*/).filter(Boolean);
  
  qBlocks.forEach((block) => {
    const lines = block.split('\n').filter(l => l.trim());
    if (lines.length < 2) return;
    
    const questionText = lines[0].replace(/^\*\*|\*\*$/g, '').trim();
    const options = [];
    let correctIdx = -1;

    lines.slice(1).forEach((line) => {
      const optMatch = line.match(/^[A-Da-d][\.\)]\s*(.+)/);
      if (optMatch) {
        const optText = optMatch[1].replace(/\*\*$/, '').replace(/\(correct\)/i, '').replace(/✓|✔|←/g, '').trim();
        if (line.toLowerCase().includes('correct') || line.includes('✓') || line.includes('✔') || line.includes('**')) {
          correctIdx = options.length;
        }
        options.push(optText);
      }
    });

    // If no correct marked, try the last option or first
    if (correctIdx === -1 && options.length > 0) {
      // Look for "Correct answer:" line
      const correctLine = lines.find(l => /correct\s*answer/i.test(l));
      if (correctLine) {
        const letter = correctLine.match(/[A-Da-d]/);
        if (letter) correctIdx = letter[0].toLowerCase().charCodeAt(0) - 97;
      }
      if (correctIdx === -1) correctIdx = 0;
    }

    if (questionText && options.length >= 2) {
      questions.push({ question: questionText, options, correctIdx });
    }
  });

  if (questions.length === 0) {
    return <span dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }} />;
  }

  const q = questions[currentQ];

  function handleSelect(idx) {
    if (showResult) return;
    setSelected(idx);
    setShowResult(true);
    if (idx === q.correctIdx) {
      setScore(s => s + 1);
    }
  }

  function handleNext() {
    if (currentQ + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setShowResult(false);
    }
  }

  if (finished) {
    return (
      <div className={styles.quizComplete}>
        <span className={styles.quizScore}>🎉 {score}/{questions.length}</span>
        <p>You got {score} out of {questions.length} correct!</p>
        <button className={styles.quizRetry} onClick={() => { setCurrentQ(0); setSelected(null); setShowResult(false); setScore(0); setFinished(false); }}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.quizContainer}>
      <div className={styles.quizProgress}>Question {currentQ + 1} of {questions.length}</div>
      <p className={styles.quizQuestion}>{q.question}</p>
      <div className={styles.quizOptions}>
        {q.options.map((opt, i) => {
          let optClass = styles.quizOption;
          if (showResult && i === q.correctIdx) optClass += ' ' + styles.quizCorrect;
          if (showResult && i === selected && i !== q.correctIdx) optClass += ' ' + styles.quizWrong;
          if (!showResult && i === selected) optClass += ' ' + styles.quizSelected;
          return (
            <button key={i} className={optClass} onClick={() => handleSelect(i)} disabled={showResult}>
              <span className={styles.quizLetter}>{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {showResult && (
        <div className={styles.quizFeedback}>
          {selected === q.correctIdx ? '✅ Correct!' : `❌ The answer is: ${q.options[q.correctIdx]}`}
          <button className={styles.quizNext} onClick={handleNext}>
            {currentQ + 1 >= questions.length ? 'See Results' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Parses "Front: ... Back: ..." text into interactive flip cards */
function FlashcardDisplay({ content }) {
  const [flipped, setFlipped] = useState({});

  // Try to parse Front:/Back: pairs
  const cards = [];
  
  // Method 1: Split by "Front:" 
  const frontSplits = content.split(/\n*Front:\s*/i).filter(Boolean);
  frontSplits.forEach((part) => {
    const backSplit = part.split(/\n*Back:\s*/i);
    if (backSplit.length >= 2) {
      cards.push({ front: backSplit[0].trim(), back: backSplit.slice(1).join('').trim() });
    }
  });

  // Method 2: If no Front/Back found, try splitting by numbered questions
  if (cards.length === 0) {
    const numbered = content.split(/\n\d+\.\s+/).filter(Boolean);
    if (numbered.length >= 3) {
      numbered.forEach((item) => {
        // Try to split on first sentence vs rest
        const sentences = item.split(/\?\s*/);
        if (sentences.length >= 2) {
          cards.push({ front: sentences[0].trim() + '?', back: sentences.slice(1).join(' ').trim() });
        }
      });
    }
  }

  // Method 3: If still nothing, split by double newline and pair question/answer
  if (cards.length === 0) {
    const lines = content.split('\n').filter(l => l.trim());
    for (let i = 0; i < lines.length - 1; i += 2) {
      const q = lines[i].replace(/^(Q|Question|Front)[\s:]*\d*[.:)\s]*/i, '').trim();
      const a = lines[i + 1].replace(/^(A|Answer|Back)[\s:]*\d*[.:)\s]*/i, '').trim();
      if (q && a) cards.push({ front: q, back: a });
    }
  }

  if (cards.length === 0) {
    return <span>{content}</span>;
  }

  return (
    <div className={styles.flashcardGrid}>
      {cards.map((card, i) => (
        <button
          key={i}
          className={`${styles.flashcard} ${flipped[i] ? styles.flashcardFlipped : ''}`}
          onClick={() => setFlipped(f => ({ ...f, [i]: !f[i] }))}
          aria-label={flipped[i] ? 'Show question' : 'Show answer'}
        >
          <div className={styles.flashcardInner}>
            <div className={styles.flashcardFront}>
              <span className={styles.flashcardLabel}>Q</span>
              <p>{card.front}</p>
            </div>
            <div className={styles.flashcardBack}>
              <span className={styles.flashcardLabel}>A</span>
              <p>{card.back}</p>
            </div>
          </div>
        </button>
      ))}
      <p className={styles.flashcardHint}>Click a card to flip it</p>
    </div>
  );
}

const ACTIVITIES = [
  { id: 'quiz', icon: '🧠', label: 'Quick Quiz', desc: 'Test your knowledge with questions', prompt: 'Based on the lesson content, create a 5-question multiple choice quiz. You MUST use EXACTLY this format for each question:\n\n1. [Question text]\nA. [Option]\nB. [Option]\nC. [Option]\nD. [Option]\nCorrect answer: [Letter]\n\nDo not add explanations between questions. Topic:' },
  { id: 'flashcards', icon: '🃏', label: 'Flashcards', desc: 'Key terms and definitions', prompt: 'Generate 6 flashcards about the following topic. You MUST use EXACTLY this format for each card:\n\nFront: [question here]\nBack: [answer here]\n\nDo not deviate from this format. Each card must start with "Front:" on its own line and "Back:" on its own line. Topic:' },
  { id: 'explain', icon: '📖', label: 'Explain Like I\'m New', desc: 'Simple breakdown of the topic', prompt: 'Explain in simple terms with examples about' },
  { id: 'scenarios', icon: '🎯', label: 'Real Scenarios', desc: 'Practice with realistic situations', prompt: 'Give me 3 realistic scenario-based questions about' },
  { id: 'steps', icon: '👣', label: 'Step-by-Step Guide', desc: 'Walkthrough of the process', prompt: 'Give me a detailed step-by-step guide for' },
  { id: 'mistakes', icon: '⚠️', label: 'Common Mistakes', desc: 'What to avoid and why', prompt: 'What are the most common mistakes people make with' },
];

export default function ChatPanel({ context = {} }) {
  const [open, setOpen] = useState(false);
  const [showActivities, setShowActivities] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const logRef = useRef(null);

  const moduleTitle = context.moduleTitle || 'this module';

  // Scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Reset when module changes
  useEffect(() => {
    setMessages([]);
    setShowActivities(true);
  }, [context.step_id]);

  function getWelcomeMessage() {
    return `Hey! I'm Panther 🐾 Ready to help you learn **${moduleTitle}**.\n\nChoose an activity below, or just ask me anything!`;
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setShowActivities(false);
    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const { data } = await sendChat(newMessages, context);
      setMessages(m => [...m, data.reply]);
    } catch {
      setMessages(m => [...m, {
        role: 'assistant',
        content: "Sorry, I couldn't connect right now. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleActivityClick(activity) {
    // Include lesson context so the AI has material to work with
    const lessonContext = context.s3LessonText || context.moduleTitle || '';
    const fullPrompt = `${activity.prompt} ${moduleTitle}. Here is the lesson content to base your response on: "${lessonContext}". Make it engaging and educational.`;
    setShowActivities(false);
    setLoading(true);

    // Don't show the prompt as a user message — show the activity label instead
    const userMsg = { role: 'user', content: `📌 ${activity.label}: ${moduleTitle}`, hidden: false };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Send the full prompt to the API
    sendChat([...newMessages, { role: 'user', content: fullPrompt }], context)
      .then(({ data }) => {
        setMessages(m => [...m, { ...data.reply, activityType: activity.id }]);
      })
      .catch(() => {
        setMessages(m => [...m, { role: 'assistant', content: "Sorry, I couldn't connect right now. Please try again." }]);
      })
      .finally(() => setLoading(false));
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function resetChat() {
    setMessages([]);
    setShowActivities(true);
  }

  function renderMarkdown(text) {
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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 220" aria-hidden="true" focusable="false" style={{height:'36px',width:'auto'}}>
          <g>
            <path d="M140 12 Q180 12 210 35 Q240 58 245 95 Q248 125 235 148 Q218 175 185 188 Q160 196 140 198 Q120 196 95 188 Q62 175 45 148 Q32 125 35 95 Q40 58 70 35 Q100 12 140 12 Z" fill="#2d2d45"/>
            <g><ellipse cx="32" cy="72" rx="18" ry="17" fill="#2d2d45"/><ellipse cx="32" cy="72" rx="11" ry="10" fill="#4a3f6b" opacity="0.6"/></g>
            <g><ellipse cx="248" cy="65" rx="18" ry="17" fill="#2d2d45"/><ellipse cx="248" cy="65" rx="11" ry="10" fill="#4a3f6b" opacity="0.6"/></g>
            <g>
              <g><ellipse cx="112" cy="78" rx="30" ry="28" fill="#dbeafe"/><ellipse cx="112" cy="80" rx="22" ry="22" fill="#60a5fa"/><circle cx="112" cy="82" r="11" fill="#0a0f1f"/><circle cx="120" cy="72" r="5.5" fill="#ffffff" opacity="0.92"/></g>
              <g><ellipse cx="168" cy="78" rx="30" ry="28" fill="#dbeafe"/><ellipse cx="168" cy="80" rx="22" ry="22" fill="#60a5fa"/><circle cx="168" cy="82" r="11" fill="#0a0f1f"/><circle cx="176" cy="72" r="5.5" fill="#ffffff" opacity="0.92"/></g>
            </g>
            <rect x="88" y="42" width="28" height="10" rx="2" fill="#1a1a2e" transform="rotate(-8, 102, 47)"/>
            <rect x="162" y="42" width="28" height="10" rx="2" fill="#1a1a2e" transform="rotate(8, 176, 47)"/>
            <path d="M75 125 Q80 108 105 102 Q125 97 140 96 Q155 97 175 102 Q200 108 205 125 Q210 145 200 162 Q185 180 140 182 Q95 180 80 162 Q70 145 75 125 Z" fill="#3a3a55"/>
            <path d="M100 122 Q110 112 140 110 Q170 112 180 122 Q185 138 180 152 Q170 165 140 167 Q110 165 100 152 Q95 138 100 122 Z" fill="#4a4a65"/>
            <path d="M130 125 L140 116 L150 125 Q145 131 140 133 Q135 131 130 125 Z" fill="#1a1a2e"/>
          </g>
        </svg>
        {!open && <span className={styles.fabLabel}>Ask Panther</span>}
        {open && <span className={styles.fabLabel}>✕</span>}
      </button>

      {/* Chat popup panel */}
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Panther AI Assistant">
          {/* Header */}
          <div className={styles.header}>
            {/* Panther Avatar — animated */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 220" aria-hidden="true" focusable="false" style={{height:'50px',width:'auto'}}>
              <g className={styles.bodyGroup}>
                <g>
                  <path d="M140 12 Q180 12 210 35 Q240 58 245 95 Q248 125 235 148 Q218 175 185 188 Q160 196 140 198 Q120 196 95 188 Q62 175 45 148 Q32 125 35 95 Q40 58 70 35 Q100 12 140 12 Z" fill="#2d2d45"/>
                  <g><ellipse cx="32" cy="72" rx="18" ry="17" fill="#2d2d45"/><ellipse cx="32" cy="72" rx="11" ry="10" fill="#4a3f6b" opacity="0.6"/></g>
                  <g><ellipse cx="248" cy="65" rx="18" ry="17" fill="#2d2d45"/><ellipse cx="248" cy="65" rx="11" ry="10" fill="#4a3f6b" opacity="0.6"/></g>
                  <g>
                    <g>
                      <ellipse cx="112" cy="78" rx="30" ry="28" fill="#dbeafe"/>
                      <ellipse cx="112" cy="80" rx="22" ry="22" fill="#60a5fa"/>
                      <circle cx="112" cy="82" r="11" fill="#0a0f1f"/>
                      <circle cx="120" cy="72" r="5.5" fill="#ffffff" opacity="0.92"/>
                      <ellipse cx="112" cy="78" rx="31" ry="29" fill="#2d2d45" className={styles.eyelid} style={{transformOrigin:'112px 78px'}}/>
                    </g>
                    <g>
                      <ellipse cx="168" cy="78" rx="30" ry="28" fill="#dbeafe"/>
                      <ellipse cx="168" cy="80" rx="22" ry="22" fill="#60a5fa"/>
                      <circle cx="168" cy="82" r="11" fill="#0a0f1f"/>
                      <circle cx="176" cy="72" r="5.5" fill="#ffffff" opacity="0.92"/>
                      <ellipse cx="168" cy="78" rx="31" ry="29" fill="#2d2d45" className={styles.eyelid} style={{transformOrigin:'168px 78px'}}/>
                    </g>
                  </g>
                  <rect x="88" y="42" width="28" height="10" rx="2" fill="#1a1a2e" transform="rotate(-8, 102, 47)"/>
                  <rect x="162" y="42" width="28" height="10" rx="2" fill="#1a1a2e" transform="rotate(8, 176, 47)"/>
                  <path d="M75 125 Q80 108 105 102 Q125 97 140 96 Q155 97 175 102 Q200 108 205 125 Q210 145 200 162 Q185 180 140 182 Q95 180 80 162 Q70 145 75 125 Z" fill="#3a3a55"/>
                  <path d="M100 122 Q110 112 140 110 Q170 112 180 122 Q185 138 180 152 Q170 165 140 167 Q110 165 100 152 Q95 138 100 122 Z" fill="#4a4a65"/>
                  <path d="M130 125 L140 116 L150 125 Q145 131 140 133 Q135 131 130 125 Z" fill="#1a1a2e"/>
                  <path d="M140 133 L140 142" fill="none" stroke="#1a1a2e" strokeWidth="2.2" strokeLinecap="round"/>
                  <path d="M112 150 Q125 158 140 158 Q155 158 168 150" fill="none" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M112 150 Q107 146 104 140" fill="none" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M78 135 Q50 126 8 130" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round"/>
                  <path d="M76 148 Q44 144 5 152" fill="none" stroke="#1a1a2e" strokeWidth="2.8" strokeLinecap="round"/>
                  <path d="M202 135 Q230 126 272 130" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round"/>
                  <path d="M204 148 Q236 144 275 152" fill="none" stroke="#1a1a2e" strokeWidth="2.8" strokeLinecap="round"/>
                </g>
              </g>
            </svg>
            <div className={styles.headerText}>
              <span className={styles.headerTitle}>Panther AI</span>
              <span className={styles.headerSub}>{moduleTitle}</span>
            </div>
            {messages.length > 0 && (
              <button className={styles.resetBtn} onClick={resetChat} aria-label="New conversation" title="Start over">↺</button>
            )}
            <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Minimize chat">—</button>
          </div>

          {/* Activity selection OR messages */}
          {showActivities && messages.length === 0 ? (
            <div className={styles.activityView}>
              <div className={styles.welcomeMsg}>
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(getWelcomeMessage()) }} />
              </div>
              <div className={styles.activityGrid}>
                {ACTIVITIES.map((activity) => (
                  <button
                    key={activity.id}
                    className={styles.activityCard}
                    onClick={() => handleActivityClick(activity)}
                    disabled={loading}
                  >
                    <span className={styles.activityIcon}>{activity.icon}</span>
                    <span className={styles.activityLabel}>{activity.label}</span>
                    <span className={styles.activityDesc}>{activity.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.messages} ref={logRef}>
              {messages.map((msg, i) => (
                <div key={i} className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                  {msg.activityType === 'flashcards' ? (
                    <FlashcardDisplay content={msg.content} />
                  ) : msg.activityType === 'quiz' ? (
                    <QuizDisplay content={msg.content} />
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  )}
                </div>
              ))}
              {loading && (
                <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                  <span className={styles.typing}>
                    <span /><span /><span />
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Input — always visible */}
          <form className={styles.inputRow} onSubmit={handleSubmit} noValidate>
            <input
              type="text"
              className={styles.textInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={loading ? 'Thinking...' : 'Or just ask me anything...'}
              autoComplete="off"
              disabled={loading}
            />
            <button type="submit" className={styles.sendBtn} aria-label="Send message" disabled={loading || !input.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

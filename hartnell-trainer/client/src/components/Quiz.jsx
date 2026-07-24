import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Quiz.module.css';

// ── Retry logic ─────────────────────────────────────────────────────────────
// Wrong answers go into a "retry queue". After finishing the deck once, the
// user is shown all previously-wrong questions again (new order). A variant
// question (suffix "– Try Again") is inserted after every wrong answer so
// the concept is reinforced immediately AND again at the end.
// ─────────────────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue(questions) {
  // Randomise option order for MC questions
  return questions.map(q =>
    q.type === 'multiple_choice'
      ? { ...q, options: shuffle(q.options) }
      : q
  );
}

export default function Quiz({ questions = [], onComplete }) {
  const [queue,      setQueue]      = useState(() => buildQueue(questions));
  const [qIndex,     setQIndex]     = useState(0);
  const [answer,     setAnswer]     = useState('');
  const [submitted,  setSubmitted]  = useState(false);
  const [correct,    setCorrect]    = useState(null);
  const [retryQueue, setRetryQueue] = useState([]);
  const [round,      setRound]      = useState(1);    // 1 = first pass, 2+ = retry
  const [score,      setScore]      = useState({ correct: 0, total: 0 });
  const [done,       setDone]       = useState(false);

  const q = queue[qIndex];

  const checkAnswer = useCallback(() => {
    if (!answer.trim()) return;
    const isCorrect =
      answer.trim().toLowerCase() === q.correct.trim().toLowerCase();

    setSubmitted(true);
    setCorrect(isCorrect);
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));

    if (!isCorrect) {
      // Queue a variant of this question for later retry
      setRetryQueue(rq => [...rq, { ...q, isRetry: true }]);
    }
  }, [answer, q]);

  function advance() {
    const next = qIndex + 1;
    if (next < queue.length) {
      setQIndex(next);
      setAnswer('');
      setSubmitted(false);
      setCorrect(null);
    } else if (retryQueue.length > 0) {
      // Start retry round
      setQueue(shuffle(retryQueue));
      setRetryQueue([]);
      setQIndex(0);
      setAnswer('');
      setSubmitted(false);
      setCorrect(null);
      setRound(r => r + 1);
    } else {
      setDone(true);
      onComplete?.();
    }
  }

  function restart() {
    setQueue(buildQueue(questions));
    setQIndex(0);
    setAnswer('');
    setSubmitted(false);
    setCorrect(null);
    setRetryQueue([]);
    setRound(1);
    setScore({ correct: 0, total: 0 });
    setDone(false);
  }

  const pct = Math.round((score.correct / Math.max(score.total, 1)) * 100);

  if (done) {
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}>{pct >= 80 ? '🏆' : '📚'}</div>
        <h3>{pct >= 80 ? 'Great work!' : 'Keep practicing!'}</h3>
        <p>You scored <strong>{score.correct}</strong> out of <strong>{score.total}</strong> attempts ({pct}%).</p>
        {pct < 80 && <p className={styles.retryNote}>Review the flashcards and try again — you've got this, Panther!</p>}
        <button className={styles.btnPrimary} onClick={restart}>Try Again</button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.counter}>Question {qIndex + 1} of {queue.length}</span>
        {round > 1 && <span className={styles.retryBadge}>🔄 Retry Round {round}</span>}
        {q.isRetry && <span className={styles.retryBadge}>↩ Re-attempt</span>}
        <span className={styles.score}>✓ {score.correct}/{score.total}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${round}-${qIndex}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.22 }}
          className={styles.questionCard}
        >
          <p className={styles.questionText}>{q.question}</p>

          {/* Multiple choice */}
          {q.type === 'multiple_choice' && (
            <div className={styles.options}>
              {q.options.map(opt => {
                let cls = styles.option;
                if (submitted) {
                  if (opt === q.correct)         cls += ' ' + styles.optCorrect;
                  else if (opt === answer)       cls += ' ' + styles.optWrong;
                } else if (opt === answer) {
                  cls += ' ' + styles.optSelected;
                }
                return (
                  <button
                    key={opt}
                    className={cls}
                    disabled={submitted}
                    onClick={() => setAnswer(opt)}
                    aria-pressed={answer === opt}
                  >
                    {submitted && opt === q.correct && <span className={styles.icon}>✓ </span>}
                    {submitted && opt === answer && opt !== q.correct && <span className={styles.icon}>✗ </span>}
                    {!submitted && opt === answer && <span className={styles.icon}>● </span>}
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Fill in the blank */}
          {q.type === 'fill_blank' && (
            <div className={styles.fillWrap}>
              <p className={styles.blankHint}>{q.hint}</p>
              <input
                className={`${styles.fillInput} ${submitted ? (correct ? styles.inputCorrect : styles.inputWrong) : ''}`}
                type="text"
                placeholder="Type your answer…"
                value={answer}
                disabled={submitted}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !submitted && answer.trim() && checkAnswer()}
                autoFocus
              />
              {submitted && !correct && (
                <p className={styles.correctAnswer}>Correct answer: <strong>{q.correct}</strong></p>
              )}
            </div>
          )}

          {/* Feedback banner */}
          {submitted && (
            <motion.div
              className={`${styles.feedback} ${correct ? styles.feedbackCorrect : styles.feedbackWrong}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {correct
                ? '✅ Correct! Nice work, Panther.'
                : `❌ Not quite. ${!correct && q.type === 'multiple_choice' ? `The answer is "${q.correct}".` : ''} This question will come back around.`}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className={styles.actions}>
        {!submitted
          ? <button className={styles.btnPrimary} onClick={checkAnswer} disabled={!answer.trim()}>
              Submit Answer
            </button>
          : <button className={styles.btnPrimary} onClick={advance}>
              {qIndex + 1 < queue.length || retryQueue.length > 0 ? 'Next →' : 'Finish ✓'}
            </button>
        }
      </div>
    </div>
  );
}

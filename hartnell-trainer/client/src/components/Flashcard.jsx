import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Flashcard.module.css';

export default function Flashcard({ cards = [] }) {
  const [index,    setIndex]    = useState(0);
  const [flipped,  setFlipped]  = useState(false);
  const [done,     setDone]     = useState(false);

  if (!cards.length) return null;

  const card = cards[index];
  if (!card) return null;

  function flip() { setFlipped(f => !f); }

  function next() {
    if (index + 1 >= cards.length) { setDone(true); return; }
    setFlipped(false);
    setTimeout(() => setIndex(i => i + 1), 180);
  }

  function prev() {
    if (index === 0) return;
    setFlipped(false);
    setTimeout(() => setIndex(i => i - 1), 180);
  }

  function restart() { setIndex(0); setFlipped(false); setDone(false); }

  if (done) {
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}>🎉</div>
        <h3>All {cards.length} cards reviewed!</h3>
        <p>Flip through them again any time to reinforce the concepts.</p>
        <button className={styles.btnPrimary} onClick={restart}>Review Again</button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.meta}>
        <span className={styles.counter}>{index + 1} / {cards.length}</span>
        <span className={styles.hint}>Click card to flip</span>
      </div>

      {/* Progress dots */}
      <div className={styles.dots}>
        {cards.map((_, i) => (
          <span key={i} className={`${styles.dot} ${i < index ? styles.dotDone : i === index ? styles.dotActive : ''}`} />
        ))}
      </div>

      {/* 3-D flip card */}
      <div className={styles.scene} onClick={flip}>
        <motion.div
          className={styles.card}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div className={`${styles.face} ${styles.front}`}>
            <span className={styles.faceLabel}>Question</span>
            <p className={styles.cardText}>{card.front}</p>
            <span className={styles.flipCue}>↻ tap to reveal</span>
          </div>
          {/* Back */}
          <div className={`${styles.face} ${styles.back}`}>
            <span className={styles.faceLabel}>Answer</span>
            <p className={styles.cardText}>{card.back}</p>
          </div>
        </motion.div>
      </div>

      <div className={styles.controls}>
        <button className={styles.btnSecondary} onClick={prev} disabled={index === 0}>← Prev</button>
        <button className={styles.btnPrimary}   onClick={next}>
          {index + 1 === cards.length ? 'Finish ✓' : 'Next →'}
        </button>
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Matching.module.css';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Matching({ pairs = [], onComplete }) {
  const [lefts]          = useState(() => pairs.map((p, i) => ({ id: i, text: p.left })));
  const [rights,setRights] = useState(() => shuffle(pairs.map((p, i) => ({ id: i, text: p.right }))));
  const [selected,  setSelected]  = useState(null);   // { side:'left'|'right', id }
  const [matched,   setMatched]   = useState([]);      // array of matched left-ids
  const [wrong,     setWrong]     = useState(null);    // brief wrong-flash id pair
  const [done,      setDone]      = useState(false);

  const handleClick = useCallback((side, id) => {
    if (matched.includes(side === 'left' ? id : rights.find(r => r.id === id)?.id)) return;

    if (!selected) {
      setSelected({ side, id });
      return;
    }

    // Same side clicked again — just update selection
    if (selected.side === side) { setSelected({ side, id }); return; }

    // Cross-side: check match
    const leftId  = side === 'left' ? id : selected.id;
    const rightId = side === 'right' ? id : selected.id;
    const rightItem = rights.find(r => r.id === rightId);

    if (leftId === rightId) {
      // Correct match
      const newMatched = [...matched, leftId];
      setMatched(newMatched);
      setSelected(null);
      if (newMatched.length === pairs.length) {
        setTimeout(() => { setDone(true); onComplete?.(); }, 400);
      }
    } else {
      // Wrong — flash red then clear
      setWrong({ leftId, rightId });
      setTimeout(() => { setWrong(null); setSelected(null); }, 700);
    }
  }, [selected, matched, rights, pairs.length, onComplete]);

  function restart() {
    setRights(shuffle(pairs.map((p, i) => ({ id: i, text: p.right }))));
    setSelected(null);
    setMatched([]);
    setWrong(null);
    setDone(false);
  }

  function cellState(side, id) {
    const leftId = side === 'left' ? id : rights.find(r => r.id === id)?.id;
    if (matched.includes(leftId)) return 'matched';
    if (wrong) {
      if (side === 'left'  && wrong.leftId  === id) return 'wrong';
      if (side === 'right' && wrong.rightId === id) return 'wrong';
    }
    if (selected?.side === side && selected?.id === id) return 'selected';
    return 'idle';
  }

  if (done) {
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}>🎯</div>
        <h3>Perfect match!</h3>
        <p>You matched all {pairs.length} pairs correctly.</p>
        <button className={styles.btnPrimary} onClick={restart}>Play Again</button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.instruction}>
        Click a term on the left, then click its matching definition on the right.
      </p>
      <div className={styles.progress}>
        <div className={styles.progressFill} style={{ width: `${(matched.length / pairs.length) * 100}%` }} />
      </div>
      <p className={styles.progressLabel}>{matched.length} / {pairs.length} matched</p>

      <div className={styles.grid}>
        {/* Left column */}
        <div className={styles.col}>
          {lefts.map(item => {
            const state = cellState('left', item.id);
            return (
              <motion.button
                key={item.id}
                className={`${styles.cell} ${styles[state]}`}
                onClick={() => handleClick('left', item.id)}
                disabled={state === 'matched'}
                whileTap={{ scale: 0.97 }}
              >
                {item.text}
                {state === 'matched' && <span className={styles.check}>✓</span>}
              </motion.button>
            );
          })}
        </div>

        {/* Right column */}
        <div className={styles.col}>
          {rights.map(item => {
            const state = cellState('right', item.id);
            return (
              <motion.button
                key={item.id}
                className={`${styles.cell} ${styles[state]} ${styles.right}`}
                onClick={() => handleClick('right', item.id)}
                disabled={state === 'matched'}
                whileTap={{ scale: 0.97 }}
              >
                {item.text}
                {state === 'matched' && <span className={styles.check}>✓</span>}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

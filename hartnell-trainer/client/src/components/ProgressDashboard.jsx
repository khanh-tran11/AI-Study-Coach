import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchProgress } from '../api';
import styles from './ProgressDashboard.module.css';

const MODULE_TITLES = [
  'Canvas Orientation',      'Setting Up Your Shell',
  'Course Content Upload',   'Assignments & Quizzes',
  'Gradebook & Exports',     'Communication Tools',
  'Accessibility Standards', 'Student View & Testing',
  'LMS Admin Intro',         'Capstone & Certification',
];

const ESCALATION_CONFIG = {
  certified:       { label: 'Certified 🎓',       color: '#1a7a3c', bg: '#edfbf1' },
  on_track:        { label: 'On Track ✅',          color: '#0a5f8a', bg: '#e8f4fc' },
  needs_attention: { label: 'Needs Attention ⚠️',  color: '#c07000', bg: '#fff8e1' },
};

function escalationStatus(pct) {
  if (pct >= 100) return 'certified';
  if (pct >= 50)  return 'on_track';
  return 'needs_attention';
}

export default function ProgressDashboard({ userId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchProgress(userId)
      .then(r => setStats(r.data))
      .catch(() => setStats({
        userId, completedModules: 3, totalModules: 10,
        completionPct: 30, totalHours: 4.5, modules: {},
      }))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className={styles.loading}>Loading progress…</div>;
  if (!stats)  return null;

  const pct    = stats.completionPct ?? Math.round((stats.completedModules / stats.totalModules) * 100);
  const escKey = escalationStatus(pct);
  const esc    = ESCALATION_CONFIG[escKey];

  // Derive per-module status from stats.modules map
  function modStatus(i) {
    const mod = stats.modules?.[String(i + 1)];
    if (!mod) return i < stats.completedModules ? 'done' : i === stats.completedModules ? 'active' : 'locked';
    if (mod.completedAt) return 'done';
    const steps = Object.values(mod.steps || {});
    if (steps.some(s => s.status === 'in_progress' || s.status === 'completed')) return 'active';
    return 'locked';
  }

  const unlockedCount = MODULE_TITLES.filter((_, i) => modStatus(i) !== 'locked').length;

  return (
    <div className={styles.wrapper}>
      {/* ── Hero ring ── */}
      <div className={styles.heroRow}>
        <div className={styles.ringWrap}>
          <svg className={styles.ring} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--hc-light)" strokeWidth="10" />
            <motion.circle
              cx="60" cy="60" r="52" fill="none"
              stroke="var(--hc-magenta)" strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={2 * Math.PI * 52 * (1 - pct / 100)}
              transform="rotate(-90 60 60)"
              initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - pct / 100) }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <div className={styles.ringCenter}>
            <span className={styles.ringPct}>{pct}%</span>
            <span className={styles.ringLabel}>complete</span>
          </div>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.statBox}>
            <span className={styles.statN}>{stats.completedModules}</span>
            <span className={styles.statL}>of {stats.totalModules} modules done</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statN}>{unlockedCount}</span>
            <span className={styles.statL}>levels unlocked</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statN}>{stats.totalHours ?? 0}</span>
            <span className={styles.statL}>hours logged</span>
          </div>
          <div className={styles.statBox} style={{ background: esc.bg }}>
            <span className={styles.statN} style={{ fontSize:'1rem', color: esc.color }}>{esc.label}</span>
            <span className={styles.statL}>escalation status</span>
          </div>
        </div>
      </div>

      {/* ── Module path ── */}
      <h3 className={styles.sectionTitle}>Learning Path</h3>
      <div className={styles.moduleGrid}>
        {MODULE_TITLES.map((title, i) => {
          const status = modStatus(i);
          return (
            <motion.div
              key={i}
              className={`${styles.modCard} ${styles[status]}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className={styles.modNum}>{status === 'done' ? '✓' : i + 1}</div>
              <div className={styles.modInfo}>
                <span className={styles.modTitle}>{title}</span>
                <span className={styles.modStatus}>
                  {status === 'done'   && '✅ Completed'}
                  {status === 'active' && '▶ In Progress'}
                  {status === 'locked' && '🔒 Locked'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Escalation banner ── */}
      {escKey === 'needs_attention' && (
        <div className={styles.escalationBanner}>
          <strong>Need help?</strong> You're at {pct}% completion. Reach out to get back on track.
          <div className={styles.escalationLinks}>
            <button className={styles.escBtn}>📨 Canvas Inbox</button>
            <button className={styles.escBtn}>🛠 LMS Admin</button>
            <button className={styles.escBtn}>📅 Schedule Training</button>
          </div>
        </div>
      )}

      {escKey === 'certified' && (
        <div className={styles.certBanner}>
          🎓 <strong>Congratulations!</strong> You've completed all modules. Your Canvas shell is now active.
        </div>
      )}
    </div>
  );
}

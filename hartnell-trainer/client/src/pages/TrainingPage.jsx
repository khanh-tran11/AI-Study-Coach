import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchModule, updateProgress } from '../api';
import { useAuth } from '../AuthContext';
import { HartnellLogo, PantherMark } from '../HartnellLogo';
import Flashcard from '../components/Flashcard';
import Quiz from '../components/Quiz';
import Matching from '../components/Matching';
import ProgressDashboard from '../components/ProgressDashboard';
import ChatPanel from '../components/ChatPanel';
import { getIconForContent } from '../components/CanvasIcons';
import styles from './TrainingPage.module.css';

const MODULE_TITLES = [
  'Canvas Orientation',      'Setting Up Your Shell',
  'Course Content Upload',   'Assignments & Quizzes',
  'Gradebook & Exports',     'Communication Tools',
  'Accessibility Standards', 'Student View & Testing',
  'LMS Admin Intro',         'Capstone & Certification',
];

export default function TrainingPage() {
  const { user, logout } = useAuth();

  // Load per-user completed list from sessionStorage so it persists across re-renders
  const storageKey = `ht_completed_${user?.id}`;
  const [completed,   setCompleted]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || '[0,1,2]'); } catch { return [0,1,2]; }
  });
  const [moduleIdx,   setModuleIdx]   = useState(() => {
    const c = JSON.parse(sessionStorage.getItem(storageKey) || '[0,1,2]');
    return c.length < 10 ? c.length : 9;
  });
  const [lesson,      setLesson]      = useState(null);
  const [assets,      setAssets]      = useState({ videos: [], images: [] });
  const [stepIdx,     setStepIdx]     = useState(0);
  const [stepDone,    setStepDone]    = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showProgress,setShowProgress]= useState(false);

  // Fetch lesson from API when module changes
  useEffect(() => {
    setLoading(true);
    setStepIdx(0);
    setStepDone(false);
    setLesson(null);
    fetchModule(moduleIdx + 1)
      .then(r => { setLesson(r.data.lesson); setAssets(r.data.assets); })
      .catch(() => setLesson(null))
      .finally(() => setLoading(false));
  }, [moduleIdx]);

  const saveCompleted = useCallback((arr) => {
    sessionStorage.setItem(storageKey, JSON.stringify(arr));
    setCompleted(arr);
  }, [storageKey]);

  function postProgress(stepId, status) {
    updateProgress({
      userId: user?.id, moduleId: moduleIdx + 1, stepId, status, timeSpentSeconds: 120,
    }).catch(() => {});
  }

  function completeStep() {
    const step = lesson?.steps?.[stepIdx];
    // Block if interactive step not completed
    if (step && (step.type === 'flashcard' || step.type === 'quiz') && !stepDone) {
      return;
    }
    if (step) postProgress(step.step_id, 'completed');
    if (stepIdx + 1 < (lesson?.steps?.length || 0)) {
      setStepIdx(s => s + 1);
      setStepDone(false);
    } else {
      // Complete module
      if (!completed.includes(moduleIdx)) {
        const next = [...completed, moduleIdx];
        saveCompleted(next);
      }
      if (moduleIdx + 1 < 10) setModuleIdx(m => m + 1);
    }
  }

  function gotoModule(i) {
    const isLocked = !completed.includes(i) && i > completed.length;
    if (isLocked) return;
    setModuleIdx(i);
  }

  const currentStep = lesson?.steps?.[stepIdx] || null;
  const chatContext = {
    tool_id:      currentStep?.tool_id || 'canvas-lms',
    step_id:      currentStep?.step_id || `${moduleIdx+1}-${stepIdx+1}`,
    moduleTitle:  MODULE_TITLES[moduleIdx],
    s3LessonText: currentStep?.s3LessonText || currentStep?.content || '',
  };

  const pct = Math.round((completed.length / 10) * 100);

  return (
    <div className={styles.app}>
      {/* ── Top nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <button className={styles.burgerBtn} onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            ☰
          </button>
          <HartnellLogo size={32} dark />
        </div>
        <div className={styles.navCenter}>
          <span className={styles.navModule}>Module {moduleIdx + 1} · {MODULE_TITLES[moduleIdx]}</span>
        </div>
        <div className={styles.navRight}>
          <button className={styles.navBtn} onClick={() => setShowProgress(p => !p)}>
            📊 {pct}%
          </button>
          <span className={styles.navUser}>{user?.name}</span>
          <button className={styles.navBtn} onClick={logout}>Sign Out</button>
        </div>
      </nav>

      <div className={styles.body}>
        {/* ── Sidebar ── */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              className={styles.sidebar}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 272, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <div className={styles.sidebarInner}>
                <div className={styles.sidebarHeader}>
                  <span>Onboarding Path</span>
                  <span className={styles.sidebarPct}>{pct}%</span>
                </div>
                <div className={styles.sidebarBar}>
                  <div className={styles.sidebarBarFill} style={{ width: `${pct}%` }} />
                </div>
                <ul className={styles.modList}>
                  {MODULE_TITLES.map((title, i) => {
                    const done   = completed.includes(i);
                    const active = i === moduleIdx;
                    const locked = !done && i > completed.length;
                    return (
                      <li key={i}>
                        <button
                          className={`${styles.modBtn} ${active ? styles.modActive : ''} ${locked ? styles.modLocked : ''}`}
                          onClick={() => gotoModule(i)}
                          disabled={locked}
                          title={locked ? 'Complete previous module first' : title}
                        >
                          <span className={`${styles.modNum} ${done ? styles.numDone : active ? styles.numActive : ''}`}>
                            {done ? '✓' : i + 1}
                          </span>
                          <span className={styles.modLabel}>{title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Main panel ── */}
        <main className={styles.main}>

          {/* Progress overlay */}
          <AnimatePresence>
            {showProgress && (
              <motion.div className={styles.progressOverlay}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className={styles.progressModal}>
                  <div className={styles.progressModalHeader}>
                    <h2>Your Progress</h2>
                    <button onClick={() => setShowProgress(false)}>✕</button>
                  </div>
                  <ProgressDashboard userId={user?.id} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className={styles.loader}>
              <PantherMark size={48} />
              <p>Loading module…</p>
            </div>
          ) : !lesson ? (
            <div className={styles.loader}>
              <p>Could not load module. Make sure the API server is running.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${moduleIdx}-${stepIdx}`}
                className={styles.stepWrap}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Step header */}
                <div className={styles.stepHeader}>
                  <div className={styles.breadcrumb}>
                    Module {moduleIdx + 1} of 10 &rsaquo; Step {stepIdx + 1} of {lesson.steps.length}
                  </div>
                  <h1 className={styles.stepTitle}>{currentStep?.title || lesson.title}</h1>
                  <div className={styles.stepMeta}>
                    <span>⏱ {lesson.estimatedMinutes} min</span>
                    <span>{lesson.steps.length} steps</span>
                  </div>
                  {/* Step progress dots */}
                  <div className={styles.stepDots}>
                    {lesson.steps.map((_, i) => (
                      <span key={i} className={`${styles.stepDot} ${i < stepIdx ? styles.dotDone : i === stepIdx ? styles.dotActive : ''}`} />
                    ))}
                  </div>
                </div>

                {/* AI hint banner */}
                <div className={styles.aiHint}>
                  <PantherMark size={28} />
                  <p><strong>Panther says:</strong> {lesson.description} Work through each part below, then click Continue.</p>
                </div>

                {/* ── Step content — rendered by type ── */}
                <div className={styles.widgetArea}>
                  {currentStep?.type === 'text' && (
                    <div className={styles.textContent}>
                      {/* Split content into sentences and render as guided steps */}
                      {currentStep.content.split('. ').filter(Boolean).map((sentence, i) => {
                        const StepIcon = getIconForContent(sentence);
                        return (
                          <div key={i} className={styles.guideStep}>
                            <span className={styles.guideStepNum}>
                              {StepIcon ? <StepIcon size={16} color="#fff" /> : i + 1}
                            </span>
                            <div className={styles.guideStepBody}>
                              <p>{sentence.endsWith('.') ? sentence : `${sentence}.`}</p>
                            </div>
                          </div>
                        );
                      })}
                      {/* Tip callout */}
                      <div className={styles.tipBox}>
                        <span className={styles.tipIcon}>💡</span>
                        <p><strong>Try it yourself:</strong> Open Canvas in another tab and follow along with these steps. Learning by doing is the fastest way to build confidence.</p>
                      </div>
                      {/* Presigned video */}
                      {assets.videos[0] && (
                        <video className={styles.video} controls src={assets.videos[0].url}>
                          Your browser does not support video.
                        </video>
                      )}
                      {/* Presigned images */}
                      {assets.images.map(img => (
                        <img key={img.key} className={styles.assetImg} src={img.url} alt="" />
                      ))}
                    </div>
                  )}

                  {currentStep?.type === 'flashcard' && (
                    <Flashcard cards={currentStep.cards ?? []} onComplete={() => setStepDone(true)} />
                  )}

                  {currentStep?.type === 'quiz' && (
                    <div className={styles.quizArea}>
                      {currentStep.questions.map((q, qi) => {
                        if (q.type === 'matching') {
                          return (
                            <div key={qi} className={styles.widgetBlock}>
                              <h3 className={styles.widgetLabel}>Matching</h3>
                              <Matching pairs={q.pairs} onComplete={() => setStepDone(true)} />
                            </div>
                          );
                        }
                        return (
                          <div key={qi} className={styles.widgetBlock}>
                            <h3 className={styles.widgetLabel}>
                              {q.type === 'fill_blank' ? 'Fill in the Blank' : 'Multiple Choice'}
                            </h3>
                            <Quiz questions={[q]} onComplete={() => setStepDone(true)} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className={styles.navActions}>
                  <button
                    className={styles.btnBack}
                    onClick={() => setStepIdx(s => Math.max(0, s - 1))}
                    disabled={stepIdx === 0 && moduleIdx === 0}
                  >
                    ← Back
                  </button>
                  <button
                    className={styles.btnContinue}
                    onClick={completeStep}
                    disabled={(currentStep?.type === 'flashcard' || currentStep?.type === 'quiz') && !stepDone}
                    title={(currentStep?.type === 'flashcard' || currentStep?.type === 'quiz') && !stepDone ? 'Complete all questions before continuing' : undefined}
                  >
                    {stepIdx + 1 === lesson.steps.length
                      ? completed.includes(moduleIdx) ? 'Next Module →' : '✅ Complete Module'
                      : 'Continue →'}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Floating Panther chat — always present, context-aware */}
      <ChatPanel context={chatContext} />
    </div>
  );
}

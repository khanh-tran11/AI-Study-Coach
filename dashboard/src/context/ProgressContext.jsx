import { createContext, useContext, useState, useEffect } from 'react';

export const ProgressContext = createContext(null);

const DEFAULT_PROGRESS = {
  moduleName: 'Introduction to React',
  currentStep: 4,
  totalSteps: 9,
};

function loadInitialState() {
  try {
    const stored = localStorage.getItem('moduleProgress');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore parse errors and fall back to default
  }
  return DEFAULT_PROGRESS;
}

export function ProgressProvider({ children }) {
  const [progress, setProgress] = useState(loadInitialState);

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem('moduleProgress', JSON.stringify(progress));
    } catch {
      // ignore storage errors (e.g. private browsing quota)
    }
  }, [progress]);

  function advanceStep() {
    setProgress((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, prev.totalSteps),
    }));
  }

  function setModuleName(name) {
    setProgress((prev) => ({ ...prev, moduleName: name }));
  }

  const value = {
    moduleName: progress.moduleName,
    currentStep: progress.currentStep,
    totalSteps: progress.totalSteps,
    advanceStep,
    setModuleName,
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('useProgress must be used inside a ProgressProvider');
  }
  return ctx;
}

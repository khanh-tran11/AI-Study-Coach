import { useState, useRef } from 'react';
import { MOCK_LEARNER_PROGRESS, MODULE_NAMES } from '../../data/mockEducatorData';
import { useDynamoData } from '../../services/useDynamoData';
import { getAllLearnersForEducator } from '../../services/db';
import LoadingState from '../shared/LoadingState';
import ErrorState from '../shared/ErrorState';
import LearnerDetailDrawer from './LearnerDetailDrawer';
import styles from './LearnerTable.module.css';

/**
 * Aggregates raw progress records into per-learner summaries.
 */
function aggregateLearners(data) {
  const map = {};

  for (const record of data) {
    if (!map[record.userId]) {
      map[record.userId] = {
        userId: record.userId,
        name: record.name,
        modules: [],
        totalCompleted: 0,
        totalModules: 0,
        totalTimeSeconds: 0,
        lastActiveAt: record.lastActiveAt,
      };
    }

    const learner = map[record.userId];
    const pct = record.totalSteps > 0 ? record.stepsCompleted / record.totalSteps : 0;

    learner.modules.push({
      moduleId: record.moduleId,
      moduleName: MODULE_NAMES[record.moduleId] || record.moduleId,
      stepsCompleted: record.stepsCompleted,
      totalSteps: record.totalSteps,
      timeSpentSeconds: record.timeSpentSeconds,
    });

    if (record.stepsCompleted === record.totalSteps && record.totalSteps > 0) {
      learner.totalCompleted += 1;
    }
    learner.totalModules += 1;
    learner.totalTimeSeconds += record.timeSpentSeconds;

    // Track most recent activity
    if (record.lastActiveAt > learner.lastActiveAt) {
      learner.lastActiveAt = record.lastActiveAt;
    }

    // Store individual pct for avg calculation
    if (!learner._pcts) learner._pcts = [];
    learner._pcts.push(pct);
  }

  return Object.values(map).map((l) => ({
    ...l,
    overallPct: Math.round(
      (l._pcts.reduce((sum, p) => sum + p, 0) / l._pcts.length) * 100
    ),
  }));
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const COLUMNS = [
  { key: 'name', label: 'Learner' },
  { key: 'totalCompleted', label: 'Modules Completed' },
  { key: 'overallPct', label: 'Overall %' },
  { key: 'totalTimeSeconds', label: 'Time Spent' },
  { key: 'lastActiveAt', label: 'Last Active' },
];

export default function LearnerTable() {
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('ascending');
  const [selectedLearner, setSelectedLearner] = useState(null);
  const triggerRef = useRef(null);

  const { data, loading, error } = useDynamoData(
    () => getAllLearnersForEducator('educator-1'),
    [],
    MOCK_LEARNER_PROGRESS
  );

  if (loading) {
    return <LoadingState message="Loading learner data..." />;
  }

  const learners = aggregateLearners(data);

  // Sort
  const sorted = [...learners].sort((a, b) => {
    let aVal = a[sortCol];
    let bVal = b[sortCol];

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortDir === 'ascending' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'ascending' ? 1 : -1;
    return 0;
  });

  function handleSort(colKey) {
    if (sortCol === colKey) {
      setSortDir((d) => (d === 'ascending' ? 'descending' : 'ascending'));
    } else {
      setSortCol(colKey);
      setSortDir('ascending');
    }
  }

  function handleRowClick(learner, event) {
    triggerRef.current = event.currentTarget;
    setSelectedLearner(learner);
  }

  function handleRowKeyDown(learner, event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      triggerRef.current = event.currentTarget;
      setSelectedLearner(learner);
    }
  }

  function handleDrawerClose() {
    setSelectedLearner(null);
    // Return focus to trigger row
    if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }

  return (
    <section aria-label="Learner breakdown" className={styles.section}>
      <h2 className={styles.heading}>Learner Progress</h2>

      {error && <ErrorState message={error} />}

      <div className={styles.scrollWrapper}>
        <table className={styles.table}>
          <caption className="sr-only">Per-learner progress breakdown</caption>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={sortCol === col.key ? sortDir : 'none'}
                  className={styles.th}
                >
                  <button
                    type="button"
                    className={styles.sortBtn}
                    onClick={() => handleSort(col.key)}
                    aria-label={`Sort by ${col.label}`}
                  >
                    <span>{col.label}</span>
                    <span className={styles.sortIndicator} aria-hidden="true">
                      {sortCol === col.key
                        ? sortDir === 'ascending'
                          ? '▲'
                          : '▼'
                        : ''}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((learner) => (
              <tr
                key={learner.userId}
                className={styles.row}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${learner.name}`}
                onClick={(e) => handleRowClick(learner, e)}
                onKeyDown={(e) => handleRowKeyDown(learner, e)}
              >
                <td className={styles.td}>{learner.name}</td>
                <td className={styles.td}>{learner.totalCompleted}</td>
                <td className={styles.td}>{learner.overallPct}%</td>
                <td className={styles.td}>{formatTime(learner.totalTimeSeconds)}</td>
                <td className={styles.td}>{formatDate(learner.lastActiveAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLearner && (
        <LearnerDetailDrawer
          learner={selectedLearner}
          onClose={handleDrawerClose}
        />
      )}
    </section>
  );
}

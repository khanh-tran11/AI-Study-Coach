import { MOCK_LEARNER_PROGRESS, MODULE_NAMES } from '../../data/mockEducatorData';
import { useDynamoData } from '../../services/useDynamoData';
import { getAllLearnersForEducator } from '../../services/db';
import LoadingState from '../shared/LoadingState';
import ErrorState from '../shared/ErrorState';
import CompletionChart from './CompletionChart';
import styles from './AnalyticsOverview.module.css';

/**
 * Computes aggregate analytics from learner progress data.
 */
function computeStats(data) {
  // Total unique learners
  const uniqueUsers = new Set(data.map((r) => r.userId));
  const totalLearners = uniqueUsers.size;

  // Average completion %
  const completionPcts = data.map((r) =>
    r.totalSteps > 0 ? (r.stepsCompleted / r.totalSteps) * 100 : 0
  );
  const avgCompletion = Math.round(
    completionPcts.reduce((sum, pct) => sum + pct, 0) / completionPcts.length
  );

  // Average time spent
  const avgTimeSeconds = Math.round(
    data.reduce((sum, r) => sum + r.timeSpentSeconds, 0) / data.length
  );
  const hours = Math.floor(avgTimeSeconds / 3600);
  const minutes = Math.floor((avgTimeSeconds % 3600) / 60);
  const avgTimeFormatted = `${hours}h ${minutes}m`;

  // Most dropped-off module (lowest average completion %)
  const moduleStats = {};
  for (const record of data) {
    if (!moduleStats[record.moduleId]) {
      moduleStats[record.moduleId] = { totalPct: 0, count: 0 };
    }
    const pct = record.totalSteps > 0 ? (record.stepsCompleted / record.totalSteps) * 100 : 0;
    moduleStats[record.moduleId].totalPct += pct;
    moduleStats[record.moduleId].count += 1;
  }

  let lowestModule = null;
  let lowestAvg = Infinity;
  for (const [moduleId, { totalPct, count }] of Object.entries(moduleStats)) {
    const avg = totalPct / count;
    if (avg < lowestAvg) {
      lowestAvg = avg;
      lowestModule = MODULE_NAMES[moduleId] || moduleId;
    }
  }

  return { totalLearners, avgCompletion, avgTimeFormatted, droppedOffModule: lowestModule };
}

export default function AnalyticsOverview() {
  const { data, loading, error } = useDynamoData(
    () => getAllLearnersForEducator('educator-1'),
    [],
    MOCK_LEARNER_PROGRESS
  );

  if (loading) {
    return <LoadingState message="Loading analytics..." />;
  }

  const { totalLearners, avgCompletion, avgTimeFormatted, droppedOffModule } =
    computeStats(data);

  return (
    <section aria-label="Analytics overview" className={styles.section}>
      <h2>Analytics Overview</h2>

      {error && <ErrorState message={error} />}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalLearners}</span>
          <span className={styles.statLabel}>Total Learners</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{avgCompletion}%</span>
          <span className={styles.statLabel}>Avg Completion</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{avgTimeFormatted}</span>
          <span className={styles.statLabel}>Avg Time Spent</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue} style={{ fontSize: 'var(--font-size-lg)' }}>
            {droppedOffModule}
          </span>
          <span className={styles.statLabel}>Most Drop-off</span>
        </div>
      </div>

      <CompletionChart />
    </section>
  );
}

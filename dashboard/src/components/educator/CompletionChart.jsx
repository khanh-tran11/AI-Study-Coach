import { MOCK_LEARNER_PROGRESS, MODULE_NAMES } from '../../data/mockEducatorData';
import styles from './CompletionChart.module.css';

/**
 * Computes average completion % per module from learner progress data.
 */
function getModuleCompletionRates(data) {
  const moduleStats = {};

  for (const record of data) {
    if (!moduleStats[record.moduleId]) {
      moduleStats[record.moduleId] = { totalPct: 0, count: 0 };
    }
    const pct = record.totalSteps > 0 ? (record.stepsCompleted / record.totalSteps) * 100 : 0;
    moduleStats[record.moduleId].totalPct += pct;
    moduleStats[record.moduleId].count += 1;
  }

  return Object.entries(moduleStats).map(([moduleId, { totalPct, count }]) => ({
    moduleId,
    name: MODULE_NAMES[moduleId] || moduleId,
    avgCompletion: Math.round(totalPct / count),
  }));
}

export default function CompletionChart() {
  const rates = getModuleCompletionRates(MOCK_LEARNER_PROGRESS);

  const barHeight = 32;
  const barGap = 16;
  const labelWidth = 220;
  const chartPaddingTop = 8;
  const chartPaddingBottom = 8;
  const percentLabelWidth = 50;
  const totalWidth = 600;
  const barAreaWidth = totalWidth - labelWidth - percentLabelWidth;
  const totalHeight = chartPaddingTop + rates.length * (barHeight + barGap) - barGap + chartPaddingBottom;

  return (
    <div className={styles.chartWrapper}>
      <h3 className={styles.chartHeading}>Module Completion Rates</h3>
      <svg
        className={styles.chart}
        role="img"
        aria-label="Module completion rates chart"
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {rates.map((module, index) => {
          const y = chartPaddingTop + index * (barHeight + barGap);
          const barWidth = (module.avgCompletion / 100) * barAreaWidth;

          return (
            <g key={module.moduleId}>
              <title>{`${module.name}: ${module.avgCompletion}% completion`}</title>
              {/* Module label */}
              <text
                x={labelWidth - 12}
                y={y + barHeight / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize="13"
                fill="#3d3d5c"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {module.name}
              </text>
              {/* Background bar track */}
              <rect
                x={labelWidth}
                y={y}
                width={barAreaWidth}
                height={barHeight}
                rx="6"
                ry="6"
                fill="#eef0f6"
              />
              {/* Filled bar */}
              <rect
                x={labelWidth}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="6"
                ry="6"
                fill="#1e3a8a"
                aria-label={`${module.name}: ${module.avgCompletion}% completion`}
              />
              {/* Percentage label */}
              <text
                x={labelWidth + barAreaWidth + 8}
                y={y + barHeight / 2}
                textAnchor="start"
                dominantBaseline="central"
                fontSize="13"
                fontWeight="600"
                fill="#1a1a2e"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {module.avgCompletion}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

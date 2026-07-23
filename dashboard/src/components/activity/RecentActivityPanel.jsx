import { MOCK_ACTIVITY } from '../../data/mockActivity';
import styles from './RecentActivityPanel.module.css';

export default function RecentActivityPanel() {
  return (
    <section className={styles.card} aria-label="Recent activity">
      <h2 className={styles.heading}>Recent Activity</h2>

      {MOCK_ACTIVITY.length === 0 ? (
        <p className={styles.empty}>No recent activity yet.</p>
      ) : (
        <ol className={styles.list}>
          {MOCK_ACTIVITY.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.action}>{item.action}</span>
              <span className={styles.timestamp}>{item.timestamp}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

import PantherHero from '../components/panther/PantherHero';
import ModuleProgressBar from '../components/progress/ModuleProgressBar';
import ModuleLibrary from '../components/modules/ModuleLibrary';
import RecentActivityPanel from '../components/activity/RecentActivityPanel';
import styles from './LearnerDashboard.module.css';

export default function LearnerDashboard() {
  return (
    <div className={styles.dashboard}>
      <h1 className="sr-only">Learner Dashboard</h1>
      <PantherHero />
      <div className={styles.contentGrid}>
        <div className={styles.leftColumn}>
          <ModuleProgressBar />
          <RecentActivityPanel />
        </div>
        <ModuleLibrary />
      </div>
    </div>
  );
}

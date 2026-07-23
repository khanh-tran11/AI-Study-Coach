import AnalyticsOverview from '../components/educator/AnalyticsOverview';
import LearnerTable from '../components/educator/LearnerTable';

export default function EducatorDashboard() {
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--space-6)' }}>
      <h1 className="sr-only">Educator Dashboard</h1>
      <AnalyticsOverview />
      <LearnerTable />
    </div>
  );
}

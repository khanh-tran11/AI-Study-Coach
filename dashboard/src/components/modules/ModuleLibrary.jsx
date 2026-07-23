import { MOCK_MODULES } from '../../data/mockModules';
import ModuleCard from './ModuleCard';
import styles from './ModuleLibrary.module.css';

export default function ModuleLibrary() {
  return (
    <section className={styles.section} aria-label="Module library">
      <h2 className={styles.heading}>My Modules</h2>

      <div className={styles.grid} role="list">
        {MOCK_MODULES.map((mod) => (
          <div key={mod.id} role="listitem">
            <ModuleCard
              id={mod.id}
              title={mod.title}
              description={mod.description}
              status={mod.status}
              locked={mod.locked}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

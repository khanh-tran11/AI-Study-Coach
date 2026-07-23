import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleLearner() {
    login('learner');
    navigate('/dashboard/learner');
  }

  function handleEducator() {
    login('educator');
    navigate('/dashboard/educator');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-base)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 'var(--space-12)',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--font-size-3xl)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Welcome
        </h1>
        <p
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-8)',
          }}
        >
          Choose how you'd like to continue
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={handleLearner}
            aria-label="Continue as Learner"
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: 'var(--space-3) var(--space-6)',
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-on-accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family-body)',
              cursor: 'pointer',
              transition: 'background-color var(--transition-base)',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
          >
            Continue as Learner
          </button>

          <button
            type="button"
            onClick={handleEducator}
            aria-label="Continue as Educator"
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: 'var(--space-3) var(--space-6)',
              backgroundColor: 'var(--color-bg-subtle)',
              color: 'var(--color-text-primary)',
              border: '2px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family-body)',
              cursor: 'pointer',
              transition: 'border-color var(--transition-base), background-color var(--transition-base)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-accent)';
              e.currentTarget.style.backgroundColor = 'var(--color-accent-light)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
            }}
          >
            Continue as Educator
          </button>
        </div>
      </div>
    </div>
  );
}

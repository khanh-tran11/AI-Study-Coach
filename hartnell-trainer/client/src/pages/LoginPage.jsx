import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { HartnellLogo } from '../HartnellLogo';
import styles from './LoginPage.module.css';

const ROLES = [
  { key: 'admin',   icon: '🔑', label: 'Admin / Owner',  desc: 'Upload content, manage modules',  hint: 'admin@hartnell.edu / admin123' },
  { key: 'faculty', icon: '🎓', label: 'Faculty',         desc: 'Access your Canvas training path', hint: 'm.santos@hartnell.edu / faculty123' },
];

export default function LoginPage() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const [role,    setRole]    = useState('admin');
  const [email,   setEmail]   = useState('');
  const [password,setPassword]= useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function pickRole(r) {
    setRole(r);
    setEmail('');
    setPassword('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin' : '/training');
    } catch (err) {
      setError(err?.response?.data?.error || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  const selectedRole = ROLES.find(r => r.key === role);

  return (
    <div className={styles.page}>
      {/* Left hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <HartnellLogo size={48} dark />
          <h1 className={styles.heroTitle}>
            Faculty Onboarding,<br /><span>reimagined.</span>
          </h1>
          <p className={styles.heroBody}>
            A conversational AI guide that walks Hartnell College instructors
            through Canvas — module by module, step by step.
          </p>
          <ul className={styles.features}>
            {[
              ['📂', 'Upload docs & videos — AI builds the modules'],
              ['🗺️', 'Sequential, stage-gated learning path'],
              ['🧩', 'Flashcards, quizzes, matching widgets'],
              ['📊', 'Live progress tracking & escalation alerts'],
              ['🐾', 'Panther AI assistant on every step'],
            ].map(([icon, text]) => (
              <li key={text}><span className={styles.featIcon}>{icon}</span>{text}</li>
            ))}
          </ul>
          <div className={styles.heroBadge}>
            Growing Leaders through Opportunity, Engagement &amp; Achievement
          </div>
        </div>
      </div>

      {/* Right login card */}
      <div className={styles.formSide}>
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={styles.cardLogo}><HartnellLogo size={36} /></div>
          <h2 className={styles.cardTitle}>Sign in</h2>
          <p className={styles.cardSub}>Choose your role to continue.</p>

          {/* Role tabs */}
          <div className={styles.roleTabs}>
            {ROLES.map(r => (
              <button
                key={r.key}
                className={`${styles.roleTab} ${role === r.key ? styles.roleTabActive : ''}`}
                onClick={() => pickRole(r.key)}
                type="button"
              >
                <span className={styles.roleIcon}>{r.icon}</span>
                <span className={styles.roleName}>{r.label}</span>
                <span className={styles.roleDesc}>{r.desc}</span>
              </button>
            ))}
          </div>

          {/* Demo hint */}
          <div className={styles.hint}>
            Demo: <strong>{selectedRole.hint}</strong>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="email">📧 Email ID</label>
              <input id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="password">🔒 Password</label>
              <input id="password" type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}

            <button className={styles.btnSubmit} type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <p className={styles.allPass}>All faculty accounts use password: <strong>faculty123</strong></p>
        </motion.div>
      </div>
    </div>
  );
}

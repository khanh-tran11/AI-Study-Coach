import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './DashboardLayout.module.css';

const NAV_LINKS = {
  learner: [
    { to: '/dashboard/learner', label: 'Dashboard' },
    { to: '/dashboard/learner/modules', label: 'My Modules' },
    { to: '/dashboard/learner/progress', label: 'Progress' },
  ],
  educator: [
    { to: '/dashboard/educator', label: 'Dashboard' },
    { to: '/dashboard/educator/learners', label: 'Learners' },
    { to: '/dashboard/educator/analytics', label: 'Analytics' },
  ],
};

/** Returns up to two uppercase initials from a role string, e.g. "learner" → "L" */
function getInitials(role) {
  if (!role) return '?';
  return role.charAt(0).toUpperCase();
}

export default function Header({ onMenuOpen, hamburgerRef, menuOpen = false }) {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const links = NAV_LINKS[role] ?? [];

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header role="banner" className={styles.header}>
      <div className={styles.headerInner}>
        {/* Logo */}
        <NavLink to={role === 'educator' ? '/dashboard/educator' : '/dashboard/learner'} className={styles.logo} aria-label="Learning Platform home">
          <span className={styles.logoMark} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 1L16 5V13L9 17L2 13V5L9 1Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M9 7L12 9L9 11L6 9L9 7Z" fill="#1e3a8a" />
            </svg>
          </span>
          Learning Platform
        </NavLink>

        {/* Desktop navigation */}
        <nav aria-label="Main navigation" className={styles.desktopNav}>
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right side: avatar + role badge + logout */}
        <div className={styles.userControls}>
          <div className={styles.userInfo} aria-hidden="true">
            <div className={styles.avatar} title={`Logged in as ${role}`}>
              {getInitials(role)}
            </div>
            <span className={styles.roleBadge}>{role}</span>
          </div>

          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
            aria-label="Log out"
          >
            Log out
          </button>

          {/* Hamburger — visible on mobile only */}
          <button
            ref={hamburgerRef}
            type="button"
            className={styles.hamburger}
            onClick={onMenuOpen}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2 5H18M2 10H18M2 15H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

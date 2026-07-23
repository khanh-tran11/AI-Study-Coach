import { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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

function getInitials(role) {
  if (!role) return '?';
  return role.charAt(0).toUpperCase();
}

/**
 * MobileMenu — full-width drawer that slides in from the left.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void   — called when user closes the menu
 *  - triggerRef: ref       — ref to the hamburger button, used to return focus on close
 */
export default function MobileMenu({ isOpen, onClose, triggerRef }) {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const firstLinkRef = useRef(null);
  const closeBtnRef = useRef(null);
  const links = NAV_LINKS[role] ?? [];

  /* Move focus into drawer when it opens */
  useEffect(() => {
    if (isOpen && firstLinkRef.current) {
      firstLinkRef.current.focus();
    }
  }, [isOpen]);

  /* Close on Escape key; trap focus inside drawer */
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      /* Basic focus trap: cycle between close button and last nav link */
      if (e.key === 'Tab') {
        const drawer = document.getElementById('mobile-menu');
        if (!drawer) return;
        const focusable = Array.from(
          drawer.querySelectorAll(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Prevent body scroll when drawer is open */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  function handleClose() {
    onClose();
    /* Return focus to the hamburger button */
    if (triggerRef?.current) {
      triggerRef.current.focus();
    }
  }

  function handleLinkClick() {
    handleClose();
  }

  function handleLogout() {
    handleClose();
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`${styles.mobileBackdrop} ${isOpen ? styles.mobileBackdropVisible : ''}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`${styles.mobileMenu} ${isOpen ? styles.mobileMenuOpen : ''}`}
      >
        {/* Drawer header: logo area + close button */}
        <div className={styles.mobileMenuHeader}>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>
            Menu
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.mobileCloseBtn}
            onClick={handleClose}
            aria-label="Close navigation menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Main navigation">
          <ul className={styles.mobileNav} role="list">
            {links.map(({ to, label }, index) => (
              <li key={to}>
                <NavLink
                  ref={index === 0 ? firstLinkRef : undefined}
                  to={to}
                  end
                  className={({ isActive }) =>
                    isActive
                      ? `${styles.mobileNavLink} ${styles.mobileNavLinkActive}`
                      : styles.mobileNavLink
                  }
                  onClick={handleLinkClick}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info + logout at bottom of drawer */}
        <div className={styles.mobileUserInfo}>
          <div className={styles.avatar} aria-hidden="true">
            {getInitials(role)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
              {role}
            </div>
            <span className={styles.roleBadge}>{role === 'learner' ? 'Learner' : 'Educator'}</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.mobileLogoutBtn}
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>
    </>
  );
}

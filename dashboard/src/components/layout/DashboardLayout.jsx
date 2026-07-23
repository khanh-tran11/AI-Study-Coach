import { useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import MobileMenu from './MobileMenu';
import styles from './DashboardLayout.module.css';

/**
 * DashboardLayout
 *
 * Persistent shell wrapping all authenticated dashboard routes.
 * Renders:
 *  1. Skip-to-content link (first focusable element)
 *  2. Sticky header with desktop nav
 *  3. Mobile drawer (MobileMenu)
 *  4. <main> with the route's content via <Outlet />
 */
export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburgerRef = useRef(null);

  function openMenu() {
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className={styles.dashboardLayout}>
      {/* Skip link — must be first focusable element on the page */}
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      <Header onMenuOpen={openMenu} hamburgerRef={hamburgerRef} menuOpen={menuOpen} />

      <MobileMenu
        isOpen={menuOpen}
        onClose={closeMenu}
        triggerRef={hamburgerRef}
      />

      <main id="main-content" className={styles.mainContent} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

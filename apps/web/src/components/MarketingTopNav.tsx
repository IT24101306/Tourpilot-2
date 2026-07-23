import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

/**
 * Shared forest-green marketing nav (home, login, register).
 */
export function MarketingTopNav() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const onLogin = pathname === "/login";
  const onRegister = pathname.startsWith("/register");

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="mkt-nav">
      <nav className="mkt-nav__bar" aria-label="Main">
        <Link to="/" className="mkt-nav__brand" onClick={closeMenu}>
          <img
            src="/images/tourpilot-logo.png"
            alt=""
            className="mkt-nav__logo"
            width={48}
            height={48}
            decoding="async"
          />
          <span className="mkt-nav__wordmark">
            Tour<span className="mkt-nav__lime">Pilot</span>
          </span>
        </Link>

        <ul className="mkt-nav__links">
          <li>
            <Link to="/#pricing" className="mkt-nav__link" onClick={closeMenu}>
              Pricing
            </Link>
          </li>
          <li>
            <Link to="/#modules" className="mkt-nav__link" onClick={closeMenu}>
              Services
            </Link>
          </li>
          <li>
            <Link to="/#contact" className="mkt-nav__link" onClick={closeMenu}>
              Contact
            </Link>
          </li>
        </ul>

        <div className="mkt-nav__actions">
          <Link
            to="/login"
            className={`mkt-nav__btn mkt-nav__btn--ghost mkt-nav__btn--desktop${onLogin ? " is-active" : ""}`}
            onClick={closeMenu}
            aria-current={onLogin ? "page" : undefined}
          >
            Log in
          </Link>
          <Link
            to="/register"
            className={`mkt-nav__btn mkt-nav__btn--solid mkt-nav__btn--desktop${onRegister ? " is-active" : ""}`}
            onClick={closeMenu}
            aria-current={onRegister ? "page" : undefined}
          >
            Sign up
          </Link>
          <button
            type="button"
            className="mkt-nav__menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg className="mkt-nav__menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="mkt-nav__menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div className="mkt-nav__mobile is-open" id="mkt-mobile-menu">
          <ul>
            <li>
              <Link to="/#pricing" onClick={closeMenu}>
                Pricing
              </Link>
            </li>
            <li>
              <Link to="/#modules" onClick={closeMenu}>
                Services
              </Link>
            </li>
            <li>
              <Link to="/#contact" onClick={closeMenu}>
                Contact
              </Link>
            </li>
            <li className="mkt-nav__mobile-ctas">
              <Link to="/login" className="mkt-nav__btn mkt-nav__btn--ghost" onClick={closeMenu}>
                Log in
              </Link>
              <Link to="/register" className="mkt-nav__btn mkt-nav__btn--solid" onClick={closeMenu}>
                Sign up
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}

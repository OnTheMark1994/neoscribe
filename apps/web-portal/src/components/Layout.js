import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="sf-root">
      <header className="sf-topbar">
        <div className="sf-topbar-left">
          <Link to="/" className="sf-logo-text">
            ScribeFold AI
          </Link>
        </div>
        <nav className="sf-nav">
          <NavLink to="/" end className="sf-nav-link">
            Home
          </NavLink>
          <NavLink to="/downloads" className="sf-nav-link">
            Downloads
          </NavLink>
          <NavLink to="/account" className="sf-nav-link">
            Account
          </NavLink>
          <NavLink to="/help" className="sf-nav-link">
            Help
          </NavLink>
          {user && (
            <NavLink to="/dev" className="sf-nav-link sf-nav-link-dev">
              Dev
            </NavLink>
          )}
        </nav>
        <div className="sf-auth-menu">
          {user ? (
            <>
              <span className="sf-auth-email">{user.email}</span>
              <button className="sf-auth-button" onClick={handleLogout}>
                Log Out
              </button>
            </>
          ) : (
            <Link to="/account" className="sf-auth-button sf-auth-button-outline">
              Log In / Sign Up
            </Link>
          )}
        </div>
      </header>
      <main className="sf-main">{children}</main>
      <footer className="sf-footer">
        <div className="sf-footer-inner">
          <span>{new Date().getFullYear()} ScribeFold AI. All rights reserved.</span>
          <span className="sf-footer-links">
            <a href="https://scribefold.ai" target="_blank" rel="noreferrer">
              Website
            </a>
            <a href="mailto:support@scribefold.ai">Support</a>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

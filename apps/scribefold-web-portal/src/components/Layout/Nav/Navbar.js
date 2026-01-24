import React from 'react';
import { NavLink } from 'react-router-dom';
import AuthButton from './AuthButton';

export default function Navbar() {
  return (
    <header className="sf-topbar">
      <div className="sf-topbar-left">
        <NavLink to="/" className="sf-logo-text">
          ScribeFold AI
        </NavLink>
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
      </nav>
      <div className="sf-auth-menu">
        <AuthButton />
      </div>
    </header>
  );
}

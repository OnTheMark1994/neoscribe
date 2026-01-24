import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import AppInitializer from './Global/AppInitializer';
import Home from './components/Home/Home';
import Downloads from './components/Downloads/Downloads';
import Help from './components/Help/Help';
import './MainDisplay.css';

function App() {
  return (
    <>
      <AppInitializer />
      <div className="sf-root">
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
            <NavLink to="/account" className="sf-auth-button sf-auth-button-outline">
              Log In / Sign Up
            </NavLink>
          </div>
        </header>
        <main className="sf-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/account" element={<div><h1>Account</h1></div>} />
            <Route path="/help" element={<Help />} />
          </Routes>
        </main>
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
    </>
  );
}

export default App;

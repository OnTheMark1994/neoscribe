import React from 'react';
import { NavLink } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const webAppUrl = process.env.REACT_APP_WEB_APP_URL || 'https://scribefold-editor.onrender.com/';

  return (
    <div className="sf-home">
      <section className="sf-hero">
        <div className="sf-hero-left">
          <h1>ScribeFold AI Desktop</h1>
          <p className="sf-hero-tagline">
            A minimalist writing environment with a built in context aware AI writing assistant and foldable chapters and sections for organization.

          </p>
          <p className="sf-hero-sub">
            Check the downloads page for the latest released designed for authors and knowledge workers.
          </p>
          <div className="sf-hero-actions">
            <NavLink to="/downloads" className="sf-primary-btn">Download ScribeFold AI</NavLink>
            <a
              href={webAppUrl}
              className="sf-secondary-btn"
              target="_blank"
              rel="noopener noreferrer"
              style={{ borderColor: 'white', color: 'white' }}
            >
              <span style={{paddingRight: "5px"}}>Try Web App</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 3h7v7" />
                <path d="M10 14L21 3" />
                <path d="M5 5v16h16" />
              </svg>
            </a>
          </div>
        </div>
        <div className="sf-hero-right">
          <div className="sf-hero-video-frame">
            <div className="sf-hero-video-placeholder">
              <span>Product walkthrough video placeholder</span>
            </div>
          </div>
        </div>
      </section>

      <section id="learn-more" className="sf-section sf-section-grid">
        <div>
          <h2>Why ScribeFold AI?</h2>
          <p>
            ScribeFold AI combines a minimalist zen editor with section folding and a powerful integrated AI assistand capable of making small changes or writing entire novels.
          </p>
        </div>
        <div>
          <ul className="sf-feature-list">
            <h3>Features</h3>
            <li>Minimalist distraction free zen workspace</li>
            <li>Foldable chapters and sections for easy organization</li>
            <li>Integrated context aware AI writing assistant </li>
            <li>Optional future-proof encryption</li>
            <li>Customizable backgrounds and themes</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default Home;

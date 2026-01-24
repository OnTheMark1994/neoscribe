import React from 'react';

export default function Footer() {
  return (
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
  );
}

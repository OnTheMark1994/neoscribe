import React from 'react';
import './Downloads.css';

const Downloads = () => {
  return (
    <div className="sf-page">
      <header className="sf-page-header">
        <h1>Downloads</h1>
        <p>Get the latest ScribeFold AI desktop builds for your platform.</p>
      </header>

      <section className="sf-download-grid">
        <div className="sf-download-card">
          <h2>Windows</h2>
          <p>Recommended for most users. 64-bit installer.</p>
          <a 
            href="#"
            className="sf-download-btn"
          >
            Download for Windows
          </a>
        </div>
        <div className="sf-download-card">
          <h2>macOS</h2>
          <p>Universal build for Apple Silicon and Intel Macs.</p>
          <a 
            href="#"
            className="sf-download-btn"
          >
            Download for macOS
          </a>
        </div>
        <div className="sf-download-card">
          <h2>Linux</h2>
          <p>AppImage build for modern desktop distributions.</p>
          <a 
            href="#"
            className="sf-download-btn"
          >
            Download for Linux
          </a>
        </div>
      </section>
    </div>
  );
};

export default Downloads;

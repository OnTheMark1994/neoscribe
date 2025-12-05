import React, { useState, useEffect } from 'react';
import { GITHUB_RELEASES_API, GITHUB_REPO_OWNER, GITHUB_REPO_NAME } from '../constants';
import './DownloadsPage.css';

const DownloadsPage = () => {
  const [releaseData, setReleaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch latest release from GitHub API (public, no auth needed)
    fetch(GITHUB_RELEASES_API)
      .then(res => {
        if (!res.ok) {
          throw new Error('No releases found yet');
        }
        return res.json();
      })
      .then(data => {
        setReleaseData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Extract version from tag (e.g., "v1.0.0" -> "1.0.0")
  const version = releaseData?.tag_name?.replace('v', '') || '1.0.0';
  
  // Build download URLs based on electron-builder artifact naming
  // Format: "ScribeFold AI-Setup-1.0.0.exe" (note the space in product name)
  const getDownloadUrl = (platform) => {
    const baseUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/download/${releaseData?.tag_name || 'v1.0.0'}`;
    
    switch(platform) {
      case 'windows':
        return `${baseUrl}/ScribeFold%20AI-Setup-${version}.exe`;
      case 'mac':
        return `${baseUrl}/ScribeFold%20AI-${version}.dmg`;
      case 'linux':
        return `${baseUrl}/ScribeFold%20AI-${version}.AppImage`;
      default:
        return '#';
    }
  };

  return (
    <div className="sf-page">
      <header className="sf-page-header">
        <h1>Downloads</h1>
        <p>Get the latest ScribeFold AI desktop builds for your platform.</p>
        {loading && <p className="sf-loading">Loading release info...</p>}
        {error && <p className="sf-error">⚠️ {error}. Using fallback version.</p>}
        {releaseData && <p className="sf-version">Latest version: {version}</p>}
      </header>

      <section className="sf-download-grid">
        <div className="sf-download-card">
          <h2>Windows</h2>
          <p>Recommended for most users. 64-bit installer.</p>
          <a 
            href={getDownloadUrl('windows')} 
            className="sf-download-btn"
            download
          >
            Download for Windows
          </a>
        </div>
        <div className="sf-download-card">
          <h2>macOS</h2>
          <p>Universal build for Apple Silicon and Intel Macs.</p>
          <a 
            href={getDownloadUrl('mac')} 
            className="sf-download-btn"
            download
          >
            Download for macOS
          </a>
        </div>
        <div className="sf-download-card">
          <h2>Linux</h2>
          <p>AppImage build for modern desktop distributions.</p>
          <a 
            href={getDownloadUrl('linux')} 
            className="sf-download-btn"
            download
          >
            Download for Linux
          </a>
        </div>
      </section>

      {releaseData && (
        <section className="sf-page-section">
          <h2>Release Notes</h2>
          <h3>{releaseData.name || `Version ${version}`}</h3>
          <p className="sf-release-date">
            Released: {new Date(releaseData.published_at).toLocaleDateString()}
          </p>
          <div className="sf-release-body">
            {releaseData.body || 'No release notes available.'}
          </div>
        </section>
      )}
    </div>
  );
};

export default DownloadsPage;

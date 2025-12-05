import React, { useState, useEffect } from 'react';
import { GITHUB_REPO } from '../constants';
import './DownloadsPage.css';

const DownloadsPage = () => {
  const [release, setRelease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLatestRelease();
  }, []);

  const fetchLatestRelease = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch latest release from GitHub API
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch release: ${response.status}`);
      }

      const data = await response.json();
      setRelease(data);
    } catch (err) {
      console.error('Error fetching release:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAssetsByPlatform = () => {
    if (!release || !release.assets) return {};

    const assets = {
      windows: null,
      mac: null,
      linux: null,
    };

    release.assets.forEach((asset) => {
      const name = asset.name.toLowerCase();
      if (name.includes('setup') && name.endsWith('.exe')) {
        assets.windows = asset;
      } else if (name.endsWith('.dmg')) {
        assets.mac = asset;
      } else if (name.endsWith('.appimage')) {
        assets.linux = asset;
      }
    });

    return assets;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    return ` (${mb} MB)`;
  };

  const assets = getAssetsByPlatform();

  if (loading) {
    return (
      <div className="sf-page">
        <header className="sf-page-header">
          <h1>Downloads</h1>
          <p>Loading latest version...</p>
        </header>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sf-page">
        <header className="sf-page-header">
          <h1>Downloads</h1>
          <p className="error-text">Failed to load downloads: {error}</p>
          <button onClick={fetchLatestRelease} className="sf-download-btn retry-btn">
            Retry
          </button>
        </header>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="sf-page">
        <header className="sf-page-header">
          <h1>Downloads</h1>
          <p>No releases available yet.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="sf-page">
      <header className="sf-page-header">
        <h1>Downloads</h1>
        <p>Get the latest ScribeFold AI desktop builds for your platform.</p>
        <p className="version-badge">
          Latest: <strong>{release.tag_name}</strong> • Released: {new Date(release.published_at).toLocaleDateString()}
        </p>
      </header>

      <section className="sf-download-grid">
        {assets.windows && (
          <div className="sf-download-card">
            <h2>🪟 Windows</h2>
            <p>Recommended for most users. 64-bit installer{formatFileSize(assets.windows.size)}.</p>
            <a href={assets.windows.browser_download_url} className="sf-download-btn" download>
              Download for Windows
            </a>
          </div>
        )}
        
        {assets.mac && (
          <div className="sf-download-card">
            <h2>🍎 macOS</h2>
            <p>Universal build for Apple Silicon and Intel Macs{formatFileSize(assets.mac.size)}.</p>
            <a href={assets.mac.browser_download_url} className="sf-download-btn" download>
              Download for macOS
            </a>
          </div>
        )}
        
        {assets.linux && (
          <div className="sf-download-card">
            <h2>🐧 Linux</h2>
            <p>AppImage build for modern desktop distributions{formatFileSize(assets.linux.size)}.</p>
            <a href={assets.linux.browser_download_url} className="sf-download-btn" download>
              Download for Linux
            </a>
          </div>
        )}
      </section>

      {release.body && (
        <section className="sf-page-section">
          <h2>Release Notes</h2>
          <div className="release-notes-body">{release.body}</div>
        </section>
      )}
    </div>
  );
};

export default DownloadsPage;

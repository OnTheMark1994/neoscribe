import React, { useState, useEffect } from 'react';
import { GITHUB_REPO } from '../constants';
import './DownloadPage.css';

const DownloadPage = () => {
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
    if (!bytes) return 'Unknown size';
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    return `${mb} MB`;
  };

  const assets = getAssetsByPlatform();

  if (loading) {
    return (
      <div className="download-page">
        <div className="download-container">
          <h1>Download ScribeFold AI</h1>
          <p>Loading latest version...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="download-page">
        <div className="download-container">
          <h1>Download ScribeFold AI</h1>
          <div className="error-message">
            <p>Failed to load download information: {error}</p>
            <button onClick={fetchLatestRelease} className="retry-button">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="download-page">
        <div className="download-container">
          <h1>Download ScribeFold AI</h1>
          <p>No releases available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="download-page">
      <div className="download-container">
        <h1>Download ScribeFold AI</h1>
        <p className="version-info">
          Latest Version: <strong>{release.tag_name}</strong>
        </p>
        <p className="release-date">
          Released: {new Date(release.published_at).toLocaleDateString()}
        </p>

        <div className="download-options">
          {assets.windows && (
            <div className="download-card">
              <div className="platform-icon">🪟</div>
              <h3>Windows</h3>
              <p className="file-size">{formatFileSize(assets.windows.size)}</p>
              <a
                href={assets.windows.browser_download_url}
                className="download-button"
                download
              >
                Download for Windows
              </a>
              <p className="file-name">{assets.windows.name}</p>
            </div>
          )}

          {assets.mac && (
            <div className="download-card">
              <div className="platform-icon">🍎</div>
              <h3>macOS</h3>
              <p className="file-size">{formatFileSize(assets.mac.size)}</p>
              <a
                href={assets.mac.browser_download_url}
                className="download-button"
                download
              >
                Download for macOS
              </a>
              <p className="file-name">{assets.mac.name}</p>
            </div>
          )}

          {assets.linux && (
            <div className="download-card">
              <div className="platform-icon">🐧</div>
              <h3>Linux</h3>
              <p className="file-size">{formatFileSize(assets.linux.size)}</p>
              <a
                href={assets.linux.browser_download_url}
                className="download-button"
                download
              >
                Download for Linux
              </a>
              <p className="file-name">{assets.linux.name}</p>
            </div>
          )}
        </div>

        {release.body && (
          <div className="release-notes">
            <h2>Release Notes</h2>
            <div className="release-body">{release.body}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DownloadPage;

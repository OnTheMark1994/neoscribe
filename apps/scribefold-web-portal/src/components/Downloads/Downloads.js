import React, { useState, useEffect } from 'react';
import './Downloads.css';

const Downloads = () => {
  const [allReleases, setAllReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL;
  const GITHUB_REPO_OWNER = process.env.REACT_APP_GITHUB_REPO_OWNER;
  const GITHUB_REPO_NAME = process.env.REACT_APP_GITHUB_REPO_NAME;

  useEffect(() => {
    console.log('[Downloads] Loading releases...');
    const url = `${API_BASE_URL}/data/releases`;
    
    fetch(url)
      .then(res => {
        console.log('[Downloads] /data/releases status:', res.status);
        if (!res.ok) {
          return res.text().then(text => {
            console.log('[Downloads] /data/releases error body:', text);
            throw new Error('No releases found yet');
          });
        }
        return res.json();
      })
      .then(data => {
        console.log('[Downloads] Raw releases data:', data);
        // Filter out releases without assets AND malformed tag names (e.g., just "v")
        const validReleases = data
          .filter(release => release.assets && release.assets.length > 0)
          .filter(release => /^v\d+\.\d+\.\d+$/.test(release.tag_name)); // Only vX.Y.Z format
        console.log('[Downloads] Valid releases with assets:', validReleases);
        setAllReleases(validReleases);
        // Auto-select the latest (first in array)
        if (validReleases.length > 0) {
          console.log('[Downloads] Auto-selecting latest release:', validReleases[0].tag_name);
          setSelectedRelease(validReleases[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('[Downloads] Error fetching releases:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Extract version from tag (e.g., "v1.0.0" -> "1.0.0")
  const version = selectedRelease?.tag_name?.replace('v', '') || '1.0.0';
  
  // Build download URLs using actual asset names from the release
  const getDownloadUrl = (platform) => {
    if (!selectedRelease || !selectedRelease.assets) return '#';
    
    // Find the actual asset for this platform
    let assetName;
    switch(platform) {
      case 'windows':
        assetName = selectedRelease.assets.find(a => a.name.endsWith('.exe'))?.name;
        break;
      case 'mac':
        assetName = selectedRelease.assets.find(a => a.name.endsWith('.dmg'))?.name;
        break;
      case 'linux':
        assetName = selectedRelease.assets.find(a => a.name.endsWith('.AppImage'))?.name;
        break;
      default:
        return '#';
    }
    
    if (!assetName) return '#';
    
    const url = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/download/${selectedRelease.tag_name}/${assetName}`;
    console.log(`[Downloads] ${platform} download URL:`, url);
    return url;
  };

  const handleVersionSelect = (e) => {
    const release = allReleases.find(r => r.tag_name === e.target.value);
    console.log('[Downloads] Version selected:', release?.tag_name);
    setSelectedRelease(release);
  };

  const handleDownloadClick = (platform) => {
    const url = getDownloadUrl(platform);
    console.log(`[Downloads] Download clicked for ${platform}:`, url);
    if (url !== '#') {
      window.location.href = url;
    } else {
      console.warn(`[Downloads] No download available for ${platform} in this release`);
    }
  };

  return (
    <div className="sf-page">
      <header className="sf-page-header">
        <h1>Downloads</h1>
        <p>Get the latest ScribeFold AI desktop builds for your platform.</p>
        {loading && <p className="sf-loading">Loading release info...</p>}
        {error && <p className="sf-error">⚠️ {error}. Using fallback version.</p>}
        
        {allReleases.length > 0 && (
          <div className="sf-version-selector">
            <label htmlFor="version-select">Select Version: </label>
            <select 
              id="version-select"
              value={selectedRelease?.tag_name || ''}
              onChange={handleVersionSelect}
              className="sf-version-dropdown"
            >
              {allReleases.map((release) => (
                <option key={release.id} value={release.tag_name}>
                  {release.tag_name} {release === allReleases[0] ? '(Latest)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <section className="sf-download-grid">
        <div className="sf-download-card">
          <h2>Windows</h2>
          <p>Recommended for most users. 64-bit installer.</p>
          <button 
            className="sf-download-btn"
            onClick={() => handleDownloadClick('windows')}
          >
            Download for Windows
          </button>
        </div>
        <div className="sf-download-card">
          <h2>macOS</h2>
          <p>Universal build for Apple Silicon and Intel Macs.</p>
          <button 
            className="sf-download-btn"
            onClick={() => handleDownloadClick('mac')}
          >
            Download for macOS
          </button>
        </div>
        <div className="sf-download-card">
          <h2>Linux</h2>
          <p>AppImage build for modern desktop distributions.</p>
          <button 
            className="sf-download-btn"
            onClick={() => handleDownloadClick('linux')}
          >
            Download for Linux
          </button>
        </div>
      </section>

      {selectedRelease && (
        <section className="sf-page-section">
          <h2>Release Notes</h2>
          <h3>{selectedRelease.name || `Version ${version}`}</h3>
          <p className="sf-release-date">
            Released: {new Date(selectedRelease.published_at).toLocaleDateString()}
          </p>
          <div className="sf-release-body">
            {selectedRelease.body || 'No release notes available.'}
          </div>
        </section>
      )}
    </div>
  );
};

export default Downloads;

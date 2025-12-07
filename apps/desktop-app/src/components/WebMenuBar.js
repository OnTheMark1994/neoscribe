import React, { useState, useEffect, useRef } from 'react';
import './WebMenuBar.css';

/**
 * WebMenuBar - Menu bar shown in web browser mode (replaces Electron native menu)
 */
function WebMenuBar({ 
  onNew, 
  onOpen, 
  onDownloadInfo,
  onSettings,
  onToggleAI,
  onFoldAll,
  onUnfoldAll,
  isAIEnabled,
  currentFileName,
  isModified
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts for web
  useEffect(() => {
    const handleKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        onNew?.();
      } else if (ctrl && e.key === 'o') {
        e.preventDefault();
        onOpen?.();
      } else if (ctrl && e.key === 's') {
        // Ctrl+S opens the download info modal in web mode
        e.preventDefault();
        onDownloadInfo?.();
      } else if (ctrl && e.key === ',') {
        e.preventDefault();
        onSettings?.();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onNew, onOpen, onDownloadInfo, onSettings]);

  const handleMenuClick = (action) => {
    setActiveMenu(null);
    action?.();
  };

  const displayName = currentFileName 
    ? `${isModified ? '* ' : ''}${currentFileName}`
    : (isModified ? '* Untitled' : 'Untitled');

  return (
    <div className="web-menu-bar" ref={menuRef}>
      <div className="web-menu-left">
        <img src="/app-images/scribefold-ai-icon-png.png" alt="" className="web-menu-logo" />
        
        {/* File Menu */}
        <div className="web-menu-item">
          <button 
            className={`web-menu-btn ${activeMenu === 'file' ? 'active' : ''}`}
            onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="web-menu-dropdown">
              <button onClick={() => handleMenuClick(onNew)}>
                <span>New</span><span className="shortcut">Ctrl+N</span>
              </button>
              <button onClick={() => handleMenuClick(onOpen)}>
                <span>Open / Upload...</span><span className="shortcut">Ctrl+O</span>
              </button>
              <div className="web-menu-divider" />
              <button onClick={() => handleMenuClick(onDownloadInfo)}>
                <span>Save/Download</span><span className="shortcut">Ctrl+S</span>
              </button>
              <div className="web-menu-divider" />
              <button onClick={() => handleMenuClick(onSettings)}>
                <span>Settings</span><span className="shortcut">Ctrl+,</span>
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="web-menu-item">
          <button 
            className={`web-menu-btn ${activeMenu === 'view' ? 'active' : ''}`}
            onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
          >
            View
          </button>
          {activeMenu === 'view' && (
            <div className="web-menu-dropdown">
              <button onClick={() => handleMenuClick(onToggleAI)}>
                <span>{isAIEnabled ? 'Hide AI Panel' : 'Show AI Panel'}</span>
              </button>
              <div className="web-menu-divider" />
              <button onClick={() => handleMenuClick(onFoldAll)}>
                <span>Fold All</span>
              </button>
              <button onClick={() => handleMenuClick(onUnfoldAll)}>
                <span>Unfold All</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="web-menu-center">
        <span className="web-menu-filename">{displayName}</span>
      </div>

      <div className="web-menu-right">
        <a 
          href="https://scribefold-ai-monorepo.onrender.com/#/downloads" 
          target="_blank" 
          rel="noopener noreferrer"
          className="web-menu-desktop-link"
          title="Download Desktop App"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          <span>Desktop App</span>
        </a>
      </div>
    </div>
  );
}

export default WebMenuBar;

import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsAIEnabled, setIsAIEnabled, setBackgroundImage } from '../store/settingsSlice';
import { selectCurrentFilePath, selectIsModified } from '../store/editorSlice';
import { isElectron, isWeb } from '../utils/environment';
import './WebMenuBar.css';

/**
 * WebMenuBar - Unified menu bar for BOTH web and Electron
 * 
 * ORGANIZATIONAL STANDARDS:
 * - Environment detection at the top (IS_WEB, IS_ELECTRON constants)
 * - Conditional logic for web vs Electron in handlers
 * - Single component for both environments (reusability)
 * - Redux for state (minimal prop drilling)
 * - Clear, readable function names
 * 
 * FEATURES:
 * - All features from native Electron menu
 * - All features from web menu
 * - Auto-hide in fullscreen (both environments)
 * - Environment-specific options (Exit, Save As, Themes for Electron only)
 */

// ============================================================================
// ENVIRONMENT DETECTION - Single source of truth
// ============================================================================
const IS_WEB = isWeb();
const IS_ELECTRON = isElectron();
function WebMenuBar({ 
  onNew, 
  onOpen, 
  onSave, // Electron: direct save, Web: shows download modal
  onSaveAs, // Electron only
  onDownloadInfo, // Web only
  onSettings,
  onFoldAll,
  onUnfoldAll,
  onToggleFullscreen,
  isFullscreen = false,
}) {
  const dispatch = useDispatch();
  
  // Read from Redux
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const currentFilePath = useSelector(selectCurrentFilePath);
  const isModified = useSelector(selectIsModified);
  
  // Extract filename from path
  const currentFileName = currentFilePath 
    ? currentFilePath.split(/[/\\]/).pop() 
    : null;
  const [activeMenu, setActiveMenu] = useState(null);
  const [showBar, setShowBar] = useState(true);
  const [themes, setThemes] = useState([]);
  const hideTimeoutRef = useRef(null);
  const menuRef = useRef(null);

  // Load themes list for Electron
  useEffect(() => {
    if (IS_ELECTRON && window.electronAPI?.getThemeList) {
      window.electronAPI.getThemeList().then(themeList => {
        if (themeList) setThemes(themeList);
      }).catch(err => console.error('Failed to load themes:', err));
    }
  }, []);

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

  // Comprehensive keyboard shortcuts for both web and Electron
  useEffect(() => {
    const handleKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      
      // File shortcuts
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        onNew?.();
      } else if (ctrl && e.key === 'o') {
        e.preventDefault();
        onOpen?.();
      } else if (ctrl && shift && e.key === 'S') {
        // Ctrl+Shift+S - Save As (Electron only)
        e.preventDefault();
        if (IS_ELECTRON) onSaveAs?.();
      } else if (ctrl && e.key === 's') {
        // Ctrl+S - Save (Electron) or Download (Web)
        e.preventDefault();
        if (IS_WEB) {
          onDownloadInfo?.();
        } else {
          onSave?.();
        }
      } else if (ctrl && e.key === ',') {
        e.preventDefault();
        onSettings?.();
      }
      // View shortcuts
      else if (e.key === 'F11') {
        e.preventDefault();
        handleFullscreen();
      } else if (ctrl && shift && e.key === 'W') {
        // Ctrl+Shift+W - Toggle AI
        e.preventDefault();
        dispatch(setIsAIEnabled(!isAIEnabled));
      } else if (ctrl && shift && e.key === '[') {
        // Ctrl+Shift+[ - Fold All
        e.preventDefault();
        onFoldAll?.();
      } else if (ctrl && shift && e.key === ']') {
        // Ctrl+Shift+] - Unfold All
        e.preventDefault();
        onUnfoldAll?.();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onNew, onOpen, onSave, onSaveAs, onDownloadInfo, onSettings, onFoldAll, onUnfoldAll, isAIEnabled, dispatch]);

  // Keep bar visibility in sync with fullscreen state (both web and Electron)
  useEffect(() => {
    if (isFullscreen) {
      // When entering fullscreen, start with the bar hidden until hovered
      setShowBar(false);
    } else {
      // When exiting fullscreen, always show the bar
      setShowBar(true);
    }
  }, [isFullscreen]);

  // Handlers
  const handleFullscreen = () => {
    // Let parent decide how to toggle fullscreen based on environment
    onToggleFullscreen?.();
  };

  const handleExit = () => {
    if (IS_ELECTRON && window.electronAPI?.quitApp) {
      window.electronAPI.quitApp();
    }
  };

  const handleThemeSelect = (themePath) => {
    if (IS_ELECTRON) {
      dispatch(setBackgroundImage(themePath));
      // Also update via setBackground helper
      const { setBackground } = require('../utils/backgroundHelper');
      setBackground(themePath);
    }
  };

  const handleCustomTheme = async () => {
    if (IS_ELECTRON && window.electronAPI?.selectCustomTheme) {
      const result = await window.electronAPI.selectCustomTheme();
      if (result && !result.canceled && result.filePath) {
        handleThemeSelect(result.filePath);
      }
    }
  };

  // In fullscreen mode, hide the inner bar when the mouse leaves the shell
  const handleShellMouseEnter = () => {
    if (!isFullscreen) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowBar(true);
  };

  const handleShellMouseLeave = () => {
    if (!isFullscreen) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setShowBar(false);
      hideTimeoutRef.current = null;
    }, 500);
  };

  const handleMenuClick = (action) => {
    setActiveMenu(null);
    action?.();
  };

  const displayName = currentFileName 
    ? `${isModified ? '* ' : ''}${currentFileName}`
    : (isModified ? '* Untitled' : 'Untitled');

  const barClasses = `web-menu-bar ${isFullscreen && !showBar ? 'web-menu-bar-hidden' : ''}`;

  return (
    <div
      className="web-menu-shell"
      onMouseEnter={handleShellMouseEnter}
      onMouseLeave={handleShellMouseLeave}
    >
    <div className={barClasses} ref={menuRef}>
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
                <span>{IS_WEB ? 'Open / Upload...' : 'Open...'}</span>
                <span className="shortcut">Ctrl+O</span>
              </button>
              <div className="web-menu-divider" />
              {IS_WEB ? (
                <button onClick={() => handleMenuClick(onDownloadInfo)}>
                  <span>Save/Download</span><span className="shortcut">Ctrl+S</span>
                </button>
              ) : (
                <>
                  <button onClick={() => handleMenuClick(onSave)}>
                    <span>Save</span><span className="shortcut">Ctrl+S</span>
                  </button>
                  <button onClick={() => handleMenuClick(onSaveAs)}>
                    <span>Save As</span><span className="shortcut">Ctrl+Shift+S</span>
                  </button>
                </>
              )}
              <div className="web-menu-divider" />
              <button onClick={() => handleMenuClick(onSettings)}>
                <span>Settings</span><span className="shortcut">Ctrl+,</span>
              </button>
              {IS_ELECTRON && (
                <>
                  <div className="web-menu-divider" />
                  <button onClick={() => handleMenuClick(handleExit)}>
                    <span>Exit</span>
                  </button>
                </>
              )}
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
              {/* Fullscreen */}
              <button onClick={() => handleMenuClick(handleFullscreen)}>
                <span>{isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}</span>
                <span className="shortcut">F11</span>
              </button>
              <div className="web-menu-divider" />

              {/* Themes (Electron only) */}
              {IS_ELECTRON && themes.length > 0 && (
                <>
                  <div className="web-menu-item">
                    <button 
                      className={`web-menu-btn ${activeMenu === 'themes' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === 'themes' ? null : 'themes');
                      }}
                    >
                      <span>Themes</span>
                      <span className="submenu-arrow">▶</span>
                    </button>
                    {activeMenu === 'themes' && (
                      <div className="web-menu-dropdown web-menu-submenu">
                        {themes.map((theme, index) => (
                          <button 
                            key={index}
                            onClick={() => {
                              setActiveMenu(null);
                              handleThemeSelect(theme.path);
                            }}
                          >
                            <span>{theme.name}</span>
                          </button>
                        ))}
                        <div className="web-menu-divider" />
                        <button onClick={() => {
                          setActiveMenu(null);
                          handleCustomTheme();
                        }}>
                          <span>Select Custom Image...</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="web-menu-divider" />
                </>
              )}

              {/* AI panel */}
              <button onClick={() => { setActiveMenu(null); dispatch(setIsAIEnabled(!isAIEnabled)); }}>
                <span>{isAIEnabled ? 'Hide AI Panel' : 'Show AI Panel'}</span>
                <span className="shortcut">Ctrl+Shift+W</span>
              </button>
              <div className="web-menu-divider" />

              {/* Fold controls with shortcuts */}
              <button onClick={() => handleMenuClick(onFoldAll)}>
                <span>Fold All</span>
                <span className="shortcut">Ctrl+Shift+[</span>
              </button>
              <button onClick={() => handleMenuClick(onUnfoldAll)}>
                <span>Unfold All</span>
                <span className="shortcut">Ctrl+Shift+]</span>
              </button>
              <div className="web-menu-divider" />

              {/* View modes - direct selectors */}
              <button
                onClick={() => {
                  setActiveMenu(null);
                  localStorage.setItem('editorViewMode', 'array');
                  window.dispatchEvent(new StorageEvent('storage', { key: 'editorViewMode', newValue: 'array' }));
                }}
              >
                <span>Array View</span>
              </button>
              <button
                onClick={() => {
                  setActiveMenu(null);
                  localStorage.setItem('editorViewMode', 'textarea');
                  window.dispatchEvent(new StorageEvent('storage', { key: 'editorViewMode', newValue: 'textarea' }));
                }}
              >
                <span>Textarea View</span>
              </button>
              <button
                onClick={() => {
                  setActiveMenu(null);
                  localStorage.setItem('editorViewMode', 'monaco');
                  window.dispatchEvent(new StorageEvent('storage', { key: 'editorViewMode', newValue: 'monaco' }));
                }}
              >
                <span>Monaco View</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="web-menu-center">
        <span className="web-menu-filename">{displayName}</span>
      </div>

      <div className="web-menu-right">
        {IS_WEB && (
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
        )}
      </div>
    </div>
    </div>
  );
}

export default WebMenuBar;

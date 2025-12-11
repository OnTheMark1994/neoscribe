import React, { useState, useEffect, useRef, useContext } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsAIEnabled, setIsAIEnabled, setBackgroundImage } from '../../store/settingsSlice';
import { selectCurrentFilePath, selectIsModified, selectContent, selectViewType, setViewType, fileOpened, resetEditor, bumpFoldAllTrigger, bumpUnfoldAllTrigger, bumpSaveTrigger } from '../../store/editorSlice';
import { openSettings, openDownloadModal } from '../../store/uiSlice';
import { showStatus } from '../../store/statusSlice';
import { isElectron, isWeb } from '../../utils/environment';
import { EditorContext } from '../../contexts/EditorContext';
import * as fileOps from '../../utils/fileOps';
import { parseText } from '../../utils/editorEngine';
import './WebMenuBar.css';

/**
 * WebMenuBar - Unified menu bar for BOTH web and Electron
 * 
 * WHAT: Provides File/Edit/View menu bar visible in both web mode and Electron
 * 
 * WHY UNIFIED: Previously separate implementations, now single component for maintainability
 * 
 * USES EditorContext: Calls editor methods directly (saveFile, openFile, foldAll, etc)
 * NO CALLBACKS: Removed all callback props, uses useContext(EditorContext) instead
 * 
 * FEATURES:
 *   - File operations (New, Open, Save, Save As)
 *   - View operations (Fold All, Unfold All)
 *   - Settings and Help dialogs
 *   - Auto-hide in fullscreen
 *   - Environment-specific options (Electron has Save As, Exit, Themes)
 * 
 * ARCHITECTURE:
 *   - Reads state from Redux (isAIEnabled, currentFilePath, isModified)
 *   - Calls Editor methods via EditorContext (no prop drilling)
 *   - Dispatches to Redux for settings/UI state (openSettings, setIsAIEnabled)
 */

// WHAT: Runtime environment constants - single source of truth for conditional logic
// WHY CONSTANTS: Avoid repeated function calls, clearer code intent
const IS_WEB = isWeb();
const IS_ELECTRON = isElectron();

function WebMenuBar() {
  // WHAT: Redux dispatch for settings/UI actions
  // WHY: WebMenuBar can toggle AI, open settings, etc
  const dispatch = useDispatch();
  
  // WHAT: Get editorRef from Context for view-related methods (foldAll, unfoldAll, save)
  // NOTE: Open/New operations moved to fileOps utility (Design Principle 11)
  // WHY SAVE STILL IN EDITOR: Save needs to extract content from active view (array/monaco/textarea)
  // TODO: Move save operations out once content sync strategy is finalized
  const editorContextValue = useContext(EditorContext);
  const editorRef = editorContextValue || { current: null };
  
  // WHAT: Read global state from Redux for UI display
  // isAIEnabled: Show AI toggle state in menu
  // currentFilePath: Display filename in title, enable/disable save
  // isModified: Show "*" indicator, enable/disable save
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const currentFilePath = useSelector(selectCurrentFilePath);
  const isModified = useSelector(selectIsModified);
  const viewType = useSelector(selectViewType); // 'array' or 'monaco'
  
  // WHAT: Extract just the filename from full path for display
  // WHY: Full path would be too long for menu bar
  const currentFileName = currentFilePath 
    ? currentFilePath.split(/[/\\]/).pop() 
    : null;
  
  // WHAT: Local UI state for menu bar behavior
  // activeMenu: Which dropdown is open ('file', 'edit', 'view', 'help', or null)
  // showBar: Whether menu bar is visible (auto-hide in fullscreen)
  // isFullscreen: Whether app is in fullscreen mode
  // themes: List of available themes (Electron only)
  const [activeMenu, setActiveMenu] = useState(null);
  const [showBar, setShowBar] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [themes, setThemes] = useState([]);
  
  // WHAT: Refs for menu behavior
  // hideTimeoutRef: Debounce auto-hide in fullscreen
  // menuRef: Detect clicks outside menu to close dropdown
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

  // WHAT: Global keyboard shortcuts for menu actions
  // WHY: Users expect shortcuts to work even when menu not focused
  // USES: fileOps utilities + Redux for file operations, EditorContext for view operations
  useEffect(() => {
    const handleKeyDown = async (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      
      // File shortcuts
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      } else if (ctrl && e.key === 'o') {
        e.preventDefault();
        handleOpenFile();
      } else if (ctrl && shift && e.key === 'S') {
        // Ctrl+Shift+S - Save As (Electron only) - handled via save flow in editor using saveTrigger
        e.preventDefault();
        if (IS_ELECTRON) {
          dispatch(bumpSaveTrigger());
        }
      } else if (ctrl && e.key === 's') {
        // Ctrl+S - Save (Electron) or open Download modal (Web)
        e.preventDefault();
        if (IS_WEB) {
          dispatch(openDownloadModal());
        } else {
          dispatch(bumpSaveTrigger());
        }
      } else if (ctrl && e.key === ',') {
        e.preventDefault();
        dispatch(openSettings({ tab: 'general' }));
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
        dispatch(bumpFoldAllTrigger());
      } else if (ctrl && shift && e.key === ']') {
        // Ctrl+Shift+] - Unfold All
        e.preventDefault();
        dispatch(bumpUnfoldAllTrigger());
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editorRef, isAIEnabled, dispatch]);
  
  // File operation handlers using fileOps utility (Design Principle 11)
  const handleNewFile = () => {
    if (window.isModified) {
      if (!window.confirm('You have unsaved changes. Continue?')) return;
    }
    dispatch(resetEditor());
    parseText(''); // Clear editorEngine for array view
  };
  
  const handleOpenFile = async () => {
    const result = await fileOps.openFile();
    if (result.success) {
      dispatch(fileOpened({ filePath: result.filePath || result.fileName, content: result.content }));
      parseText(result.content); // Update editorEngine for array view
      if (result.filePath) {
        localStorage.setItem('lastOpenedFile', result.filePath);
      }
    } else if (result.error) {
      dispatch(showStatus('Failed to open file: ' + result.error));
    }
  };

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

  // Track browser fullscreen state in web mode
  useEffect(() => {
    if (!IS_WEB) return;

    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;
      setIsFullscreen(!!fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Track fullscreen state in Electron via IPC events from main process
  useEffect(() => {
    if (!IS_ELECTRON || !window.electronAPI || !window.electronAPI.onFullscreenChanged) return;

    const handler = (data) => {
      if (data && typeof data.isFullScreen === 'boolean') {
        setIsFullscreen(data.isFullScreen);
      }
    };

    window.electronAPI.onFullscreenChanged(handler);
  }, []);

  // Handlers
  const handleFullscreen = async () => {
    if (IS_WEB) {
      const doc = document;
      const docEl = doc.documentElement;
      const fullscreenElement =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;

      if (!fullscreenElement) {
        const request =
          docEl.requestFullscreen ||
          docEl.webkitRequestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.msRequestFullscreen;
        if (request) {
          request.call(docEl);
        }
      } else {
        const exit =
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen;
        if (exit) {
          exit.call(doc);
        }
      }
    } else if (IS_ELECTRON && window.electronAPI && window.electronAPI.toggleFullscreen) {
      try {
        const result = await window.electronAPI.toggleFullscreen();
        if (result && typeof result.isFullScreen === 'boolean') {
          setIsFullscreen(result.isFullScreen);
        } else {
          setIsFullscreen(prev => !prev);
        }
      } catch (e) {
        console.error('[MENU] toggleFullscreen failed', e);
      }
    }
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
      const { setBackground } = require('../../utils/backgroundHelper');
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
              <button onClick={() => handleMenuClick(handleNewFile)}>
                <span>New</span><span className="shortcut">Ctrl+N</span>
              </button>
              <button onClick={() => handleMenuClick(handleOpenFile)}>
                <span>{IS_WEB ? 'Open / Upload...' : 'Open...'}</span>
                <span className="shortcut">Ctrl+O</span>
              </button>
              <div className="web-menu-divider" />
              {IS_WEB ? (
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    dispatch(openDownloadModal());
                  }}
                >
                  <span>Save/Download</span><span className="shortcut">Ctrl+S</span>
                </button>
              ) : (
                <>
                  <button onClick={() => handleMenuClick(() => dispatch(bumpSaveTrigger()))}>
                    <span>Save</span><span className="shortcut">Ctrl+S</span>
                  </button>
                  <button onClick={() => handleMenuClick(() => dispatch(bumpSaveTrigger()))}>
                    <span>Save As</span><span className="shortcut">Ctrl+Shift+S</span>
                  </button>
                </>
              )}
              <div className="web-menu-divider" />
              <button
                onClick={() => {
                  setActiveMenu(null);
                  dispatch(openSettings({ tab: 'general' }));
                }}
              >
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
              <button onClick={() => handleMenuClick(() => dispatch(bumpFoldAllTrigger()))}>
                <span>Fold All</span>
                <span className="shortcut">Ctrl+Shift+[</span>
              </button>
              <button onClick={() => handleMenuClick(() => dispatch(bumpUnfoldAllTrigger()))}>
                <span>Unfold All</span>
                <span className="shortcut">Ctrl+Shift+]</span>
              </button>
              <div className="web-menu-divider" />

              {/* View modes - switch between Array Editor and Monaco Editor */}
              <button
                onClick={() => {
                  setActiveMenu(null);
                  dispatch(setViewType('array'));
                }}
                className={viewType === 'array' ? 'active' : ''}
              >
                <span>Array Editor</span>
                {viewType === 'array' && <span className="checkmark">✓</span>}
              </button>
              <button
                onClick={() => {
                  setActiveMenu(null);
                  dispatch(setViewType('monaco'));
                }}
                className={viewType === 'monaco' ? 'active' : ''}
              >
                <span>Monaco Editor</span>
                {viewType === 'monaco' && <span className="checkmark">✓</span>}
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

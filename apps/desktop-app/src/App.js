import React, { useState, useEffect, useRef } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from './store/store';
import { setAIChanges } from './store/aiChangesSlice';
import { openSettings, closeSettings } from './store/uiSlice';
import { setAnonId as setUserAnonId, setAuthId as setUserAuthId, setUser as setUserData } from './store/userSlice';
import './App.css';
import Editor from './components/Editor';
import AISidebar from './components/AISidebar';
import Settings from './components/Settings';
import DiffNavigation from './components/DiffNavigation';
import ConfirmCloseModal from './components/ConfirmCloseModal';
import WebMenuBar from './components/WebMenuBar';
import Window from './components/Window';
import { fetchUserAccount, fetchUserTokens, normalizeUserTokenData } from './utils/aiService';
import { isElectron, isWeb, getWebAnonId } from './utils/environment';
import { uploadTextFile, downloadTextFile, downloadTextFileAs } from './utils/webFileOps';
import { parseText, getTextFromLines, getLines } from './utils/editorEngine';

function App() {
  const dispatch = useDispatch();
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [isModified, setIsModified] = useState(false);
  const [anonId, setAnonId] = useState(null);
  const [authId, setAuthId] = useState(null);
  const [userAccount, setUserAccount] = useState(null);
  const [availableTokens, setAvailableTokens] = useState(null);
  const [isSettingsView, setIsSettingsView] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(() => {
    const saved = localStorage.getItem('aiEnabled');
    return saved === null ? true : saved === 'true';
  });
  const [developerMode, setDeveloperMode] = useState(() => {
    const saved = localStorage.getItem('developerMode');
    return saved === null ? true : saved === 'true';
  });
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const editorRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const isSettingsOpen = useSelector(state => state.ui.isSettingsOpen);
  const settingsTab = useSelector(state => state.ui.settingsTab);

  const handleAIResponse = (newLines, processedChanges, allChangeIds) => {
    console.log('[APP] Received AI response with', newLines.length, 'lines');
    console.log('[APP] All change IDs:', allChangeIds);
    
    // Store changes in Redux
    dispatch(setAIChanges({ allChangeIds, processedChanges }));
    
    // Update editor with new lines
    if (editorRef.current && editorRef.current.updateLinesFromAI) {
      editorRef.current.updateLinesFromAI(newLines);
    }
  };

  const handleEditorReady = (editorAPI) => {
    editorRef.current = editorAPI;
  };

  const handleDiffUpdate = () => {
    // Re-render editor when changes are accepted/rejected
    if (editorRef.current && editorRef.current.updateLinesFromAI) {
      const { getLines } = require('./utils/editorEngine');
      editorRef.current.updateLinesFromAI(getLines());
    }
    setIsModified(true);
  };

  useEffect(() => {
    // Expose isModified to window for Electron
    window.isModified = isModified;
  }, [isModified]);

  // Track browser fullscreen state in web mode
  useEffect(() => {
    if (!isWeb()) return;

    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
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

  const handleToggleFullscreen = () => {
    if (!isWeb()) return;

    const doc = document;
    const docEl = doc.documentElement;
    const fullscreenElement = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

    if (!fullscreenElement) {
      const request = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
      if (request) {
        request.call(docEl);
      }
    } else {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
      if (exit) {
        exit.call(doc);
      }
    }
  };

  // Warn about unsaved changes when closing the browser tab/window in web mode
  useEffect(() => {
    if (!isWeb()) return;

    const handleBeforeUnload = (e) => {
      if (!window.isModified) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    console.log('[APP] isModified changed to:', isModified);
  }, [isModified]);

  useEffect(() => {
    console.log('[APP] isAIEnabled changed to:', isAIEnabled);
  }, [isAIEnabled]);

  // Keep window title in sync with current file and modification state
  useEffect(() => {
    const fullPath = currentFilePath || '';
    const fileName = fullPath
      ? fullPath.split(/[/\\\\]/).pop()
      : 'Untitled';
    document.title = `${isModified ? '* ' : ''}${fileName} - ScribeFold AI`;
  }, [currentFilePath, isModified]);

  useEffect(() => {
    console.log('[APP] currentFilePath state changed to:', currentFilePath);
  }, [currentFilePath]);

  useEffect(() => {
    localStorage.setItem('aiEnabled', isAIEnabled ? 'true' : 'false');
  }, [isAIEnabled]);

  // Notify main process about developer mode for DevTools control
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.setDeveloperMode) {
      window.electronAPI.setDeveloperMode(developerMode);
    }
  }, [developerMode]);

  useEffect(() => {
    // Get anon_id from Electron or generate for web
    if (isElectron()) {
      window.electronAPI.getAnonId().then(id => {
        console.log('[APP] Received anon_id:', id);
        setAnonId(id);
        dispatch(setUserAnonId(id));
      });

      window.electronAPI.onAnonIdReady((event, id) => {
        console.log('[APP] anon_id ready:', id);
        setAnonId(id);
        dispatch(setUserAnonId(id));
      });

      window.electronAPI.onAIEnabledChanged((event, enabled) => {
        console.log('[APP] AI enabled changed:', enabled);
        setIsAIEnabled(!!enabled);
      });

      // Guard to avoid double-registration in React Strict Mode
      if (!window.__scribeFoldToggleAIRegistered) {
        window.__scribeFoldToggleAIRegistered = true;
        window.electronAPI.onToggleAITool(() => {
          console.log('[APP] Toggle AI tool requested');
          setIsAIEnabled(prev => !prev);
        });
      }

      // Background theme handling
      window.electronAPI.onSetBackground((event, imagePath) => {
        setBackground(imagePath);
      });

      // Listen for settings updates from settings window
      window.electronAPI.onSettingsUpdated((event, settings) => {
        if (settings.backgroundImage !== undefined) {
          setBackground(settings.backgroundImage);
        }
        if (settings.aiEnabled !== undefined) {
          console.log('[APP] Settings updated - AI enabled:', settings.aiEnabled);
          setIsAIEnabled(!!settings.aiEnabled);
        }
        if (settings.developerMode !== undefined) {
          const dev = !!settings.developerMode;
          console.log('[APP] Settings updated - developer mode:', dev);
          setDeveloperMode(dev);
          localStorage.setItem('developerMode', dev ? 'true' : 'false');
        }
        if (settings.authId !== undefined) {
          const newAuthId = settings.authId || null;
          console.log('[APP] Settings updated - authId:', newAuthId);
          setAuthId(newAuthId);

          if (newAuthId) {
            localStorage.setItem('authId', newAuthId);
          } else {
            localStorage.removeItem('authId');
          }

          dispatch(setUserAuthId(newAuthId));

          // When auth state changes, refresh token data for AISidebar
          if (anonId) {
            (async () => {
              try {
                const tokenData = await fetchUserTokens(anonId, newAuthId);
                const normalized = normalizeUserTokenData(tokenData || {});
                const refreshedAvailable = normalized.availableTokens > 0 ? normalized.availableTokens : 0;
                console.log('[APP] Refreshed availableTokens after auth change:', refreshedAvailable, 'normalized:', normalized);
                setAvailableTokens(refreshedAvailable);
              } catch (err) {
                console.error('[APP] Failed to refresh tokens after auth change:', err);
              }
            })();
          }
        }
        
        if (settings.requestCloseAfterSave) {
          window.close();
        }
      });

      if (window.electronAPI.onShowUnsavedChangesDialog) {
        window.electronAPI.onShowUnsavedChangesDialog(() => {
          setShowUnsavedDialog(true);
        });
      }
    } else {
      // Web mode: generate anon_id from localStorage
      const webAnonId = getWebAnonId();
      console.log('[APP] Using web anon_id:', webAnonId);
      setAnonId(webAnonId);
      dispatch(setUserAnonId(webAnonId));
    }

    // Load saved background on startup
    const savedBackground = localStorage.getItem('backgroundImage');
    if (savedBackground) {
      setBackground(savedBackground);
    } else {
      // Set spacedreams as default theme
      setBackground('spacedreams.jpg');
    }

    // Check if this is the dedicated Electron settings window (general or AI tab)
    if ((window.location.hash === '#settings' || window.location.hash === '#settings-ai') && isElectron()) {
      setIsSettingsView(true);
    }

    // Load saved authId on startup so auth state persists across sessions
    const savedAuthId = localStorage.getItem('authId');
    if (savedAuthId) {
      console.log('[APP] Loaded authId from localStorage:', savedAuthId);
      setAuthId(savedAuthId);
      dispatch(setUserAuthId(savedAuthId));
    }
  }, []);

  // Once anonId is known, ensure user exists and load account data from backend
  useEffect(() => {
    if (!anonId) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await fetchUserAccount(anonId);
        if (cancelled) return;
        console.log('[APP] User account data loaded for anonId', anonId, ':', data);
        setUserAccount(data || null);
        dispatch(setUserData(data || null));

        // If backend returns an auth-linked user, keep authId in sync in App state + localStorage
        if (data && (data.authId || data.auth_id)) {
          const newAuthId = data.authId || data.auth_id;
          console.log('[APP] Synching authId from backend:', newAuthId);
          setAuthId(newAuthId);
          localStorage.setItem('authId', newAuthId);
          dispatch(setUserAuthId(newAuthId));
        }

        // After user ensure, load authoritative token stats so AISidebar can show real available tokens
        try {
          const tokenData = await fetchUserTokens(anonId, (data && (data.authId || data.auth_id)) || authId || null);
          const normalized = normalizeUserTokenData(tokenData || {});
          const initialAvailable = normalized.availableTokens > 0 ? normalized.availableTokens : 0;
          console.log('[APP] Initial availableTokens from backend:', initialAvailable, 'normalized:', normalized);
          if (!cancelled) {
            setAvailableTokens(initialAvailable);
          }
        } catch (tokenErr) {
          if (!cancelled) {
            console.error('[APP] Failed to load initial tokens for anonId', anonId, tokenErr);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[APP] Failed to load user account data for anonId', anonId, err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [anonId]);

  const setBackground = (imagePath) => {
    const backgroundContainer = document.getElementById('backgroundContainer');
    if (!backgroundContainer) return;

    if (imagePath) {
      // If we are in a normal browser and an old absolute OS path was stored
      // (from a previous Electron custom theme), fall back to the default theme.
      const looksAbsolute = imagePath.includes(':') || imagePath.startsWith('/');
      if (!isElectron() && looksAbsolute) {
        imagePath = 'spacedreams.jpg';
      }

      const isAbsolutePath = isElectron() && looksAbsolute;
      const imageUrl = isAbsolutePath
        ? `file:///${imagePath.replace(/\\/g, '/')}`
        : `images/${imagePath}`;
      backgroundContainer.style.backgroundImage = `url('${imageUrl}')`;
      localStorage.setItem('backgroundImage', imagePath);
    } else {
      backgroundContainer.style.backgroundImage = 'none';
      localStorage.removeItem('backgroundImage');
    }
  };

  const handleFileChange = (filePath) => {
    console.log('[APP] handleFileChange called with:', filePath);
    setCurrentFilePath(filePath);
    console.log('[APP] currentFilePath state will be updated to:', filePath);
    setIsModified(false);
  };

  const handleContentChange = () => {
    console.log('[APP] handleContentChange called - marking modified');
    setIsModified(true);
  };

  const handleSaveComplete = () => {
    console.log('[APP] handleSaveComplete called - clearing modified');
    setIsModified(false);
  };

  // Web menu handlers
  const handleWebNew = () => {
    if (isModified && !window.confirm('You have unsaved changes. Continue?')) return;
    parseText('');
    setCurrentFilePath(null);
    setIsModified(false);
    if (editorRef.current?.updateLinesFromAI) {
      editorRef.current.updateLinesFromAI(getLines());
    }
  };

  const handleWebOpen = async () => {
    const result = await uploadTextFile();
    if (result.success) {
      parseText(result.content);
      setCurrentFilePath(result.fileName);
      setIsModified(false);
      if (editorRef.current?.updateLinesFromAI) {
        editorRef.current.updateLinesFromAI(getLines());
      }
    }
  };

  const handleWebDownloadFile = () => {
    const content = getTextFromLines();
    const fileName = currentFilePath || 'document.txt';
    downloadTextFile(content, fileName);
  };

  const handleWebFoldAll = () => {
    const lines = getLines();
    lines.forEach(line => {
      if (line.startIdx !== -1 && line.endIdx >= line.startIdx) {
        line.open = false;
        if (!line.text.includes('#folded')) {
          line.text = line.text.trim() + ' #folded';
        }
      }
    });
    if (editorRef.current?.updateLinesFromAI) {
      editorRef.current.updateLinesFromAI(lines);
    }
  };

  const handleWebToggleArrayView = () => {
    if (editorRef.current && editorRef.current.toggleFoldView) {
      editorRef.current.toggleFoldView();
    }
  };

  const handleWebUnfoldAll = () => {
    const lines = getLines();
    lines.forEach(line => {
      if (line.startIdx !== -1) {
        line.open = true;
        line.text = line.text.replace(/#folded\b/gi, '').trim();
      }
    });
    if (editorRef.current?.updateLinesFromAI) {
      editorRef.current.updateLinesFromAI(lines);
    }
  };

  // Electron-only settings window (separate BrowserWindow)
  if (isSettingsView && isElectron()) {
    return (
      <Settings 
        anonId={anonId} 
        authId={authId} 
        userAccount={userAccount}
      />
    );
  }

  return (
    <div className={`App ${isWeb() ? 'has-web-menu' : ''} ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
      {/* Web Menu Bar - only shown in browser */}
      {isWeb() && (
        <WebMenuBar
          onNew={handleWebNew}
          onOpen={handleWebOpen}
          onDownloadInfo={() => setShowDownloadModal(true)}
          onSettings={() => dispatch(openSettings({ tab: 'general' }))}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
          onToggleAI={() => setIsAIEnabled(prev => !prev)}
          onFoldAll={handleWebFoldAll}
          onUnfoldAll={handleWebUnfoldAll}
          onToggleArrayView={handleWebToggleArrayView}
          isAIEnabled={isAIEnabled}
          currentFileName={currentFilePath}
          isModified={isModified}
        />
      )}
      <div className="loading-screen" id="loadingScreen">
        <div className="loading-text">Loading...</div>
      </div>
      <div id="backgroundContainer" className="background-container"></div>
      <div className={`page-container ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
        <div className="page">
          <Editor 
            currentFilePath={currentFilePath}
            onFileChange={handleFileChange}
            onContentChange={handleContentChange}
            onSaveComplete={handleSaveComplete}
            onEditorReady={handleEditorReady}
            isAIEnabled={isAIEnabled}
          />
        </div>
      </div>
      {isAIEnabled && (
        <AISidebar 
          anonId={anonId}
          authId={authId}
          developerMode={developerMode}
          initialAvailableTokens={availableTokens}
          onAIResponse={handleAIResponse}
        />
      )}
      <DiffNavigation onUpdate={handleDiffUpdate} />
      <div id="status" className="status"></div>
      {showUnsavedDialog && (
        <ConfirmCloseModal
          onSave={() => {
            setShowUnsavedDialog(false);
            if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
              window.electronAPI.unsavedChangesResponse('save');
            }
          }}
          onDiscard={() => {
            setShowUnsavedDialog(false);
            if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
              window.electronAPI.unsavedChangesResponse('discard');
            }
          }}
          onCancel={() => {
            setShowUnsavedDialog(false);
            if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
              window.electronAPI.unsavedChangesResponse('cancel');
            }
          }}
        />
      )}

      {/* Web-only Settings modal (controlled via Redux UI state) */}
      {isWeb() && isSettingsOpen && (
        <Window
          title="Settings"
          onClose={() => dispatch(closeSettings())}
          className="window-large"
        >
          <Settings
            anonId={anonId}
            authId={authId}
            userAccount={userAccount}
            onClose={() => dispatch(closeSettings())}
            onThemeChanged={setBackground}
            initialTab={settingsTab || 'general'}
          />
        </Window>
      )}

      {/* Web-only Download info modal */}
      {isWeb() && showDownloadModal && (
        <Window
          title="Download"
          onClose={() => setShowDownloadModal(false)}
          className="window-medium"
        >
          <div style={{ color: '#e0e0e0', fontSize: '14px', lineHeight: 1.5, textAlign: 'center' }}>
            <p style={{ marginBottom: '12px' }}>
              The browser cannot save directly to your file system so to keep your
              work download a text file version of your document or download the
              desktop app so you can save directly.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  handleWebDownloadFile();
                  setShowDownloadModal(false);
                }}
              >
                Download Text File
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  window.open('https://scribefold-ai-monorepo.onrender.com/#/downloads', '_blank', 'noopener,noreferrer');
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <span>Download Desktop App</span>
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
              </button>
            </div>
          </div>
        </Window>
      )}
    </div>
  );
}

export default App;

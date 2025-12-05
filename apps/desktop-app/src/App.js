import React, { useState, useEffect, useRef } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { store } from './store/store';
import { setAIChanges } from './store/aiChangesSlice';
import { setAnonId as setUserAnonId, setAuthId as setUserAuthId, setUser as setUserData } from './store/userSlice';
import './App.css';
import Editor from './components/Editor';
import AISidebar from './components/AISidebar';
import Settings from './components/Settings';
import DiffNavigation from './components/DiffNavigation';
import ConfirmCloseModal from './components/ConfirmCloseModal';
import { fetchUserAccount } from './utils/aiService';

function App() {
  const dispatch = useDispatch();
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [isModified, setIsModified] = useState(false);
  const [anonId, setAnonId] = useState(null);
  const [authId, setAuthId] = useState(null);
  const [userAccount, setUserAccount] = useState(null);
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
  const editorRef = useRef(null);

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

  useEffect(() => {
    // Get anon_id from Electron
    if (window.electronAPI) {
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
        
        if (settings.requestCloseAfterSave) {
          window.close();
        }
      });

      if (window.electronAPI.onShowUnsavedChangesDialog) {
        window.electronAPI.onShowUnsavedChangesDialog(() => {
          setShowUnsavedDialog(true);
        });
      }
    }

    // Load saved background on startup
    const savedBackground = localStorage.getItem('backgroundImage');
    if (savedBackground) {
      setBackground(savedBackground);
    } else {
      // Set spacedreams as default theme
      setBackground('spacedreams.jpg');
    }

    // Check if this is the settings window (general or AI tab)
    if (window.location.hash === '#settings' || window.location.hash === '#settings-ai') {
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
      const isAbsolutePath = imagePath.includes(':') || imagePath.startsWith('/');
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

  // Render settings view if hash is #settings
  if (isSettingsView) {
    return <Settings anonId={anonId} authId={authId} userAccount={userAccount} />;
  }

  return (
    <div className="App">
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
    </div>
  );
}

export default App;

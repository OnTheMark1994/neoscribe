import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setAIChanges } from './store/aiChangesSlice';
import { openSettings } from './store/uiSlice';
import { openDownloadModal } from './store/uiSlice';
import { setIsModified, setCurrentFilePath, selectIsModified, selectCurrentFilePath } from './store/editorSlice';
import { selectIsAIEnabled } from './store/settingsSlice';
import './App.css';
import Editor from './components/Editor';
import AISidebar from './components/AISidebar';
import Settings from './components/Settings';
import DiffNavigation from './components/DiffNavigation';
import WebMenuBar from './components/WebMenuBar';
import AppInitializer from './components/AppInitializer';
import LoadingScreen from './components/LoadingScreen';
import Menus from './components/Menus';
import { isElectron, isWeb } from './utils/environment';
import { uploadTextFile } from './utils/webFileOps';
import { parseText, getLines } from './utils/editorEngine';

/**
 * App.js - Root component (refactored per v2 plan)
 * 
 * Purpose: Minimal orchestrator that renders major sections.
 * All initialization logic moved to AppInitializer.
 * All modal logic moved to Menus.
 * State management centralized in Redux.
 */
function App() {
  const dispatch = useDispatch();
  const editorRef = useRef(null);
  
  // Read from Redux instead of local state
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const currentFilePath = useSelector(selectCurrentFilePath);
  const isModified = useSelector(selectIsModified);
  
  // Local state only for things that don't need to be shared
  const [isSettingsView, setIsSettingsView] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      editorRef.current.updateLinesFromAI(getLines());
    }
    dispatch(setIsModified(true));
  };

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

  // Keep window title in sync with current file and modification state
  useEffect(() => {
    const fullPath = currentFilePath || '';
    const fileName = fullPath
      ? fullPath.split(/[/\\\\]/).pop()
      : 'Untitled';
    document.title = `${isModified ? '* ' : ''}${fileName} - ScribeFold AI`;
  }, [currentFilePath, isModified]);

  // Check if this is the dedicated Electron settings window
  useEffect(() => {
    if ((window.location.hash === '#settings' || window.location.hash === '#settings-ai') && isElectron()) {
      setIsSettingsView(true);
    }
  }, []);

  // Editor callbacks that dispatch to Redux
  const handleFileChange = (filePath) => {
    console.log('[APP] handleFileChange called with:', filePath);
    dispatch(setCurrentFilePath(filePath));
    dispatch(setIsModified(false));
  };

  const handleContentChange = () => {
    dispatch(setIsModified(true));
  };

  const handleSaveComplete = () => {
    dispatch(setIsModified(false));
  };

  // Web menu handlers
  const handleWebNew = () => {
    if (isModified && !window.confirm('You have unsaved changes. Continue?')) return;
    parseText('');
    dispatch(setCurrentFilePath(null));
    dispatch(setIsModified(false));
    if (editorRef.current?.updateLinesFromAI) {
      editorRef.current.updateLinesFromAI(getLines());
    }
  };

  const handleWebOpen = async () => {
    const result = await uploadTextFile();
    if (result.success) {
      parseText(result.content);
      dispatch(setCurrentFilePath(result.fileName));
      dispatch(setIsModified(false));
      if (editorRef.current?.updateLinesFromAI) {
        editorRef.current.updateLinesFromAI(getLines());
      }
    }
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
    return <Settings />;
  }

  return (
    <div className={`App ${isWeb() ? 'has-web-menu' : ''} ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
      {/* AppInitializer handles all initialization logic */}
      <AppInitializer />
      
      {/* Loading screen controlled by Redux */}
      <LoadingScreen />
      
      {/* Web Menu Bar - only shown in browser */}
      {isWeb() && (
        <WebMenuBar
          onNew={handleWebNew}
          onOpen={handleWebOpen}
          onDownloadInfo={() => dispatch(openDownloadModal())}
          onSettings={() => dispatch(openSettings({ tab: 'general' }))}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
          onFoldAll={handleWebFoldAll}
          onUnfoldAll={handleWebUnfoldAll}
          onToggleArrayView={handleWebToggleArrayView}
        />
      )}
      
      <div id="backgroundContainer" className="background-container"></div>
      
      <div className={`page-container ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
        <div className="page">
          <Editor 
            onFileChange={handleFileChange}
            onContentChange={handleContentChange}
            onSaveComplete={handleSaveComplete}
            onEditorReady={handleEditorReady}
          />
        </div>
      </div>
      
      {isAIEnabled && (
        <AISidebar onAIResponse={handleAIResponse} />
      )}
      
      <DiffNavigation onUpdate={handleDiffUpdate} />
      
      <div id="status" className="status"></div>
      
      {/* All modals centralized in Menus component */}
      <Menus />
    </div>
  );
}

export default App;

import React, { useRef, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsAIEnabled } from './store/settingsSlice';
import { selectViewType, setContent } from './store/editorSlice';
import { hideAiContextMenu } from './store/aiUiSlice';
import { getLines } from './utils/editorEngine';
import SimpleMonaco from './components/Editor/SimpleMonaco';
import EditorArray from './components/EditorArray/EditorArray';
import AiContextMenu from './components/EditorArray/AiContextMenu';
import AISidebar from './components/AI/AISidebar';
import WebMenuBar from './components/UI/WebMenuBar';
import AppInitializer from './components/Data/AppInitializer';
import LoadingScreen from './components/UI/LoadingScreen';
import Menus from './components/Windows/Menus';
import StatusBar from './components/UI/StatusBar';
import './App.css';

// Step 5 – View mode switch wiring
// --------------------------------
// syncCurrentEditorToEngine acts as the single hook point for syncing the
// currently active editor into the shared editorEngine model **before** we
// actually switch which editor is rendered. In this step it is only a
// placeholder that logs, and Step 6 will fill in the real syncing logic.
function syncCurrentEditorToEngine(currentViewMode, editorInstance, dispatch) {
  if (!editorInstance) {
    console.log('[App] syncCurrentEditorToEngine called from', currentViewMode, {
      hasEditorInstance: false,
    });
    return;
  }

  let text = '';

  if (currentViewMode === 'array') {
    if (typeof editorInstance.getContent === 'function') {
      // editorInstance refers to the array editor editor engine in the case of array view
      text = editorInstance.getContent() || '';
      console.log('[App] Updating Redux content from array before switch, length =', text.length);
      if (dispatch) {
        dispatch(setContent(text));
      }
    }
  } else if (currentViewMode === 'monaco') {
    if (typeof editorInstance.getEditor === 'function') {
      // editorInstance refers to the monaco editor in the case
      const monacoEditor = editorInstance.getEditor();
      if (monacoEditor && typeof monacoEditor.getValue === 'function') {
        text = monacoEditor.getValue() || '';
      }
    }
  }

  console.log('[App] syncCurrentEditorToEngine snapshot from', currentViewMode, {
    length: text.length,
    text,
  });
}

/**
 * App.js - Main application component
 * 
 * Renders either:
 * - EditorArray: Line-based fold editor with array view (default)
 * - SimpleMonaco: Monaco code editor
 * 
 * Based on Redux viewType state ('array' or 'monaco')
 */
function App() {
  const dispatch = useDispatch();
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const viewType = useSelector(selectViewType);
  
  // Unified editor ref - works for both SimpleMonaco and EditorArray
  const editorRef = useRef(null);

  // Local mirror of view mode for future cross-editor model sync
  const [viewMode, setViewMode] = useState(viewType);

  // Whenever Redux viewType changes (array vs monaco), sync to local state.
  // This imitates the future behavior where we will also sync the shared
  // editorEngine model into the newly active editor.
  useEffect(() => {
    // First, sync the currently active editor into editorEngine
    syncCurrentEditorToEngine(viewMode, editorRef.current, dispatch);

    // Also ensure any open AI context menu is closed when switching views
    dispatch(hideAiContextMenu());

    // Then switch the local view mode, which controls which editor is shown
    setViewMode(viewType);

    console.log('[App] View mode changed, syncing editors to viewType =', viewType);
  }, [viewType, viewMode, dispatch]);

  return (
    <div className={`App has-web-menu ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
      <AppInitializer />
      <LoadingScreen />
      <Menus />
      <WebMenuBar />

      <div id="backgroundContainer" className="background-container" />

      <div className={`page-container ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
        <div className="page">
          {/* Conditionally render editor based on local viewMode */}
          {viewMode === 'array' ? (
            <EditorArray ref={editorRef} />
          ) : (
            <SimpleMonaco ref={editorRef} />
          )}
        </div>
      </div>
      <AiContextMenu />
      
      {isAIEnabled && <AISidebar monacoRef={editorRef} />}
      <StatusBar />
    </div>
  );
}

export default App;
